/**
 * Nuvemshop API Client
 * Wrapper for Nuvemshop/Tiendanube REST API
 * (Products, Orders, Customers, Categories, Coupons, Store)
 *
 * @bridgeapi/mcp-nuvemshop
 */

// ─── CONFIG ──────────────────────────────────────────────────

export interface NuvemshopConfig {
  accessToken: string;
  userId: string;
}

// ─── RESPONSE TYPES ──────────────────────────────────────────

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
  config: NuvemshopConfig;
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

export class NuvemshopClient {
  private config: NuvemshopConfig;
  private baseUrl: string;

  constructor(config: NuvemshopConfig) {
    this.config = config;
    this.baseUrl = `https://api.nuvemshop.com.br/v1/${config.userId}`;
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
          "Content-Type": "application/json",
          Authentication: `bearer ${this.config.accessToken}`,
          "User-Agent": "BridgeAPI MCP Nuvemshop/0.1.0",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const latency_ms = Date.now() - start;

      // Some Nuvemshop endpoints return empty body on DELETE
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
              (err?.message as string) ??
              (err?.description as string) ??
              `HTTP ${res.status}`,
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

  // ─── PRODUCTS ──────────────────────────────────────────

  async getProducts(params?: {
    page?: number;
    per_page?: number;
    since_id?: number;
    created_at_min?: string;
    created_at_max?: string;
    updated_at_min?: string;
    updated_at_max?: string;
    published?: boolean;
    free_shipping?: boolean;
  }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", params.page.toString());
    if (params?.per_page) qs.set("per_page", params.per_page.toString());
    if (params?.since_id) qs.set("since_id", params.since_id.toString());
    if (params?.created_at_min) qs.set("created_at_min", params.created_at_min);
    if (params?.created_at_max) qs.set("created_at_max", params.created_at_max);
    if (params?.updated_at_min) qs.set("updated_at_min", params.updated_at_min);
    if (params?.updated_at_max) qs.set("updated_at_max", params.updated_at_max);
    if (params?.published !== undefined) qs.set("published", String(params.published));
    if (params?.free_shipping !== undefined) qs.set("free_shipping", String(params.free_shipping));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/products${query}`);
  }

  async getProduct(productId: number) {
    return this.request(`/products/${productId}`);
  }

  async createProduct(data: Record<string, unknown>) {
    return this.request("/products", "POST", data);
  }

  async updateProduct(productId: number, data: Record<string, unknown>) {
    return this.request(`/products/${productId}`, "PUT", data);
  }

  async deleteProduct(productId: number) {
    return this.request(`/products/${productId}`, "DELETE");
  }

  // ─── PRODUCT VARIANTS ──────────────────────────────────

  async getProductVariants(productId: number) {
    return this.request(`/products/${productId}/variants`);
  }

  async createProductVariant(productId: number, data: Record<string, unknown>) {
    return this.request(`/products/${productId}/variants`, "POST", data);
  }

  // ─── ORDERS ────────────────────────────────────────────

  async getOrders(params?: {
    page?: number;
    per_page?: number;
    since_id?: number;
    status?: string;
    created_at_min?: string;
    created_at_max?: string;
    updated_at_min?: string;
    updated_at_max?: string;
    payment_status?: string;
    shipping_status?: string;
    q?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", params.page.toString());
    if (params?.per_page) qs.set("per_page", params.per_page.toString());
    if (params?.since_id) qs.set("since_id", params.since_id.toString());
    if (params?.status) qs.set("status", params.status);
    if (params?.created_at_min) qs.set("created_at_min", params.created_at_min);
    if (params?.created_at_max) qs.set("created_at_max", params.created_at_max);
    if (params?.updated_at_min) qs.set("updated_at_min", params.updated_at_min);
    if (params?.updated_at_max) qs.set("updated_at_max", params.updated_at_max);
    if (params?.payment_status) qs.set("payment_status", params.payment_status);
    if (params?.shipping_status) qs.set("shipping_status", params.shipping_status);
    if (params?.q) qs.set("q", params.q);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/orders${query}`);
  }

  async getOrder(orderId: number) {
    return this.request(`/orders/${orderId}`);
  }

  async updateOrder(orderId: number, data: Record<string, unknown>) {
    return this.request(`/orders/${orderId}`, "PUT", data);
  }

  async closeOrder(orderId: number) {
    return this.request(`/orders/${orderId}/close`, "POST");
  }

  async cancelOrder(orderId: number, data?: Record<string, unknown>) {
    return this.request(`/orders/${orderId}/cancel`, "POST", data);
  }

  // ─── CUSTOMERS ─────────────────────────────────────────

  async getCustomers(params?: {
    page?: number;
    per_page?: number;
    since_id?: number;
    created_at_min?: string;
    created_at_max?: string;
    updated_at_min?: string;
    updated_at_max?: string;
    q?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", params.page.toString());
    if (params?.per_page) qs.set("per_page", params.per_page.toString());
    if (params?.since_id) qs.set("since_id", params.since_id.toString());
    if (params?.created_at_min) qs.set("created_at_min", params.created_at_min);
    if (params?.created_at_max) qs.set("created_at_max", params.created_at_max);
    if (params?.updated_at_min) qs.set("updated_at_min", params.updated_at_min);
    if (params?.updated_at_max) qs.set("updated_at_max", params.updated_at_max);
    if (params?.q) qs.set("q", params.q);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/customers${query}`);
  }

  async getCustomer(customerId: number) {
    return this.request(`/customers/${customerId}`);
  }

  async createCustomer(data: Record<string, unknown>) {
    return this.request("/customers", "POST", data);
  }

  // ─── CATEGORIES ────────────────────────────────────────

  async getCategories(params?: {
    page?: number;
    per_page?: number;
    since_id?: number;
    created_at_min?: string;
    created_at_max?: string;
    updated_at_min?: string;
    updated_at_max?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", params.page.toString());
    if (params?.per_page) qs.set("per_page", params.per_page.toString());
    if (params?.since_id) qs.set("since_id", params.since_id.toString());
    if (params?.created_at_min) qs.set("created_at_min", params.created_at_min);
    if (params?.created_at_max) qs.set("created_at_max", params.created_at_max);
    if (params?.updated_at_min) qs.set("updated_at_min", params.updated_at_min);
    if (params?.updated_at_max) qs.set("updated_at_max", params.updated_at_max);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/categories${query}`);
  }

  async createCategory(data: Record<string, unknown>) {
    return this.request("/categories", "POST", data);
  }

  // ─── COUPONS ───────────────────────────────────────────

  async getCoupons(params?: {
    page?: number;
    per_page?: number;
    since_id?: number;
    created_at_min?: string;
    created_at_max?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", params.page.toString());
    if (params?.per_page) qs.set("per_page", params.per_page.toString());
    if (params?.since_id) qs.set("since_id", params.since_id.toString());
    if (params?.created_at_min) qs.set("created_at_min", params.created_at_min);
    if (params?.created_at_max) qs.set("created_at_max", params.created_at_max);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/coupons${query}`);
  }

  async createCoupon(data: Record<string, unknown>) {
    return this.request("/coupons", "POST", data);
  }

  async deleteCoupon(couponId: number) {
    return this.request(`/coupons/${couponId}`, "DELETE");
  }

  // ─── STORE ─────────────────────────────────────────────

  async getStore() {
    return this.request("/store");
  }

  async updateStore(data: Record<string, unknown>) {
    return this.request("/store", "PUT", data);
  }
}
