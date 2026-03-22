/**
 * BridgeAPI Gateway — Main Server
 *
 * API gateway with middleware pipeline for MCP connectors.
 * Phase 1: Auth, rate limiting, structured logging, pre/post hooks (no-ops).
 * Phase 2: Execution Engine plugs into the hooks.
 *
 * Middleware Pipeline (Chain of Responsibility):
 * 1. authenticate  — validate API key, identify client
 * 2. rate_limit    — check limits per plan
 * 3. validate      — validate tool call params
 * 4. pre_execute   — HOOK (Phase 1: no-op + log)
 * 5. execute       — call platform API
 * 6. post_execute  — HOOK (Phase 1: no-op + log)
 * 7. log_and_meter — save to DB, increment counters
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./lib/env.js";
import { authenticate, seedDevClient } from "./middleware/authenticate.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { health } from "./routes/health.js";
import { execute } from "./routes/execute.js";
import { logger } from "./lib/logger.js";

const app = new Hono<AppEnv>();

// ─── GLOBAL MIDDLEWARE ──────────────────────────────────────
app.use("*", cors());

// ─── PUBLIC ROUTES (no auth) ────────────────────────────────
app.route("/", health);

// ─── PROTECTED ROUTES (auth + rate limit) ───────────────────
app.use("/v1/*", authenticate);
app.use("/v1/*", rateLimit);
app.route("/", execute);

// ─── 404 HANDLER ────────────────────────────────────────────
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: { code: "NOT_FOUND", message: `Route ${c.req.method} ${c.req.path} not found` },
      meta: { request_id: crypto.randomUUID(), latency_ms: 0, confidence_score: null, execution_mode: "auto" as const, flags: [] },
    },
    404
  );
});

// ─── ERROR HANDLER ──────────────────────────────────────────
app.onError((err, c) => {
  logger.error("unhandled_error", { message: err.message, stack: err.stack });
  return c.json(
    {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      meta: { request_id: crypto.randomUUID(), latency_ms: 0, confidence_score: null, execution_mode: "auto" as const, flags: [] },
    },
    500
  );
});

// ─── START SERVER ───────────────────────────────────────────

const port = parseInt(process.env.PORT || "3001", 10);

// Seed a dev client for testing
seedDevClient("dev-test-key", {
  id: "dev-client-001",
  name: "Dev Test Client",
  email: "dev@bridgeapi.com.br",
  plan: "pro",
  config: {},
});

import { serve } from "@hono/node-server";

serve({ fetch: app.fetch, port }, () => {
  logger.info("gateway_started", { port, version: "0.1.0" });
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║  BridgeAPI Gateway v0.1.0                    ║
  ║  Running on http://localhost:${port}            ║
  ║                                              ║
  ║  Health:  GET  /health                       ║
  ║  Execute: POST /v1/execute                   ║
  ║                                              ║
  ║  Dev API key: dev-test-key                   ║
  ╚══════════════════════════════════════════════╝
  `);
});

export default app;
