import { tool } from "ai";
import { z } from "zod";
import { elementSchema } from "./element-schema";
import { clean } from "../utils/clean";

export const addElements = tool({
    // It also supports a `inputExamples` declaration for that purpose
    description:
        clean(`"Add new geometric shapes or text elements to the canvas diagram. " +
        "Provide an array of elements. Do not wrap the JSON output in markdown blocks or function names."`),
    inputSchema: z.object({
        elements: z.array(elementSchema),
    }),
});
