/**
 * Hotmart API Client
 * Wrapper for Hotmart's REST API (Payments, Subscriptions, Club, Coupons)
 *
 * @bridgeapi/mcp-hotmart
 */

export interface HotmartConfig {
  clientId: string;
  clientSecret: string;
  basicToken: string;
  environment: "production" | "sandbox";
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: number; message: string; details?: unknown };
  meta: { latency_ms: number; endpoint: string; method: string };
}

// ─── PRE/POST HOOK TYPES (Phase 2 ready) ─────────────────────
export interface HookContext {
  tool_name: string;
  params: Record<string, unknown>;
  config: HotmartConfig;
  timestamp: string;
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

// ─── PHASE 1 HOOKS: no-ops that log ──────────────────────────
export async function preExecuteHook(ctx: HookContext): Promise<PreHookResult> {
  // Phase 1: always allow. Log context for future dataset.
  // Phase 2: this function will be replaced by Execution Engine
  void ctx;
  return { allow: true };
}

export async function postExecuteHook(
  ctx: HookContext,
  response: ApiResponse
): Promise<PostHookResult> {
  // Phase 1: always accept. Log response for future dataset.
  // Phase 2: this function will validate response against rules
  void ctx;
  void response;
  return { accept: true };
}

// ─── API CLIENT ──────────────────────────────────────────────

export class HotmartClient {
  private config: HotmartConfig;
  private baseUrl: string;
  private authUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: HotmartConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === "sandbox"
        ? "https://sandbox.hotmart.com/payments/api/v1"
        : "https://developers.hotmart.com/payments/api/v1";
    this.authUrl =
      config.environment === "sandbox"
        ? "https://sandbox.hotmart.com/security/oauth/token"
        : "https://api-sec-vlc.hotmart.com/security/oauth/token";
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s margin)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const res = await fetch(this.authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${this.config.basicToken}`,
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OAuth2 token request failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }

  private async request<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "DELETE" | "PATCH" = "GET",
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const start = Date.now();

    try {
      const token = await this.getAccessToken();

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const latency_ms = Date.now() - start;

      // Some Hotmart endpoints return empty body on success (e.g., DELETE)
      let data: unknown;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = text ? { raw: text } : { status: "ok" };
      }

      if (!res.ok) {
        const err = data as Record<string, unknown>;
        return {
          success: false,
          error: {
            code: (err?.code as number) ?? res.status,
            message:
              (err?.message as string) ?? (err?.error as string) ?? `HTTP ${res.status}`,
            details: data,
          },
          meta: { latency_ms, endpoint, method },
        };
      }

      return {
        success: true,
        data: data as T,
        meta: { latency_ms, endpoint, method },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: -1,
          message: err instanceof Error ? err.message : "Unknown error",
        },
        meta: { latency_ms: Date.now() - start, endpoint, method },
      };
    }
  }

  // ─── SALES ────────────────────────────────────────────

  async getSalesHistory(params?: {
    product_id?: number;
    buyer_email?: string;
    start_date?: number;
    end_date?: number;
    transaction_status?: string;
    max_results?: number;
    page_token?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.product_id) qs.set("product_id", params.product_id.toString());
    if (params?.buyer_email) qs.set("buyer_email", params.buyer_email);
    if (params?.start_date) qs.set("start_date", params.start_date.toString());
    if (params?.end_date) qs.set("end_date", params.end_date.toString());
    if (params?.transaction_status)
      qs.set("transaction_status", params.transaction_status);
    if (params?.max_results)
      qs.set("max_results", params.max_results.toString());
    if (params?.page_token) qs.set("page_token", params.page_token);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/sales/history${query}`);
  }

  async getSaleSummary(transactionCode: string) {
    return this.request(`/sales/summary?transaction=${transactionCode}`);
  }

  async getSaleParticipants(transactionCode: string) {
    return this.request(
      `/sales/users?transaction=${transactionCode}`
    );
  }

  async getCommissions(params?: {
    product_id?: number;
    start_date?: number;
    end_date?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.product_id) qs.set("product_id", params.product_id.toString());
    if (params?.start_date) qs.set("start_date", params.start_date.toString());
    if (params?.end_date) qs.set("end_date", params.end_date.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/sales/commissions${query}`);
  }

  // ─── SUBSCRIPTIONS ────────────────────────────────────

  async getSubscriptions(params?: {
    product_id?: number;
    subscriber_email?: string;
    status?: string;
    max_results?: number;
    page_token?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.product_id) qs.set("product_id", params.product_id.toString());
    if (params?.subscriber_email)
      qs.set("subscriber_email", params.subscriber_email);
    if (params?.status) qs.set("status", params.status);
    if (params?.max_results)
      qs.set("max_results", params.max_results.toString());
    if (params?.page_token) qs.set("page_token", params.page_token);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/subscriptions${query}`);
  }

  async getSubscription(subscriberCode: string) {
    return this.request(
      `/subscriptions?subscriber_code=${subscriberCode}`
    );
  }

  async cancelSubscription(
    subscriberCode: string,
    sendEmail: boolean = true
  ) {
    return this.request(
      `/subscriptions/${subscriberCode}/cancel`,
      "POST",
      { send_email: sendEmail }
    );
  }

  async reactivateSubscription(subscriberCode: string) {
    return this.request(
      `/subscriptions/${subscriberCode}/reactivate`,
      "POST"
    );
  }

  async changeSubscriptionDueDay(subscriberCode: string, dueDay: number) {
    return this.request(
      `/subscriptions/${subscriberCode}/change-due-day`,
      "POST",
      { due_day: dueDay }
    );
  }

  // ─── PRODUCTS ─────────────────────────────────────────

  async getProducts() {
    return this.request(`/products`);
  }

  // ─── CLUB (Area de Membros) ───────────────────────────

  async getModules(productId: string) {
    return this.request(
      `/club/modules?product_id=${productId}`
    );
  }

  async getStudentProgress(productId: string, studentEmail: string) {
    return this.request(
      `/club/students?product_id=${productId}&email=${encodeURIComponent(studentEmail)}`
    );
  }

  // ─── COUPONS ──────────────────────────────────────────

  async getCoupons(productId?: number) {
    const qs = productId ? `?product_id=${productId}` : "";
    return this.request(`/coupons${qs}`);
  }

  async createCoupon(coupon: {
    product_id: number;
    coupon_code: string;
    discount_type: "PERCENTAGE" | "FIXED";
    discount_value: number;
    max_uses?: number;
    valid_until?: string;
  }) {
    return this.request(`/coupons`, "POST", coupon);
  }

  async deleteCoupon(couponId: string) {
    return this.request(`/coupons/${couponId}`, "DELETE");
  }
}
