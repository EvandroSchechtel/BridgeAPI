/**
 * Mercado Livre API Client
 * Wrapper for Mercado Livre's REST API (Items, Orders, Questions, Messages, Shipping)
 *
 * @bridgeapi/mcp-mercadolivre
 */

export interface MeliConfig {
  appId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  siteId: string;
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
  config: MeliConfig;
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

export class MercadoLivreClient {
  private config: MeliConfig;
  private baseUrl = "https://api.mercadolibre.com";
  private accessToken: string;

  constructor(config: MeliConfig) {
    this.config = config;
    this.accessToken = config.accessToken;
  }

  private async refreshAccessToken(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: this.config.appId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OAuth2 token refresh failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
    };
    this.accessToken = data.access_token;
    // In a real scenario, persist the new refresh_token
    this.config.refreshToken = data.refresh_token;
  }

  private async request<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const start = Date.now();

    try {
      let res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      // If unauthorized, try refreshing the token once
      if (res.status === 401) {
        await this.refreshAccessToken();
        res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      }

      const latency_ms = Date.now() - start;

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
            code: (err?.status as number) ?? res.status,
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

  // ─── ITEMS ─────────────────────────────────────────────

  async getItem(itemId: string) {
    return this.request(`/items/${itemId}`);
  }

  async searchItems(params: {
    query?: string;
    siteId?: string;
    category?: string;
    sort?: string;
    offset?: number;
    limit?: number;
  }) {
    const siteId = params.siteId || this.config.siteId;
    const qs = new URLSearchParams();
    if (params.query) qs.set("q", params.query);
    if (params.category) qs.set("category", params.category);
    if (params.sort) qs.set("sort", params.sort);
    if (params.offset !== undefined) qs.set("offset", params.offset.toString());
    if (params.limit !== undefined) qs.set("limit", params.limit.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/sites/${siteId}/search${query}`);
  }

  async createItem(item: {
    title: string;
    category_id: string;
    price: number;
    currency_id: string;
    available_quantity: number;
    buying_mode: string;
    condition: string;
    listing_type_id: string;
    description?: string;
    pictures?: Array<{ source: string }>;
  }) {
    const { description, ...itemData } = item;
    const result = await this.request("/items", "POST", itemData);

    // If item was created and description is provided, set description separately
    if (result.success && description && result.data) {
      const created = result.data as { id: string };
      await this.updateItemDescription(created.id, description);
    }

    return result;
  }

  async updateItem(
    itemId: string,
    updates: {
      price?: number;
      available_quantity?: number;
      status?: string;
      title?: string;
    }
  ) {
    return this.request(`/items/${itemId}`, "PUT", updates);
  }

  async pauseItem(itemId: string) {
    return this.request(`/items/${itemId}`, "PUT", { status: "paused" });
  }

  async activateItem(itemId: string) {
    return this.request(`/items/${itemId}`, "PUT", { status: "active" });
  }

  async deleteItem(itemId: string) {
    return this.request(`/items/${itemId}`, "PUT", { deleted: "true" });
  }

  async getItemDescription(itemId: string) {
    return this.request(`/items/${itemId}/description`);
  }

  async updateItemDescription(itemId: string, plainText: string) {
    return this.request(`/items/${itemId}/description`, "PUT", {
      plain_text: plainText,
    });
  }

  // ─── ORDERS ────────────────────────────────────────────

  async getOrders(params?: {
    status?: string;
    sort?: string;
    offset?: number;
    limit?: number;
  }) {
    // First get current user ID
    const meResult = await this.getMe();
    if (!meResult.success || !meResult.data) {
      return meResult;
    }
    const me = meResult.data as { id: number };

    const qs = new URLSearchParams();
    qs.set("seller", me.id.toString());
    if (params?.status) qs.set("order.status", params.status);
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.offset !== undefined) qs.set("offset", params.offset.toString());
    if (params?.limit !== undefined) qs.set("limit", params.limit.toString());
    return this.request(`/orders/search?${qs.toString()}`);
  }

  async getOrder(orderId: string) {
    return this.request(`/orders/${orderId}`);
  }

  async getOrderShipment(orderId: string) {
    const orderResult = await this.getOrder(orderId);
    if (!orderResult.success || !orderResult.data) {
      return orderResult;
    }
    const order = orderResult.data as { shipping: { id: number } };
    if (!order.shipping?.id) {
      return {
        success: false,
        error: { code: 404, message: "No shipment found for this order" },
        meta: orderResult.meta,
      };
    }
    return this.request(`/shipments/${order.shipping.id}`);
  }

  // ─── QUESTIONS ─────────────────────────────────────────

  async getQuestions(params?: {
    itemId?: string;
    status?: string;
    sort?: string;
    offset?: number;
    limit?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.itemId) qs.set("item", params.itemId);
    if (params?.status) qs.set("status", params.status.toUpperCase());
    if (params?.sort) qs.set("sort_fields", params.sort === "date_desc" ? "date_created" : params.sort);
    if (params?.sort === "date_desc") qs.set("sort_types", "DESC");
    if (params?.offset !== undefined) qs.set("offset", params.offset.toString());
    if (params?.limit !== undefined) qs.set("limit", params.limit.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/my/received_questions/search${query}`);
  }

  async answerQuestion(questionId: number, text: string) {
    return this.request(`/answers`, "POST", {
      question_id: questionId,
      text,
    });
  }

  // ─── MESSAGES ──────────────────────────────────────────

  async getMessages(orderId: string) {
    return this.request(`/messages/orders/${orderId}`);
  }

  async sendMessage(
    orderId: string,
    text: string,
    attachments?: string[]
  ) {
    // Get current user for sender identification
    const meResult = await this.getMe();
    if (!meResult.success || !meResult.data) {
      return meResult;
    }
    const me = meResult.data as { id: number };

    const body: Record<string, unknown> = {
      from: { user_id: me.id },
      to: { resource: "orders", resource_id: orderId },
      text,
    };
    if (attachments && attachments.length > 0) {
      body.attachments = attachments.map((a) => ({ filename: a }));
    }
    return this.request(
      `/messages/packs/${orderId}/sellers/${me.id}`,
      "POST",
      { text }
    );
  }

  // ─── USERS ─────────────────────────────────────────────

  async getMe() {
    return this.request("/users/me");
  }

  async getUser(userId: string) {
    return this.request(`/users/${userId}`);
  }

  // ─── CATEGORIES ────────────────────────────────────────

  async getCategories(siteId?: string) {
    const site = siteId || this.config.siteId;
    return this.request(`/sites/${site}/categories`);
  }

  async getCategoryAttributes(categoryId: string) {
    return this.request(`/categories/${categoryId}/attributes`);
  }

  // ─── SHIPPING ──────────────────────────────────────────

  async getShipmentLabel(shipmentId: string) {
    return this.request(`/shipment_labels?shipment_ids=${shipmentId}`);
  }

  async getShipmentTracking(shipmentId: string) {
    return this.request(`/shipments/${shipmentId}`);
  }

  // ─── SALES / VISITS ────────────────────────────────────

  async getSales() {
    // Uses orders endpoint filtered by seller
    return this.getOrders({ sort: "date_desc" });
  }

  async getItemVisits(
    itemId: string,
    dateFrom?: string,
    dateTo?: string
  ) {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("date_from", dateFrom);
    if (dateTo) qs.set("date_to", dateTo);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/items/${itemId}/visits${query}`);
  }

  // ─── HELPER: Get user active items ─────────────────────

  async getMyItems() {
    const meResult = await this.getMe();
    if (!meResult.success || !meResult.data) {
      return meResult;
    }
    const me = meResult.data as { id: number };
    return this.request(`/users/${me.id}/items/search?status=active`);
  }
}
