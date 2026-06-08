import { AIChatAgent } from "@cloudflare/ai-chat";
import { convertToModelMessages } from "ai";
import { createGroq } from "@ai-sdk/groq";

import { streamAgent } from "./agent-core";

interface Env {
    GROQ_API_KEY: string;
    TAVILY_API_KEY: string;
    UPSTASH_VECTOR_REST_URL: string;
    UPSTASH_VECTOR_REST_TOKEN: string;
}

export class DesignAgent extends AIChatAgent<Env> {
    async onChatMessage() {
        try {
            // ─── 1. INVESTIGATIVE LOG: INBOUND PAYLOAD ──────────────────────────
            console.log(
                "📥 [Durable Object] Raw Incoming Messages from Frontend:",
            );
            console.log(JSON.stringify(this.messages, null, 2));

            const groq = createGroq({
                apiKey: this.env.GROQ_API_KEY,
            });

            const messages = await convertToModelMessages(this.messages);

            const result = streamAgent({
                model: groq("qwen/qwen3-32b"),
                messages,
                env: {
                    TAVILY_API_KEY: this.env.TAVILY_API_KEY,
                    UPSTASH_VECTOR_REST_URL: this.env.UPSTASH_VECTOR_REST_URL,
                    UPSTASH_VECTOR_REST_TOKEN:
                        this.env.UPSTASH_VECTOR_REST_TOKEN,
                },
            });

            // // 2. Tap the returned object's background promises for debugging.
            // // We cast to 'any' here safely since this is an isolated logging tap.
            // const streamResult = result as any;

            // if (
            //     streamResult.toolCalls &&
            //     typeof streamResult.toolCalls.then === "function"
            // ) {
            //     streamResult.toolCalls
            //         .then((calls: any[]) => {
            //             console.log("🏁 [Durable Object] Stream Completed.");
            //             if (calls && calls.length > 0) {
            //                 console.log("🛠️ Tool Calls Emitted:");
            //                 console.log(JSON.stringify(calls, null, 2));
            //             } else {
            //                 console.warn(
            //                     "⚠️ WARNING: The model responded but generated ZERO tool calls.",
            //                 );
            //             }
            //         })
            //         .catch((err: any) =>
            //             console.error("❌ Telemetry tool error:", err),
            //         );
            // }

            // if (
            //     streamResult.text &&
            //     typeof streamResult.text.then === "function"
            // ) {
            //     streamResult.text
            //         .then((text: string) => {
            //             console.log("📝 Plain Text Response:", text);
            //         })
            //         .catch((err: any) =>
            //             console.error("❌ Telemetry text error:", err),
            //         );
            // }

            return result.toUIMessageStreamResponse();
        } catch (error: any) {
            // Force the real, un-obscured stack trace into the terminal logs
            console.error("❌ CAPTURED SDK RUNTIME ERROR:", error.message);
            console.error(error.stack);
            throw error;
        }
    }
}
