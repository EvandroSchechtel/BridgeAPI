/**
 * BridgeAPI Gateway — Shared Types
 */

// ─── Response Envelope ──────────────────────────────────────
export interface GatewayResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    request_id: string;
    latency_ms: number;
    // Phase 2 fields (null in Phase 1)
    confidence_score: number | null;
    execution_mode: "auto" | "escalated" | "pending";
    flags: string[];
  };
}

// ─── Hook Types ─────────────────────────────────────────────
export interface HookContext {
  client_id: string;
  connector_id: string;
  connector_type: string;
  tool_name: string;
  params: Record<string, unknown>;
  timestamp: string;
  request_id: string;
}

export interface PreHookResult {
  allow: boolean;
  reason?: string;
  escalation_id?: string;
}

export interface PostHookResult {
  accept: boolean;
  flags?: string[];
}

// ─── Middleware Context ─────────────────────────────────────
export interface ClientContext {
  id: string;
  name: string;
  email: string;
  plan: string;
  config: Record<string, unknown>;
}

export interface ToolCallRequest {
  connector_type: string;
  connector_id: string;
  tool_name: string;
  params: Record<string, unknown>;
}

// ─── Connector Registry ─────────────────────────────────────
export interface ConnectorDefinition {
  type: string;
  tools: string[];
  validateParams: (toolName: string, params: Record<string, unknown>) => boolean;
  execute: (toolName: string, params: Record<string, unknown>, credentials: Record<string, unknown>) => Promise<{
    success: boolean;
    data?: unknown;
    error?: { code: number; message: string };
    statusCode: number;
    latencyMs: number;
  }>;
}
