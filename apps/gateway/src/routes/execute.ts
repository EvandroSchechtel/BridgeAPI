/**
 * Tool Execution Route
 *
 * POST /v1/execute
 * Body: { connector_type, connector_id, tool_name, params }
 *
 * Full middleware pipeline:
 * authenticate → rate_limit → validate_params → pre_execute → execute → post_execute → log_and_meter
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/env.js";
import { preExecuteHook } from "../hooks/pre-execute.js";
import { postExecuteHook } from "../hooks/post-execute.js";
import { logger } from "../lib/logger.js";
import type {
  GatewayResponse,
  HookContext,
  ToolCallRequest,
} from "../lib/types.js";

const execute = new Hono<AppEnv>();

execute.post("/v1/execute", async (c) => {
  const client = c.get("client");
  const requestId = c.get("requestId");
  const startTime = c.get("startTime");

  let body: ToolCallRequest;
  try {
    body = await c.req.json<ToolCallRequest>();
  } catch {
    return c.json(
      {
        success: false,
        error: { code: "INVALID_REQUEST", message: "Invalid JSON body" },
        meta: { request_id: requestId, latency_ms: Date.now() - startTime, confidence_score: null, execution_mode: "auto" as const, flags: [] },
      },
      400
    );
  }

  const { connector_type, connector_id, tool_name, params } = body;

  if (!connector_type || !tool_name) {
    return c.json(
      {
        success: false,
        error: { code: "MISSING_PARAMS", message: "connector_type and tool_name are required" },
        meta: { request_id: requestId, latency_ms: Date.now() - startTime, confidence_score: null, execution_mode: "auto" as const, flags: [] },
      },
      400
    );
  }

  // ─── BUILD HOOK CONTEXT ───────────────────────────────
  const hookCtx: HookContext = {
    client_id: client.id,
    connector_id: connector_id || "",
    connector_type,
    tool_name,
    params: params || {},
    timestamp: new Date().toISOString(),
    request_id: requestId,
  };

  // ─── STEP 4: PRE-EXECUTE HOOK ────────────────────────
  const preResult = await preExecuteHook(hookCtx);

  if (!preResult.allow) {
    const response: GatewayResponse = {
      success: false,
      error: {
        code: "BLOCKED",
        message: preResult.reason || "Blocked by execution policy",
      },
      meta: {
        request_id: requestId,
        latency_ms: Date.now() - startTime,
        confidence_score: null,
        execution_mode: "escalated",
        flags: [],
      },
    };

    logger.info("tool_call_blocked", {
      client_id: client.id,
      tool_name,
      reason: preResult.reason,
      escalation_id: preResult.escalation_id,
    });

    return c.json(response, 403);
  }

  // ─── STEP 5: EXECUTE ─────────────────────────────────
  // Phase 1: Placeholder execution.
  // In production, this routes to the actual connector (WhatsApp, Hotmart, etc.)
  const executeStart = Date.now();
  let executeResult: { success: boolean; data?: unknown; error?: { code: number; message: string }; statusCode: number };

  try {
    // TODO: Route to actual connector based on connector_type
    // For now, return a placeholder response
    executeResult = {
      success: true,
      data: {
        message: `Tool '${tool_name}' executed on connector '${connector_type}'`,
        params,
      },
      statusCode: 200,
    };
  } catch (err) {
    executeResult = {
      success: false,
      error: {
        code: 500,
        message: err instanceof Error ? err.message : "Unknown execution error",
      },
      statusCode: 500,
    };
  }

  const executeLatency = Date.now() - executeStart;

  // ─── BUILD RESPONSE ──────────────────────────────────
  const response: GatewayResponse = {
    success: executeResult.success,
    ...(executeResult.data ? { data: executeResult.data } : {}),
    ...(executeResult.error
      ? {
          error: {
            code: executeResult.error.code.toString(),
            message: executeResult.error.message,
          },
        }
      : {}),
    meta: {
      request_id: requestId,
      latency_ms: Date.now() - startTime,
      confidence_score: null,
      execution_mode: "auto",
      flags: [],
    },
  };

  // ─── STEP 6: POST-EXECUTE HOOK ───────────────────────
  const postResult = await postExecuteHook(hookCtx, response);
  response.meta.flags = postResult.flags || [];

  // ─── STEP 7: LOG AND METER ───────────────────────────
  logger.info("tool_call", {
    client_id: client.id,
    connector_type,
    connector_id,
    tool_name,
    success: executeResult.success,
    status_code: executeResult.statusCode,
    latency_ms: executeLatency,
    request_id: requestId,
  });

  // TODO: Save to tool_calls table via Prisma
  // TODO: Increment daily_metrics counters

  return c.json(response, executeResult.statusCode as 200);
});

export { execute };
