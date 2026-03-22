/**
 * Middleware #1: Authenticate
 * Validates API key, identifies client, loads config.
 */

import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../lib/env.js";
import type { ClientContext } from "../lib/types.js";
import { logger } from "../lib/logger.js";

// In-memory API key store for development
// Production: query from database via Prisma
const DEV_CLIENTS = new Map<string, ClientContext>();

export function seedDevClient(apiKey: string, client: ClientContext) {
  DEV_CLIENTS.set(apiKey, client);
}

export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!apiKey) {
    return c.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing API key. Provide Authorization: Bearer <key>" },
        meta: { request_id: crypto.randomUUID(), latency_ms: 0, confidence_score: null, execution_mode: "auto" as const, flags: [] },
      },
      401
    );
  }

  // Look up client by API key
  // Phase 1: in-memory for dev, Prisma query in production
  const client = DEV_CLIENTS.get(apiKey);

  if (!client) {
    // Try database lookup if Prisma is available
    logger.warn("auth_failed", { reason: "invalid_api_key" });
    return c.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid API key" },
        meta: { request_id: crypto.randomUUID(), latency_ms: 0, confidence_score: null, execution_mode: "auto" as const, flags: [] },
      },
      401
    );
  }

  // Set client context for downstream middleware
  c.set("client", client);
  c.set("requestId", crypto.randomUUID());
  c.set("startTime", Date.now());

  logger.debug("authenticated", { client_id: client.id, plan: client.plan });

  await next();
});
