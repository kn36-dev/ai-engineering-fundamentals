import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { Eval } from "braintrust";
import { createGroq } from "@ai-sdk/groq";
import { runAgent } from "../src/agent-core";
import { buildMessages } from "./buildMessages";
import { schemaScorer } from "./scorers/schema";

config({ path: ".dev.vars" });

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const testCases = JSON.parse(
    readFileSync(join("evals", "datasets", "golden.json"), "utf-8"),
);

Eval("Diagram Agent", {
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
        });

        return {
            text: result.text,
            elements: result.elements,
        };
    },
    scores: [schemaScorer],
});
