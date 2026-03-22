/**
 * Shopee API Client
 * Wrapper for Shopee Open Platform REST API v2
 * HMAC-SHA256 auth, auto token refresh, structured responses.
 *
 * @bridgeapi/mcp-shopee
 */

import { createHmac } from "node:crypto";

// ─── CONFIG ──────────────────────────────────────────────────

export interface ShopeeConfig {
  partnerId: number;
  partnerKey: string;
  shopId: number;
  accessToken: string;
  refreshToken: string;
}

// ─── RESPONSE / HOOK TYPES ──────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: number; message: string; details?: unknown };
  meta: { latency_ms: number; endpoint: string; method: string };
}

export interface HookContext {
  tool_name: string;
  params: Record<string, unknown>;
  config: ShopeeConfig;
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

// ─── PHASE 1 HOOKS: no-ops ─────────────────────────────────

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

// ─── CLIENT ─────────────────────────────────────────────────

export class ShopeeClient {
  private config: ShopeeConfig;
  private baseUrl = "https://partner.shopeemobile.com/api/v2";
  private accessToken: string;

  constructor(config: ShopeeConfig) {
    this.config = config;
    this.accessToken = config.accessToken;
  }

  // ── Shopee HMAC-SHA256 signature ────────────────────────
  // sign = HMAC-SHA256(partner_key, partner_id + api_path + timestamp + access_token + shop_id)
  private sign(path: string, timestamp: number): string {
    const base = `${this.config.partnerId}${path}${timestamp}${this.accessToken}${this.config.shopId}`;
    return createHmac("sha256", this.config.partnerKey).update(base).digest("hex");
  }

