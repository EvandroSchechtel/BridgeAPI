/**
 * Temu API Client
 * @bridgeapi/mcp-temu
 *
 * HMAC-SHA256 signed requests against Temu Open Platform.
 * Base URL: https://openapi.temupay.com
 */

import { createHmac } from "node:crypto";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface TemuConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  shopId: string;
}

// ─── Response / Hook types ───────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: number; message: string; details?: unknown };
  meta: { latency_ms: number; endpoint: string; method: string };
}

export interface HookContext {
  tool_name: string;
  params: Record<string, unknown>;
  config: TemuConfig;
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

export async function preExecuteHook(
  _ctx: HookContext,
): Promise<PreHookResult> {
  return { allow: true };
}
export async function postExecuteHook(
  _ctx: HookContext,
  _response: ApiResponse,
): Promise<PostHookResult> {
  return { accept: true };
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class TemuClient {
  private config: TemuConfig;
  private baseUrl: string;

  constructor(config: TemuConfig) {
    this.config = config;
    this.baseUrl = "https://openapi.temupay.com";
  }

  // ── Signature ────────────────────────────────────────────────────────────

  /**
   * Build HMAC-SHA256 signature following Temu Open Platform spec.
   * sign = HMAC-SHA256(appSecret, sorted-param-string)
   */
  private sign(params: Record<string, string>): string {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join("");
    return createHmac("sha256", this.config.appSecret)
      .update(sorted)
      .digest("hex")
      .toUpperCase();
  }

  // ── Generic request ──────────────────────────────────────────────────────

  async request<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "POST",
    body?: Record<string, unknown>,
  ): Promise<ApiResponse<T>> {
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const baseParams: Record<string, string> = {
      app_key: this.config.appKey,
      access_token: this.config.accessToken,
      timestamp,
    };

    // Flatten body values into the sign-map when present
    const signMap: Record<string, string> = { ...baseParams };
    if (body) {
      for (const [k, v] of Object.entries(body)) {
        signMap[k] = typeof v === "string" ? v : JSON.stringify(v);
      }
    }

    const signature = this.sign(signMap);

    const qs = new URLSearchParams({
      ...baseParams,
      sign: signature,
    }).toString();

    const url = `${this.baseUrl}${endpoint}?${qs}`;
    const start = Date.now();

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const data = (await res.json()) as Record<string, unknown>;
      const latency_ms = Date.now() - start;

      if (!res.ok) {
        return {
          success: false,
          error: {
            code: res.status,
            message: String(data.message || data.error_msg || `HTTP ${res.status}`),
            details: data,
          },
          meta: { latency_ms, endpoint, method },
        };
      }

      // Temu wraps most payloads in { result: ... }
      const payload = (data.result ?? data) as T;
      return { success: true, data: payload, meta: { latency_ms, endpoint, method } };
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

  // ─── Products ────────────────────────────────────────────────────────────

  async getProducts(params: { page?: number; page_size?: number; status?: string }) {
    return this.request("/bg/goods/get", "POST", {
      shop_id: this.config.shopId,
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
      ...(params.status ? { status: params.status } : {}),
    });
  }

  async getProduct(productId: string) {
    return this.request("/bg/goods/detail", "POST", {
      shop_id: this.config.shopId,
      product_id: productId,
    });
  }

  async createProduct(data: Record<string, unknown>) {
    return this.request("/bg/goods/add", "POST", {
      shop_id: this.config.shopId,
      ...data,
    });
  }

  async updateProduct(productId: string, data: Record<string, unknown>) {
    return this.request("/bg/goods/edit", "POST", {
      shop_id: this.config.shopId,
      product_id: productId,
      ...data,
    });
  }

  async deleteProduct(productId: string) {
    return this.request("/bg/goods/delete", "POST", {
      shop_id: this.config.shopId,
      product_id: productId,
    });
  }

  // ─── Orders ──────────────────────────────────────────────────────────────

  async getOrders(params: {
    page?: number;
    page_size?: number;
    status?: string;
    start_time?: string;
    end_time?: string;
  }) {
    return this.request("/bg/order/get", "POST", {
      shop_id: this.config.shopId,
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
      ...(params.status ? { order_status: params.status } : {}),
      ...(params.start_time ? { start_time: params.start_time } : {}),
      ...(params.end_time ? { end_time: params.end_time } : {}),
    });
  }

  async getOrder(orderId: string) {
    return this.request("/bg/order/detail", "POST", {
      shop_id: this.config.shopId,
      order_id: orderId,
    });
  }

  async shipOrder(orderId: string, data: Record<string, unknown>) {
    return this.request("/bg/shipment/ship", "POST", {
      shop_id: this.config.shopId,
      order_id: orderId,
      ...data,
    });
  }

  async getShipmentInfo(orderId: string) {
    return this.request("/bg/shipment/get", "POST", {
      shop_id: this.config.shopId,
      order_id: orderId,
    });
  }

  // ─── Categories ──────────────────────────────────────────────────────────

  async getCategories() {
    return this.request("/bg/category/get", "POST", {
      shop_id: this.config.shopId,
    });
  }

  async getCategoryAttributes(categoryId: string) {
    return this.request("/bg/category/attribute", "POST", {
      shop_id: this.config.shopId,
      category_id: categoryId,
    });
  }

  // ─── Inventory ───────────────────────────────────────────────────────────

  async getInventory(productId: string) {
    return this.request("/bg/inventory/get", "POST", {
      shop_id: this.config.shopId,
      product_id: productId,
    });
  }

  async updateInventory(productId: string, data: Record<string, unknown>) {
    return this.request("/bg/inventory/update", "POST", {
      shop_id: this.config.shopId,
      product_id: productId,
      ...data,
    });
  }

  // ─── Returns ─────────────────────────────────────────────────────────────

  async getReturnOrders(params: { page?: number; page_size?: number; status?: string }) {
    return this.request("/bg/aftersale/get", "POST", {
      shop_id: this.config.shopId,
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
      ...(params.status ? { status: params.status } : {}),
    });
  }

  async approveReturn(returnId: string) {
    return this.request("/bg/aftersale/approve", "POST", {
      shop_id: this.config.shopId,
      return_id: returnId,
    });
  }

  async rejectReturn(returnId: string, reason: string) {
    return this.request("/bg/aftersale/reject", "POST", {
      shop_id: this.config.shopId,
      return_id: returnId,
      reason,
    });
  }

  // ─── Shop / Finance ──────────────────────────────────────────────────────

  async getShopInfo() {
    return this.request("/bg/shop/get", "POST", {
      shop_id: this.config.shopId,
    });
  }

  async getFinancialStatement(params: {
    start_date: string;
    end_date: string;
    page?: number;
    page_size?: number;
  }) {
    return this.request("/bg/finance/statement", "POST", {
      shop_id: this.config.shopId,
      start_date: params.start_date,
      end_date: params.end_date,
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
    });
  }
}
