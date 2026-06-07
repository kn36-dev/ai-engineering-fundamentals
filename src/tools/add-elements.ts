import { tool } from "ai";
import { z } from "zod";
import { elementSchema } from "./element-schema";
import { clean } from "../utils/clean";
import { applySkeleton } from "../context/applySkeleton";

// export const addElements = tool({
//     // It also supports a `inputExamples` declaration for that purpose
//     description:
//         clean(`"Add new geometric shapes or text elements to the canvas diagram. " +
//         "Provide an array of elements. Do not wrap the JSON output in markdown blocks or function names."`),
//     inputSchema: z.object({
//         elements: z.array(elementSchema),
//     }),
// });

export const addElements = tool({
    description:
        clean(`Add new elements to the canvas. Use this for creating diagrams or adding to an existing one. Each element needs an id, type, position, and size.

To label a shape, set the shape's \`label\` field. Excalidraw centers the text inside the box automatically. Do NOT create a separate text element to label a shape. Standalone text elements are for floating annotations only.

To connect two shapes with an arrow, set \`start: { id: ... }\` and \`end: { id: ... }\` on the arrow. The shapes must exist in the same call or already be on the canvas.

Example: addElements({ elements: [
  { type: "rectangle", id: "rect_start", x: 100, y: 100, width: 200, height: 80, label: { text: "Start" } },
  { type: "rectangle", id: "rect_end",   x: 380, y: 100, width: 200, height: 80, label: { text: "End" } },
  { type: "arrow",     id: "arrow_start_end", x: 300, y: 140, width: 80, height: 0, start: { id: "rect_start" }, end: { id: "rect_end" } }
]})`),
    inputSchema: z.object({
        elements: z
            .array(elementSchema)
            .describe("Array of new elements to add to the canvas"),
    }),
    strict: true,
    execute: async ({ elements }: { elements: unknown[] }) => {
        const runtime = applySkeleton(elements as Record<string, unknown>[]);
        for (const el of runtime) sim.push({ ...el });
        return { added: runtime.length };
    },
});
