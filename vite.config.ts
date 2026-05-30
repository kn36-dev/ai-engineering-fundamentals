import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
    plugins: [
        react(),
        {
            name: "fix-cloudflare-externals",
            configResolved(config) {
                if (config.environments?.ai_design_tool) {
                    config.environments.ai_design_tool.resolve.external = [];
                }
            },
        },
        cloudflare(),
    ],
});
