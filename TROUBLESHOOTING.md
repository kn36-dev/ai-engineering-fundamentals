# Root Cause Analysis: Development Environment Orchestration Failure

**Date:** May 30, 2026  
**Subject:** Resolution of Cloudflare/Vite Integration Conflicts  
**Status:** Resolved

## 1. Executive Summary

The development environment was experiencing persistent crashes due to conflicting runtime management. The frontend build tool (Vite) and the backend serverless runtime (Wrangler/Miniflare) were attempting to manage the same execution space, leading to version mismatches, runtime incompatibility, and WebSocket proxy failures. By decoupling these services into a **Two-Server Proxy Pattern**, we restored stability and developer velocity.

---

## 2. Problem Description

We encountered three primary blockers preventing the `DesignAgent` from executing locally:

1.  **Command Execution Errors:** Missing global `wrangler` path resolution.
2.  **Runtime Namespace Crashes:** `node:perf_hooks` and other Node-standard modules were not recognized by the isolated Workers runtime.
3.  **Vite/Miniflare Conflict:** Vite’s internal plugin tried to spin up an older version of the Cloudflare runtime that could not support modern (`2026-05-01`) compatibility dates, leading to a `TypeError` on startup.

---

## 3. Root Cause Analysis (RCA)

### A. The "Monolith" Fallacy

We initially relied on `@cloudflare/vite-plugin` to manage our backend worker. The root cause was a **version misalignment between the local plugin's runtime (Miniflare v4) and our requested platform features**.

- **The Error:** `TypeError: Cannot use 'in' operator to search for 'cache' in undefined`
- **The Cause:** The embedded Miniflare runtime was pinned to a legacy compatibility date (`2025-04-04`). When it encountered newer syntax or configuration requirements (`2026-05-01`), the internal state object failed to initialize, resulting in a crash during the worker bootstrap phase.

### B. Asset Routing Failure

Wrangler, when configured with `[assets]`, enforces strict directory validation. Because Vite's hot-reload process (`5173`) was not aware of the physical location of the built static assets (`./dist`), it was unable to serve them correctly, forcing us to bypass the proxy entirely.

---

## 4. Remediation Steps (The Solution)

### Strategy: Decoupled Proxy Architecture

We shifted from a single-process "all-in-one" approach to a **Reverse Proxy Pattern**.

- **Vite Role:** Serves as the high-speed frontend asset server. It manages React hot-module replacement and acts as a gateway for WebSocket traffic.
- **Wrangler Role:** Operates as a completely independent background process, hosting the stateful `DesignAgent` (Durable Object) and serving the Edge runtime.
- **Communication Layer:** We configured Vite's `server.proxy` to intercept all WebSocket requests (`/agents`) and tunnel them directly to the Wrangler backend port.

---

## 5. Summary of Permanent Changes

| Component            | Change Implemented                | Reasoning                                                     |
| :------------------- | :-------------------------------- | :------------------------------------------------------------ |
| **`package.json`**   | Added `dev:backend` script        | Enables local binary execution without `dlx`.                 |
| **`wrangler.toml`**  | Added `[assets]` directory path   | Allows Wrangler to serve frontend bundles.                    |
| **`vite.config.ts`** | Removed `@cloudflare/vite-plugin` | Eliminated internal Miniflare version conflicts.              |
| **`vite.config.ts`** | Added `server.proxy` block        | Re-established the handshake between Vite and Wrangler.       |
| **Compatibility**    | Upgraded to `2026-05-01`          | Synchronized local environment with modern platform features. |

---

## 6. Recommendations for Future Revisions

1.  **Maintain Decoupling:** Never re-introduce the `cloudflare()` plugin unless it is strictly required for complex server-side asset rendering that cannot be proxied.
2.  **Keep Environments Isolated:** Always run the backend runtime (`wrangler`) in its own dedicated terminal to ensure console logs for the AI Agent remain clean and readable.
3.  **Port Consistency:** Always treat `8787` (or the configured `dev` port) as the internal backend and `5173` as the public-facing gateway for development.
