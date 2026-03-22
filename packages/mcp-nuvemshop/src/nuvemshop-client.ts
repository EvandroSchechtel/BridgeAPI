/**
 * Nuvemshop API Client
 * @bridgeapi/mcp-nuvemshop
 */

export interface NuvemshopConfig {
  [key: string]: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: number; message: string; details?: unknown };
  meta: { latency_ms: number; endpoint: string; method: string };
}

export interface HookContext {
  tool_name: string;
  params: Record<string, unknown>;
  config: NuvemshopConfig;
  timestamp: string;
}

export interface PreHookResult { allow: boolean; reason?: string; escalation_id?: string; }
export interface PostHookResult { accept: boolean; flags?: string[]; }

export async function preExecuteHook(_ctx: HookContext): Promise<PreHookResult> {
  return { allow: true };
}
export async function postExecuteHook(_ctx: HookContext, _response: ApiResponse): Promise<PostHookResult> {
  return { accept: true };
}

export class NuvemshopClient {
  private config: NuvemshopConfig;
  private baseUrl: string;

  constructor(config: NuvemshopConfig) {
    this.config = config;
    this.baseUrl = "https://api.nuvemshop.com.br/v1";
  }

  async request<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config[Object.keys(this.config)[0]]}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = (await res.json()) as Record<string, unknown>;
      const latency_ms = Date.now() - start;
      if (!res.ok) {
        return { success: false, error: { code: res.status, message: String((data as Record<string,unknown>).message || `HTTP ${res.status}`), details: data }, meta: { latency_ms, endpoint, method } };
      }
      return { success: true, data: data as T, meta: { latency_ms, endpoint, method } };
    } catch (err) {
      return { success: false, error: { code: -1, message: err instanceof Error ? err.message : "Unknown error" }, meta: { latency_ms: Date.now() - start, endpoint, method } };
    }
  }
}
