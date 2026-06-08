import { z } from "zod";
import { tool } from "ai";

interface TavilyResult {
    title?: string;
    content?: string;
    url?: string;
}

interface TavilyResponse {
    results?: TavilyResult[];
}

// We can use Tavily, Exa, Perplexity, Firecrawl
export function makeSearchWeb(apiKey: string | undefined) {
    return tool({
        description: `Search the web for current information. Use this when a user asks you about tech you don't know about or never heard of. Provide keyword terms only.`,
        inputSchema: z.object({
            query: z
                .string()
                .describe(
                    "The semantic keyword search query. Do not pass full URLs here.",
                ),
            maxResults: z.number().nullable().optional(),
        }),
        execute: async ({ query, maxResults }) => {
            if (!apiKey) {
                return { error: "API key not configured, tell the user" };
            }
            // ─── 🛡️ THE INPUT SANITIZATION SHIELD ───────────────────────────
            // 1. Trim whitespace and enforce a strict maximum token length for the search string
            let sanitizedQuery = query.trim().slice(0, 200);

            // 2. Erase protocol definitions (http://, https://) to break raw URL formatting
            sanitizedQuery = sanitizedQuery.replace(/^https?:\/\//i, "");

            // 3. Break URL path/parameter markers into safe space separators.
            // This transforms "attacker.com/leak?data=secret" into "attacker.com leak data secret"
            // effectively neutralizing the request routing behavior.
            sanitizedQuery = sanitizedQuery.replace(/[/\?=&:#]/g, " ");

            // 4. Fallback if the sanitization leaves an empty string
            if (!sanitizedQuery) {
                return { error: "Invalid search query structure provided." };
            }

            try {
                const response = await fetch("https://api.tavily.com/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        api_key: apiKey,
                        query: sanitizedQuery,
                        maxResults: maxResults ?? 5,
                        search_depth: "basic",
                    }),
                });

                if (!response.ok) {
                    return {
                        error: `Search came back with an error: ${await response.text()}`,
                    };
                }

                const data = (await response.json()) as any;

                const results = (data.results ?? []).map((r) => {
                    // Enforce length limit protection on backfilled data rows
                    let contentSnippet = r.content ?? "";
                    if (contentSnippet.length > 1500) {
                        contentSnippet =
                            contentSnippet.slice(0, 1500) + "... [Truncated]";
                    }

                    return {
                        title: r.title ?? "",
                        // content: r.content ?? "",
                        content: `\n<EXTERNAL_UNTRUSTED_DATA source="${r.url}">\n${r.content}\n</EXTERNAL_UNTRUSTED_DATA>\n`,
                        url: r.url ?? "",
                    };
                });

                return { results };
            } catch (e) {
                return { error: `Search failed with some error` };
            }
        },
    });
}
