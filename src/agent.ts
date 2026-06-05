import { AIChatAgent } from "@cloudflare/ai-chat";
import { convertToModelMessages, UIMessage } from "ai";
import { createGroq } from "@ai-sdk/groq";

import { streamAgent } from "./agent-core";
import { ExcalidrawElement } from "./schemas";

interface Env {
    GROQ_API_KEY: string;
}

type CanvasStatePart = {
    type: "data-canvas-state";
    data: { elements: ExcalidrawElement[] };
};

const extractCanvasState = (messages: UIMessage[]): ExcalidrawElement[] => {
    const last = messages.at(-1);
    const part = last?.parts.find(
        (p): p is CanvasStatePart => p.type === "data-canvas-state",
    );

    return part?.data.elements ?? [];
};

export class DesignAgent extends AIChatAgent<Env> {
    async onChatMessage() {
        try {
            const groq = createGroq({
                apiKey: this.env.GROQ_API_KEY,
            });

            const canvasState = extractCanvasState(this.messages);
            const messages = await convertToModelMessages(this.messages);

            console.log({ canvasState });

            const result = streamAgent({
                model: groq("qwen/qwen3-32b"),
                messages,
                canvasState,
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
