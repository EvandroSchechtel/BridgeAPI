/**
 * Eduzz API Client
 * Wrapper for Eduzz's REST API (Brazilian digital products platform)
 *
 * @bridgeapi/mcp-eduzz
 */

export interface EduzzConfig {
  apiKey: string;
  publicKey: string;
  email: string;
  apiVersion: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: number; message: string; details?: unknown };
  meta: { latency_ms: number; endpoint: string; method: string };
}

// --- PRE/POST HOOK TYPES (Phase 2 ready) -----------------
export interface HookContext {
  tool_name: string;
  params: Record<string, unknown>;
  config: EduzzConfig;
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

// --- PHASE 1 HOOKS: no-ops that log ----------------------
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

// --- API CLIENT ------------------------------------------

export class EduzzClient {
  private baseUrl: string;
  private config: EduzzConfig;
  private token: string | null = null;

  constructor(config: EduzzConfig) {
    this.config = config;
    this.baseUrl = "https://api2.eduzz.com";
  }

  private generateToken(): string {
    // Eduzz uses API key + public key + email for authentication
    // The token is generated from these credentials
    if (!this.token) {
      this.token = Buffer.from(
        `${this.config.email}:${this.config.apiKey}:${this.config.publicKey}`
      ).toString("base64");
    }
    return this.token;
  }

  private async request<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const start = Date.now();

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.generateToken()}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const data = (await res.json()) as Record<string, unknown>;
      const latency_ms = Date.now() - start;

      if (!res.ok) {
        const err = data as { code?: number; message?: string; details?: unknown };
        return {
          success: false,
          error: {
            code: err?.code ?? res.status,
            message: err?.message ?? `HTTP ${res.status}`,
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

  // --- SALES ---------------------------------------------

  async getSales(params?: {
    start_date?: string;
    end_date?: string;
    status?: string;
    product_id?: number;
    page?: number;
    page_size?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.start_date) qs.set("start_date", params.start_date);
    if (params?.end_date) qs.set("end_date", params.end_date);
    if (params?.status) qs.set("status", params.status);
    if (params?.product_id) qs.set("product_id", params.product_id.toString());
    if (params?.page) qs.set("page", params.page.toString());
    if (params?.page_size) qs.set("page_size", params.page_size.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/sale/get_sale_list${query}`);
  }

  async getSaleDetails(saleId: number) {
    return this.request(`/sale/get_sale/${saleId}`);
  }

  async requestRefund(saleId: number, reason: string) {
    return this.request(`/sale/refund`, "POST", {
      sale_id: saleId,
      reason,
    });
  }

  // --- PRODUCTS ------------------------------------------

  async getProducts(params?: { page?: number; page_size?: number }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", params.page.toString());
    if (params?.page_size) qs.set("page_size", params.page_size.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/product/get_product_list${query}`);
  }

  async getProductDetails(productId: number) {
    return this.request(`/product/get_product/${productId}`);
  }

  // --- SUBSCRIPTIONS -------------------------------------

  async getSubscriptions(params?: {
    status?: string;
    product_id?: number;
    page?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.product_id) qs.set("product_id", params.product_id.toString());
    if (params?.page) qs.set("page", params.page.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/subscription/get_subscription_list${query}`);
  }

  async cancelSubscription(subscriptionId: number, reason?: string) {
    return this.request(`/subscription/cancel`, "POST", {
      subscription_id: subscriptionId,
      ...(reason ? { reason } : {}),
    });
  }

  // --- CONTRACTS -----------------------------------------

  async getContracts(params?: { status?: string; page?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", params.page.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/contract/get_contract_list${query}`);
  }

  // --- AFFILIATES ----------------------------------------

  async getMyAffiliates(params?: { product_id?: number; page?: number }) {
    const qs = new URLSearchParams();
    if (params?.product_id) qs.set("product_id", params.product_id.toString());
    if (params?.page) qs.set("page", params.page.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/affiliate/get_affiliate_list${query}`);
  }

  async getAffiliateProducts(params?: { page?: number }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", params.page.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/affiliate/get_product_list${query}`);
  }

  // --- FINANCIAL -----------------------------------------

  async getFinancialStatement(params: {
    start_date: string;
    end_date: string;
    page?: number;
  }) {
    const qs = new URLSearchParams();
    qs.set("start_date", params.start_date);
    qs.set("end_date", params.end_date);
    if (params.page) qs.set("page", params.page.toString());
    return this.request(`/financial/get_statement?${qs.toString()}`);
  }

  async getBalance() {
    return this.request(`/financial/get_balance`);
  }

  // --- COUPONS -------------------------------------------

  async getCoupons(params?: { product_id?: number }) {
    const qs = new URLSearchParams();
    if (params?.product_id) qs.set("product_id", params.product_id.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/coupon/get_coupon_list${query}`);
  }

  async createCoupon(coupon: {
    product_id: number;
    coupon_code: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    quantity?: number;
    valid_until?: string;
  }) {
    return this.request(`/coupon/create_coupon`, "POST", coupon);
  }
}
