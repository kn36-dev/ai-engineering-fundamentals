import { AIChatAgent } from "@cloudflare/ai-chat";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { tools } from "./tools";
import { SYSTEM_PROMPT } from "./system-prompt";

interface Env {
    GROQ_API_KEY: string;
}

export class DesignAgent extends AIChatAgent<Env> {
    async onChatMessage() {
        try {
            const groq = createGroq({
                apiKey: this.env.GROQ_API_KEY,
            });

            console.log({ messagesInAgent: this.messages });

            const result = streamText({
                model: groq("qwen/qwen3-32b"),
                system: SYSTEM_PROMPT,
                messages: await convertToModelMessages(this.messages),
                tools,
                stopWhen: stepCountIs(5),
                temperature: 0,
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