  // ── Build auth query string ─────────────────────────────
  private authQs(
    path: string,
    timestamp: number,
    extra?: Record<string, string | number | undefined>
  ): URLSearchParams {
    const qs = new URLSearchParams({
      partner_id: this.config.partnerId.toString(),
      timestamp: timestamp.toString(),
      sign: this.sign(path, timestamp),
      access_token: this.accessToken,
      shop_id: this.config.shopId.toString(),
    });
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (v !== undefined) qs.set(k, String(v));
      }
    }
    return qs;
  }

  // ── Parse Shopee JSON body ──────────────────────────────
  private parseResponse<T>(
    data: Record<string, unknown>,
    latency_ms: number,
    endpoint: string,
    method: string,
    httpStatus: number
  ): ApiResponse<T> {
    // Shopee signals errors inside the JSON body via an "error" field
    if (data.error !== undefined && data.error !== "" && data.error !== 0) {
      return {
        success: false,
        error: {
          code: typeof data.error === "number" ? data.error : -1,
          message:
            (data.message as string) ??
            (data.msg as string) ??
            String(data.error),
          details: data,
        },
        meta: { latency_ms, endpoint, method },
      };
    }

    if (httpStatus >= 400) {
      return {
        success: false,
        error: { code: httpStatus, message: `HTTP ${httpStatus}`, details: data },
        meta: { latency_ms, endpoint, method },
      };
    }

    return {
      success: true,
      data: (data.response ?? data) as T,
      meta: { latency_ms, endpoint, method },
    };
  }

  // ── Generic GET ─────────────────────────────────────────
  private async get<T = unknown>(
    path: string,
    extra?: Record<string, string | number | undefined>
  ): Promise<ApiResponse<T>> {
    const timestamp = Math.floor(Date.now() / 1000);
    const url = `${this.baseUrl}${path}?${this.authQs(path, timestamp, extra).toString()}`;
    const start = Date.now();

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const latency_ms = Date.now() - start;
      const data = (await res.json()) as Record<string, unknown>;
      return this.parseResponse<T>(data, latency_ms, path, "GET", res.status);
    } catch (err) {
      return {
        success: false,
        error: { code: -1, message: err instanceof Error ? err.message : "Unknown error" },
        meta: { latency_ms: Date.now() - start, endpoint: path, method: "GET" },
      };
    }
  }

  // ── Generic POST ────────────────────────────────────────
  private async post<T = unknown>(
    path: string,
    body: unknown,
    extraQs?: Record<string, string | number | undefined>
  ): Promise<ApiResponse<T>> {
    const timestamp = Math.floor(Date.now() / 1000);
    const url = `${this.baseUrl}${path}?${this.authQs(path, timestamp, extraQs).toString()}`;
    const start = Date.now();

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const latency_ms = Date.now() - start;
      const data = (await res.json()) as Record<string, unknown>;
      return this.parseResponse<T>(data, latency_ms, path, "POST", res.status);
    } catch (err) {
      return {
        success: false,
        error: { code: -1, message: err instanceof Error ? err.message : "Unknown error" },
        meta: { latency_ms: Date.now() - start, endpoint: path, method: "POST" },
      };
    }
  }

  // ── Token refresh ───────────────────────────────────────
  // Public-level sign: partner_id + path + timestamp (no access_token / shop_id)
  async refreshAccessToken(): Promise<ApiResponse> {
    const path = "/auth/access_token/get";
    const timestamp = Math.floor(Date.now() / 1000);
    const base = `${this.config.partnerId}${path}${timestamp}`;
    const signature = createHmac("sha256", this.config.partnerKey).update(base).digest("hex");

    const qs = new URLSearchParams({
      partner_id: this.config.partnerId.toString(),
      timestamp: timestamp.toString(),
      sign: signature,
    });

    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}${path}?${qs.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refresh_token: this.config.refreshToken,
          partner_id: this.config.partnerId,
          shop_id: this.config.shopId,
        }),
      });

      const latency_ms = Date.now() - start;
      const data = (await res.json()) as Record<string, unknown>;

      if (data.error && data.error !== "") {
        return {
          success: false,
          error: { code: -1, message: String(data.error), details: data },
          meta: { latency_ms, endpoint: path, method: "POST" },
        };
      }

      this.accessToken = data.access_token as string;
      this.config.refreshToken = data.refresh_token as string;

      return {
        success: true,
        data: { access_token: this.accessToken, refresh_token: this.config.refreshToken },
        meta: { latency_ms, endpoint: path, method: "POST" },
      };
    } catch (err) {
      return {
        success: false,
        error: { code: -1, message: err instanceof Error ? err.message : "Unknown error" },
        meta: { latency_ms: Date.now() - start, endpoint: path, method: "POST" },
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PRODUCTS
  // ═══════════════════════════════════════════════════════════

  /** List shop products (paginated). Statuses: NORMAL, BANNED, UNLIST, etc. */
  async listProducts(params: {
    offset?: number;
    page_size?: number;
    item_status?: string;
  }) {
    return this.get("/product/get_item_list", {
      offset: params.offset ?? 0,
      page_size: params.page_size ?? 20,
      item_status: params.item_status ?? "NORMAL",
    });
  }

  /** Get detailed info for one or more items. */
  async getProduct(itemIds: number[]) {
    return this.get("/product/get_item_base_info", {
      item_id_list: itemIds.join(","),
    });
  }

  /** Add a new product listing. */
  async addProduct(product: Record<string, unknown>) {
    return this.post("/product/add_item", product);
  }

  /** Update product fields (title, description, images, etc.). */
  async updateProduct(itemId: number, updates: Record<string, unknown>) {
    return this.post("/product/update_item", { item_id: itemId, ...updates });
  }

  /** Update stock for item models. */
  async updateStock(
    itemId: number,
    stockList: Array<{ model_id?: number; normal_stock: number }>
  ) {
    return this.post("/product/update_stock", {
      item_id: itemId,
      stock_list: stockList,
    });
  }

  /** Update price for item models. */
  async updatePrice(
    itemId: number,
    priceList: Array<{ model_id?: number; original_price: number }>
  ) {
    return this.post("/product/update_price", {
      item_id: itemId,
      price_list: priceList,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ORDERS
  // ═══════════════════════════════════════════════════════════

  /** List orders with time-range and status filter. */
  async getOrders(params: {
    time_range_field?: string;
    time_from?: number;
    time_to?: number;
    page_size?: number;
    cursor?: string;
    order_status?: string;
  }) {
    return this.get("/order/get_order_list", {
      time_range_field: params.time_range_field ?? "create_time",
      time_from: params.time_from,
      time_to: params.time_to,
      page_size: params.page_size ?? 20,
      cursor: params.cursor,
      order_status: params.order_status,
    });
  }

  /** Get full details of one or more orders. */
  async getOrder(orderSnList: string[]) {
    return this.get("/order/get_order_detail", {
      order_sn_list: orderSnList.join(","),
      response_optional_fields:
        "buyer_user_id,buyer_username,estimated_shipping_fee,recipient_address,actual_shipping_fee,note,item_list,pay_time,dropshipper,dropshipper_phone,split_up,buyer_cancel_reason,cancel_by,package_list,pickup_done_time,invoice_data",
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SHIPPING / LOGISTICS
  // ═══════════════════════════════════════════════════════════

  /** Get shipping parameters required before calling shipOrder. */
  async getShippingParameter(orderSn: string) {
    return this.get("/logistics/get_shipping_parameter", { order_sn: orderSn });
  }

  /** Ship an order (arrange logistics). */
  async shipOrder(orderSn: string, shippingParams: Record<string, unknown>) {
    return this.post("/logistics/ship_order", { order_sn: orderSn, ...shippingParams });
  }

  /** Get available logistics channels for the shop. */
  async getLogistics() {
    return this.get("/logistics/get_channel_list");
  }

  // ═══════════════════════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════════════════════

  /** Get category tree. */
  async getCategories(language?: string) {
    return this.get("/product/get_category", { language: language ?? "pt" });
  }

  /** Get mandatory/optional attributes for a category. */
  async getCategoryAttributes(categoryId: number, language?: string) {
    return this.get("/product/get_attributes", {
      category_id: categoryId,
      language: language ?? "pt",
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SHOP
  // ═══════════════════════════════════════════════════════════

  /** Get current shop profile info. */
  async getShopInfo() {
    return this.get("/shop/get_shop_info");
  }

  /** Get shop performance / penalty metrics. */
  async getShopPerformance() {
    return this.get("/shop/get_shop_penalty");
  }

  // ═══════════════════════════════════════════════════════════
  // RETURNS
  // ═══════════════════════════════════════════════════════════

  /** List return/refund requests. */
  async getReturnOrders(params: {
    page_no?: number;
    page_size?: number;
    create_time_from?: number;
    create_time_to?: number;
  }) {
    return this.get("/returns/get_return_list", {
      page_no: params.page_no ?? 1,
      page_size: params.page_size ?? 20,
      create_time_from: params.create_time_from,
      create_time_to: params.create_time_to,
    });
  }

  /** Confirm or reject a return request. */
  async confirmReturn(returnSn: string, decision: "ACCEPT" | "REJECT") {
    return this.post("/returns/confirm", { return_sn: returnSn, decision });
  }

  // ═══════════════════════════════════════════════════════════
  // CHAT / MESSAGES
  // ═══════════════════════════════════════════════════════════

  /** List buyer chat conversations. */
  async getConversations(params: {
    direction?: string;
    type?: string;
    page_size?: number;
    offset?: number;
  }) {
    return this.get("/sellerchat/get_conversation_list", {
      direction: params.direction ?? "latest",
      type: params.type ?? "all",
      page_size: params.page_size ?? 20,
      offset: params.offset,
    });
  }

  /** Send a text message to a buyer conversation. */
  async sendMessage(conversationId: string, content: string) {
    return this.post("/sellerchat/send_message", {
      to_id: Number(conversationId),
      message_type: "text",
      content: { text: content },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PAYMENT
  // ═══════════════════════════════════════════════════════════

  /** Get escrow / payment details for an order. */
  async getPaymentInfo(orderSn: string) {
    return this.get("/payment/get_escrow_detail", { order_sn: orderSn });
  }
}
