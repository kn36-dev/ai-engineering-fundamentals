import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { builtinModules } from "node:module";

// Memory space to preserve auto-injected Node externals across hooks
const externalBackups = new Map<string, any>();

export default defineConfig({
    server: {
        proxy: {
            "/agents": {
                target: "http://localhost:8787",
                ws: true,
                changeOrigin: true,
            },
        },
    },
    plugins: [
        // 1. THE TRANSFORMER: Remaps bare Node imports to 'node:' namespaces
        // and marks them external so Vite doesn't try to bundle them.
        {
            name: "cloudflare-node-namespace-transformer",
            enforce: "pre", // Must execute before other resolution layers
            configResolved(config) {
                // Completely clear the environment-level array to satisfy Cloudflare's validator
                for (const [name, env] of Object.entries(
                    config.environments || {},
                )) {
                    if (name !== "client" && env.resolve?.external) {
                        env.resolve.external = [];
                    }
                }
            },
            resolveId(id, importer, options) {
                // Target only Server/Worker environments (where options.ssr is active)
                if (options?.ssr) {
                    const bareId = id.startsWith("node:") ? id.slice(5) : id;

                    // Match standard builtins or internal Node structures (_http, _stream)
                    if (
                        builtinModules.includes(bareId) ||
                        bareId.startsWith("_")
                    ) {
                        return {
                            id: id.startsWith("node:") ? id : `node:${id}`,
                            external: true,
                        };
                    }
                }
                return null;
            },
        },

        react(),
        // cloudflare(),
        // 2. THE PLATFORM EXTERNALIZER: Handles runtime native namespaces
        {
            name: "dynamic-cloudflare-externalizer",
            resolveId(id) {
                if (id.startsWith("cloudflare:")) {
                    return { id, external: true };
                }
                return null;
            },
        },
    ],
});
