/**
 * Shopify Admin API Client
 * Wrapper for Shopify's REST Admin API (Products, Orders, Customers, Inventory, Collections, Discounts)
 *
 * @bridgeapi/mcp-shopify
 */

export interface ShopifyConfig {
  storeUrl: string;
  accessToken: string;
  apiVersion: string;
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
  config: ShopifyConfig;
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
  void ctx;
  return { allow: true };
}

export async function postExecuteHook(
  ctx: HookContext,
  response: ApiResponse
): Promise<PostHookResult> {
  void ctx;
  void response;
  return { accept: true };
}

// ─── API CLIENT ──────────────────────────────────────────────

export class ShopifyClient {
  private config: ShopifyConfig;
  private baseUrl: string;

  constructor(config: ShopifyConfig) {
    this.config = config;
    // Strip trailing slash from storeUrl
    const store = config.storeUrl.replace(/\/+$/, "");
    this.baseUrl = `https://${store}/admin/api/${config.apiVersion}`;
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
          "X-Shopify-Access-Token": this.config.accessToken,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const latency_ms = Date.now() - start;

      // Some Shopify endpoints return empty body on DELETE
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
            code: res.status,
            message:
              (err?.errors as string) ??
              (err?.error as string) ??
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
    limit?: number;
    page_info?: string;
    status?: string;
    collection_id?: string;
    product_type?: string;
    vendor?: string;
    title?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.page_info) qs.set("page_info", params.page_info);
    if (params?.status) qs.set("status", params.status);
    if (params?.collection_id) qs.set("collection_id", params.collection_id);
    if (params?.product_type) qs.set("product_type", params.product_type);
    if (params?.vendor) qs.set("vendor", params.vendor);
    if (params?.title) qs.set("title", params.title);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/products.json${query}`);
  }

  async getProduct(productId: string) {
    return this.request(`/products/${productId}.json`);
  }

  async createProduct(product: Record<string, unknown>) {
    return this.request("/products.json", "POST", { product });
  }

  async updateProduct(productId: string, product: Record<string, unknown>) {
    return this.request(`/products/${productId}.json`, "PUT", { product });
  }

  async deleteProduct(productId: string) {
    return this.request(`/products/${productId}.json`, "DELETE");
  }

  async getProductVariants(productId: string, params?: { limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", params.limit.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/products/${productId}/variants.json${query}`);
  }

  // ─── ORDERS ────────────────────────────────────────────

  async getOrders(params?: {
    limit?: number;
    status?: string;
    financial_status?: string;
    fulfillment_status?: string;
    created_at_min?: string;
    created_at_max?: string;
    since_id?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.status) qs.set("status", params.status);
    if (params?.financial_status) qs.set("financial_status", params.financial_status);
    if (params?.fulfillment_status) qs.set("fulfillment_status", params.fulfillment_status);
    if (params?.created_at_min) qs.set("created_at_min", params.created_at_min);
    if (params?.created_at_max) qs.set("created_at_max", params.created_at_max);
    if (params?.since_id) qs.set("since_id", params.since_id);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/orders.json${query}`);
  }

  async getOrder(orderId: string) {
    return this.request(`/orders/${orderId}.json`);
  }

  async closeOrder(orderId: string) {
    return this.request(`/orders/${orderId}/close.json`, "POST");
  }

  async cancelOrder(orderId: string, params?: {
    reason?: string;
    email?: boolean;
    restock?: boolean;
  }) {
    return this.request(`/orders/${orderId}/cancel.json`, "POST", params || {});
  }

  // ─── FULFILLMENTS ──────────────────────────────────────

  async createFulfillment(fulfillment: Record<string, unknown>) {
    return this.request("/fulfillments.json", "POST", { fulfillment });
  }

  // ─── CUSTOMERS ─────────────────────────────────────────

  async getCustomers(params?: {
    limit?: number;
    since_id?: string;
    created_at_min?: string;
    created_at_max?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.since_id) qs.set("since_id", params.since_id);
    if (params?.created_at_min) qs.set("created_at_min", params.created_at_min);
    if (params?.created_at_max) qs.set("created_at_max", params.created_at_max);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/customers.json${query}`);
  }

  async getCustomer(customerId: string) {
    return this.request(`/customers/${customerId}.json`);
  }

  async createCustomer(customer: Record<string, unknown>) {
    return this.request("/customers.json", "POST", { customer });
  }

  async searchCustomers(query: string) {
    const qs = new URLSearchParams({ query });
    return this.request(`/customers/search.json?${qs.toString()}`);
  }

  // ─── INVENTORY ─────────────────────────────────────────

  async getInventoryLevels(params: {
    inventory_item_ids?: string;
    location_ids?: string;
    limit?: number;
  }) {
    const qs = new URLSearchParams();
    if (params.inventory_item_ids) qs.set("inventory_item_ids", params.inventory_item_ids);
    if (params.location_ids) qs.set("location_ids", params.location_ids);
    if (params.limit) qs.set("limit", params.limit.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/inventory_levels.json${query}`);
  }

  async setInventoryLevel(params: {
    inventory_item_id: number;
    location_id: number;
    available: number;
  }) {
    return this.request("/inventory_levels/set.json", "POST", params);
  }

  async getLocations() {
    return this.request("/locations.json");
  }

  // ─── COLLECTIONS ───────────────────────────────────────

  async getCollections(params?: {
    limit?: number;
    since_id?: string;
    title?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.since_id) qs.set("since_id", params.since_id);
    if (params?.title) qs.set("title", params.title);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/custom_collections.json${query}`);
  }

  async createCollection(collection: Record<string, unknown>) {
    return this.request("/custom_collections.json", "POST", { custom_collection: collection });
  }

  // ─── PRICE RULES & DISCOUNTS ───────────────────────────

  async getPriceRules(params?: {
    limit?: number;
    since_id?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.since_id) qs.set("since_id", params.since_id);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/price_rules.json${query}`);
  }

  async createPriceRule(priceRule: Record<string, unknown>) {
    return this.request("/price_rules.json", "POST", { price_rule: priceRule });
  }

  async createDiscountCode(priceRuleId: string, code: string) {
    return this.request(
      `/price_rules/${priceRuleId}/discount_codes.json`,
      "POST",
      { discount_code: { code } }
    );
  }

  // ─── SHOP ──────────────────────────────────────────────

  async getShop() {
    return this.request("/shop.json");
  }
}
