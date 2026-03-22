/**
 * BridgeAPI Gateway — Post-Execute Hook
 *
 * Phase 1: Always accepts. Logs response for future dataset.
 * Phase 2: Validates response against rules, detects anomalies.
 */

import type { HookContext, PostHookResult, GatewayResponse } from "../lib/types.js";
import { logger } from "../lib/logger.js";

export async function postExecuteHook(
  ctx: HookContext,
  response: GatewayResponse
): Promise<PostHookResult> {
  // Phase 1: log response for dataset, always accept
  logger.debug("post_execute_hook", {
    client_id: ctx.client_id,
    tool_name: ctx.tool_name,
    success: response.success,
    latency_ms: response.meta.latency_ms,
    request_id: ctx.request_id,
  });

  // Phase 2: This function will validate response against rules
  // - Detect anomalies (unusual error patterns, atypical response)
  // - Generate alerts if anomaly detected
  // - Return flags for the response envelope

  return { accept: true };
}
