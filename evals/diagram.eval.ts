import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { Eval } from "braintrust";
import { createGroq } from "@ai-sdk/groq";
import { runAgent } from "../src/agent-core";
import { buildMessages, type GoldenTestCase } from "./buildMessages";
import { schemaScorer, type AgentOutput } from "./scorers/schema";
import { structureScorer } from "./scorers/structure";
import { toolChoiceScorer } from "./scorers/toolChoice";
import { labelKeywordScorer } from "./scorers/labelKeyword";
import { boundArrowsScorer } from "./scorers/boundArrows";
import { boundLabelsScorer } from "./scorers/boundLabels";
import { connectivityScorer } from "./scorers/connectivity";

config({ path: ".dev.vars" });

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const testCases: GoldenTestCase[] = JSON.parse(
    readFileSync(join("evals", "datasets", "golden_2.json"), "utf-8"),
);

Eval<GoldenTestCase, AgentOutput, GoldenTestCase>("Diagram Agent", {
    data: () =>
        testCases.map((tc) => ({
            input: tc,
            expected: tc,
            metadata: {
                id: tc.id,
                difficulty: tc.difficulty,
                category: tc.category,
            },
        })),
    task: async (tc) => {
        const result = await runAgent({
            model: groq("qwen/qwen3-32b"),
            messages: buildMessages(tc),
            // Eval simulates a browser canvas: the seed elements become the
            // initial sim state, and queryCanvas is overridden inside runAgent to
            // read from it. The worker doesn't pass this — it relies on the live
            // browser via the queryCanvas client tool.
            seedCanvas: testCase.seed?.elements ?? [],
            env: { TAVILY_API_KEY: process.env.TAVILY_API_KEY },
        });

        return {
            text: result.text,
            elements: result.elements,
            toolCalls: result.toolCalls,
        };
    },
    scores: [
        schemaScorer,
        structureScorer,
        toolChoiceScorer,
        labelKeywordScorer,
        connectivityScorer,
        boundArrowsScorer,
        boundLabelsScorer,
    ],
});
