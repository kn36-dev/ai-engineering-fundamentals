import { AIChatAgent } from "@cloudflare/ai-chat";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { tools } from "./tools";

interface Env {
    GEMINI_API_KEY: string;
}

const SYSTEM_PROMPT = `You are a diagram design assistant. You help users create and modify diagrams on an Excalidraw canvas.

When the user asks you to create a diagram, use the generateDiagram tool to produce Excalidraw elements.

Guidelines for generating diagrams:
- Give each element a unique id (e.g. "rect-1", "text-1", "arrow-1")
- Position elements with reasonable spacing (at least 20px gap between elements)
- Use rectangles for boxes/containers, ellipses for circles, diamonds for decision points
- Add text labels inside or near shapes
- Connect related elements with arrows
- Use a clean layout: left to right or top to bottom
- Default to strokeColor "#1e1e1e" and backgroundColor "transparent"
- Set roughness to 1 for a hand-drawn look

When the user asks to modify an element, use the modifyDiagram tool with the element's id.`;

export class DesignAgent extends AIChatAgent<Env> {
    async onChatMessage() {
        try {
            const google = createGoogleGenerativeAI({
                apiKey: this.env.GEMINI_API_KEY,
            });

            console.log({ messagesInAgent: this.messages });

            const result = streamText({
                model: google("gemini-2.5-flash"),
                system: SYSTEM_PROMPT,
                messages: await convertToModelMessages(this.messages),
                tools,
                stopWhen: stepCountIs(5),
            });

            return result.toUIMessageStreamResponse();
        } catch (error: any) {
            // Force the real, un-obscured stack trace into the terminal logs
            console.error("❌ CAPTURED SDK RUNTIME ERROR:", error.message);
            console.error(error.stack);
            throw error;
        }
    }
}
