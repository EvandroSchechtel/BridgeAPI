/**
 * TikTok Shop API Client
 * Wrapper for TikTok Shop Open API (Products, Orders, Fulfillment, Inventory, Returns)
 *
 * Auth: HMAC-SHA256 signature per request
 * Docs: https://partner.tiktokshop.com/docv2/page/6503775ad40fa302db1b8fe0
 *
 * @bridgeapi/mcp-tiktok-shop
 */

import { createHmac } from "node:crypto";

// ─── CONFIG & RESPONSE TYPES ────────────────────────────────

export interface TikTokShopConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  shopId: string;
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
  config: TikTokShopConfig;
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

// ─── PHASE 1 HOOKS: no-ops ──────────────────────────────────

export async function preExecuteHook(_ctx: HookContext): Promise<PreHookResult> {
  return { allow: true };
}

export async function postExecuteHook(
  _ctx: HookContext,
  _response: ApiResponse
): Promise<PostHookResult> {
  return { accept: true };
}

// ─── API CLIENT ──────────────────────────────────────────────

export class TikTokShopClient {
  private config: TikTokShopConfig;
  private baseUrl = "https://open-api.tiktokglobalshop.com";

  constructor(config: TikTokShopConfig) {
    this.config = config;
  }

  /**
   * Generate HMAC-SHA256 signature for TikTok Shop API requests.
   *
   * Algorithm:
   * 1. Sort all query params (except sign, access_token) alphabetically by key
   * 2. Concatenate: app_secret + path + sorted_key_value_pairs + app_secret
   * 3. HMAC-SHA256 with app_secret as key
   */
  private generateSignature(
    path: string,
    params: Record<string, string>
  ): string {
    const signingParams = { ...params };
    delete signingParams["sign"];
    delete signingParams["access_token"];

    const sortedKeys = Object.keys(signingParams).sort();
    const paramString = sortedKeys
      .map((key) => `${key}${signingParams[key]}`)
      .join("");

    const baseString = `${this.config.appSecret}${path}${paramString}${this.config.appSecret}`;

    return createHmac("sha256", this.config.appSecret)
      .update(baseString)
      .digest("hex");
  }

