/**
 * Middleware #2: Rate Limit
 * Check limits per plan via sliding window.
 */

import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../lib/env.js";
import { checkRateLimit } from "../lib/redis.js";

export const rateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const client = c.get("client");
  const requestId = c.get("requestId");

  const result = await checkRateLimit(client.id, client.plan);

  // Set rate limit headers
  c.header("X-RateLimit-Remaining", result.remaining.toString());
  c.header("X-RateLimit-Reset", new Date(result.resetAt).toISOString());

  if (!result.allowed) {
    return c.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: `Rate limit exceeded for plan '${client.plan}'. Try again after ${new Date(result.resetAt).toISOString()}.`,
        },
        meta: {
          request_id: requestId,
          latency_ms: Date.now() - (c.get("startTime") as number),
          confidence_score: null,
          execution_mode: "auto" as const,
          flags: [],
        },
      },
      429
    );
  }

  await next();
});
