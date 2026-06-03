import { tools } from "../src/tools";
import { SYSTEM_PROMPT } from "../src/system-prompt";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { fileURLToPath } from "node:url";
import { EvalResult, TestCase } from "./types";
import { stepCountIs } from "ai";
import { join, dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

async function runTestCase(testCase: TestCase): Promise<EvalResult> {
    const start = Date.now();
    try {
        const result = await generateText({
            model: groq("qwen/qwen3-32b"),
            system: SYSTEM_PROMPT,
            prompt: testCase.input,
            tools,
            stopWhen: stepCountIs(2),
        });

        const elements = [];

        for (const step of result.steps) {
            for (const toolResult of step.toolResults ?? []) {
                if (toolResult.toolName === "generateDiagram") {
                    const output = toolResult.output as any;
                    if (Array.isArray(output?.elements)) {
                        elements.push(...output.elements);
                    }
                }
            }
        }

        return {
            testCaseId: testCase.id,
            input: testCase.input,
            response: result.text,
            elements,
            durationMs: Date.now() - start,
        };
    } catch (e: any) {
        return {
            testCaseId: testCase.id,
            input: testCase.input,
            response: "",
            elements: [],
            durationMs: 0,
            error: String(e.message),
        };
    }
}

async function main() {
    const datasetPath = join(ROOT, "evals/datasets/golden.json");
    const testCases: TestCase[] = JSON.parse(
        readFileSync(datasetPath, "utf-8"),
    );

    console.log(`Running ${testCases.length} test case... \n`);

    const results: EvalResult[] = [];
    for (const testCase of testCases) {
        process.stdout.write(
            `[${testCase.id}] ${testCase.difficulty.padEnd(6)} `,
        );
        const result = await runTestCase(testCase);
        results.push(result);
        if (result.error) {
            console.log(`ERROR: ${result.error}`);
        } else {
            console.log(
                `${result.elements.length} elements, ${result.durationMs}ms`,
            );
        }
    }

    // Write timestamped results for manual scoring
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const resultsDir = join(ROOT, "evals/results");
    mkdirSync(resultsDir, { recursive: true });
    const outPath = join(resultsDir, `${timestamp}.json`);
    writeFileSync(outPath, JSON.stringify(results, null, 2));

    console.log(`\nResults written to ${outPath}`);
    console.log(
        `\nNext: open the file, review each result, and add score (1-5) and notes.`,
    );

    console.log("\n=== Summary ===");
    console.log(`Total: ${results.length}`);
    console.log(`Errors: ${results.filter((r) => r.error).length}`);
    console.log(
        `Empty results (no elements): ${results.filter((r) => !r.error && r.elements.length === 0).length}`,
    );
    const avgDuration = Math.round(
        results.reduce((sum, r) => sum + r.durationMs, 0) / results.length,
    );
    console.log(`Average duration: ${avgDuration}ms`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