  /**
   * Execute an authenticated request to the TikTok Shop API.
   */
  private async request<T = unknown>(
    path: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown,
    extraParams?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const start = Date.now();
    const timestamp = Math.floor(Date.now() / 1000).toString();

    try {
      const params: Record<string, string> = {
        app_key: this.config.appKey,
        timestamp,
        shop_id: this.config.shopId,
        ...extraParams,
      };

      const sign = this.generateSignature(path, params);
      params["sign"] = sign;
      params["access_token"] = this.config.accessToken;

      const qs = new URLSearchParams(params).toString();
      const url = `${this.baseUrl}${path}?${qs}`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const res = await fetch(url, {
        method,
        headers,
        ...(body && method !== "GET" ? { body: JSON.stringify(body) } : {}),
      });

      const latency_ms = Date.now() - start;

      let data: unknown;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = text ? { raw: text } : { status: "ok" };
      }

      const responseData = data as Record<string, unknown>;
      const apiCode = responseData?.code as number | undefined;

      if (!res.ok || (apiCode !== undefined && apiCode !== 0)) {
        return {
          success: false,
          error: {
            code: apiCode ?? res.status,
            message:
              (responseData?.message as string) ?? `HTTP ${res.status}`,
            details: data,
          },
          meta: { latency_ms, endpoint: path, method },
        };
      }

      return {
        success: true,
        data: (responseData?.data ?? data) as T,
        meta: { latency_ms, endpoint: path, method },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: -1,
          message: err instanceof Error ? err.message : "Unknown error",
        },
        meta: { latency_ms: Date.now() - start, endpoint: path, method },
      };
    }
  }

  // ─── PRODUCTS ──────────────────────────────────────────

  async getProducts(params?: {
    page_size?: number;
    page_number?: number;
    search_status?: number;
  }): Promise<ApiResponse> {
    return this.request("/api/products/search", "POST", {
      page_size: params?.page_size ?? 20,
      ...(params?.page_number !== undefined
        ? { page_number: params.page_number }
        : {}),
      ...(params?.search_status !== undefined
        ? { search_status: params.search_status }
        : {}),
    });
  }

  async getProduct(productId: string): Promise<ApiResponse> {
    return this.request("/api/products/details", "GET", undefined, {
      product_id: productId,
    });
  }

  async createProduct(
    productData: Record<string, unknown>
  ): Promise<ApiResponse> {
    return this.request("/api/products", "POST", productData);
  }

  async updateProduct(
    productId: string,
    productData: Record<string, unknown>
  ): Promise<ApiResponse> {
    return this.request("/api/products", "PUT", {
      product_id: productId,
      ...productData,
    });
  }

  async deactivateProduct(productIds: string[]): Promise<ApiResponse> {
    return this.request("/api/products/deactivated_products", "POST", {
      product_ids: productIds,
    });
  }

  async activateProduct(productIds: string[]): Promise<ApiResponse> {
    return this.request("/api/products/activate", "POST", {
      product_ids: productIds,
    });
  }

  // ─── ORDERS ────────────────────────────────────────────

  async getOrders(params?: {
    order_status?: number;
    page_size?: number;
    cursor?: string;
    create_time_from?: number;
    create_time_to?: number;
    sort_by?: string;
    sort_type?: number;
  }): Promise<ApiResponse> {
    return this.request("/api/orders/search", "POST", {
      page_size: params?.page_size ?? 20,
      ...(params?.order_status !== undefined
        ? { order_status: params.order_status }
        : {}),
      ...(params?.cursor ? { cursor: params.cursor } : {}),
      ...(params?.create_time_from
        ? { create_time_from: params.create_time_from }
        : {}),
      ...(params?.create_time_to
        ? { create_time_to: params.create_time_to }
        : {}),
      ...(params?.sort_by ? { sort_by: params.sort_by } : {}),
      ...(params?.sort_type !== undefined
        ? { sort_type: params.sort_type }
        : {}),
    });
  }

  async getOrder(orderIds: string[]): Promise<ApiResponse> {
    return this.request("/api/orders/detail/query", "POST", {
      order_id_list: orderIds,
    });
  }

  async shipOrder(shipment: {
    order_id: string;
    pick_up_type?: number;
    shipping_provider_id?: string;
    tracking_number?: string;
  }): Promise<ApiResponse> {
    return this.request(
      "/api/fulfillment/ship_package",
      "POST",
      shipment
    );
  }

  async getOrderPackages(orderId: string): Promise<ApiResponse> {
    return this.request(
      "/api/fulfillment/order_packages",
      "GET",
      undefined,
      { order_id: orderId }
    );
  }

  // ─── CATEGORIES ────────────────────────────────────────

  async getCategories(): Promise<ApiResponse> {
    return this.request("/api/products/categories");
  }

  async getCategoryAttributes(categoryId: string): Promise<ApiResponse> {
    return this.request("/api/products/attributes", "GET", undefined, {
      category_id: categoryId,
    });
  }

  // ─── SHOP ──────────────────────────────────────────────

  async getShopInfo(): Promise<ApiResponse> {
    return this.request("/api/shop/get_authorized_shop");
  }

  async getSellerPerformance(): Promise<ApiResponse> {
    return this.request("/api/shop/performance");
  }

  // ─── WAREHOUSE / INVENTORY ─────────────────────────────

  async getWarehouse(): Promise<ApiResponse> {
    return this.request("/api/fulfillment/warehouse_list");
  }

  async updateInventory(inventory: {
    product_id: string;
    sku_id: string;
    warehouse_id: string;
    quantity: number;
  }): Promise<ApiResponse> {
    return this.request("/api/products/stocks", "PUT", {
      product_id: inventory.product_id,
      skus: [
        {
          id: inventory.sku_id,
          warehouse_quantities: [
            {
              warehouse_id: inventory.warehouse_id,
              quantity: inventory.quantity,
            },
          ],
        },
      ],
    });
  }

  // ─── RETURNS ───────────────────────────────────────────

  async getReturnOrders(params?: {
    page_size?: number;
    cursor?: string;
    status?: number;
    create_time_from?: number;
    create_time_to?: number;
  }): Promise<ApiResponse> {
    return this.request("/api/reverse/reverse_order/list", "POST", {
      page_size: params?.page_size ?? 20,
      ...(params?.cursor ? { cursor: params.cursor } : {}),
      ...(params?.status !== undefined ? { status: params.status } : {}),
      ...(params?.create_time_from
        ? { create_time_from: params.create_time_from }
        : {}),
      ...(params?.create_time_to
        ? { create_time_to: params.create_time_to }
        : {}),
    });
  }

  async approveReturn(
    returnId: string,
    decision: "ACCEPT" | "REJECT",
    reason?: string
  ): Promise<ApiResponse> {
    return this.request("/api/reverse/reverse_request/confirm", "POST", {
      reverse_order_id: returnId,
      decision,
      ...(reason ? { reason } : {}),
    });
  }
}
