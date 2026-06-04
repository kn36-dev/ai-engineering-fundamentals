import { AIChatAgent } from "@cloudflare/ai-chat";
import { convertToModelMessages } from "ai";
import { createGroq } from "@ai-sdk/groq";

import { streamAgent } from "./agent-core";

interface Env {
    GROQ_API_KEY: string;
}

export class DesignAgent extends AIChatAgent<Env> {
    async onChatMessage() {
        try {
            const groq = createGroq({
                apiKey: this.env.GROQ_API_KEY,
            });

            const result = streamAgent({
                model: groq("qwen/qwen3-32b"),
                messages: await convertToModelMessages(this.messages),
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
