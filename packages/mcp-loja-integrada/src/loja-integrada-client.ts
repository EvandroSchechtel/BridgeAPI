/**
 * Loja Integrada API Client
 * Wrapper for Loja Integrada's REST API v1 (Products, Orders, Customers, Categories, Brands, Shipping, Store)
 *
 * @bridgeapi/mcp-loja-integrada
 */

export interface LojaIntegradaConfig {
  apiKey: string;
  appKey: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: number; message: string; details?: unknown };
  meta: { latency_ms: number; endpoint: string; method: string };
}

// --- PRE/POST HOOK TYPES (Phase 2 ready) ---

export interface HookContext {
  tool_name: string;
  params: Record<string, unknown>;
  config: LojaIntegradaConfig;
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

// --- PHASE 1 HOOKS: no-ops ---

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

// --- API CLIENT ---

export class LojaIntegradaClient {
  private config: LojaIntegradaConfig;
  private baseUrl: string;

  constructor(config: LojaIntegradaConfig) {
    this.config = config;
    this.baseUrl = "https://api.awsli.com.br/v1";
  }

  private async request<T = unknown>(
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
          Authorization: `chave_api ${this.config.apiKey} chave_aplicacao ${this.config.appKey}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
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

  // --- PRODUCTS ---

  async getProducts(params?: {
    since_criado?: string;
    since_atualizado?: string;
    limit?: number;
    offset?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.since_criado) qs.set("since_criado", params.since_criado);
    if (params?.since_atualizado) qs.set("since_atualizado", params.since_atualizado);
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.offset) qs.set("offset", params.offset.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/produto${query}`);
  }

  async getProduct(id: number) {
    return this.request(`/produto/${id}`);
  }

  async createProduct(data: Record<string, unknown>) {
    return this.request("/produto", "POST", data);
  }

  async updateProduct(id: number, data: Record<string, unknown>) {
    return this.request(`/produto/${id}`, "PUT", data);
  }

  async deleteProduct(id: number) {
    return this.request(`/produto/${id}`, "DELETE");
  }

  async getProductVariations(productId: number) {
    return this.request(`/produto_variacao/?produto=${productId}`);
  }

  async getProductImages(productId: number) {
    return this.request(`/produto_imagem/?produto=${productId}`);
  }

  // --- ORDERS ---

  async getOrders(params?: {
    situacao_id?: number;
    since_criado?: string;
    since_atualizado?: string;
    limit?: number;
    offset?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.situacao_id) qs.set("situacao_id", params.situacao_id.toString());
    if (params?.since_criado) qs.set("since_criado", params.since_criado);
    if (params?.since_atualizado) qs.set("since_atualizado", params.since_atualizado);
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.offset) qs.set("offset", params.offset.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/pedido${query}`);
  }

  async getOrder(id: number) {
    return this.request(`/pedido/${id}`);
  }

  async updateOrderStatus(id: number, statusId: string) {
    return this.request(`/pedido/${id}`, "PUT", {
      situacao: `/api/v1/situacao/pedido/${statusId}`,
    });
  }

  // --- CUSTOMERS ---

  async getCustomers(params?: {
    since_criado?: string;
    limit?: number;
    offset?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.since_criado) qs.set("since_criado", params.since_criado);
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.offset) qs.set("offset", params.offset.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/cliente${query}`);
  }

  async getCustomer(id: number) {
    return this.request(`/cliente/${id}`);
  }

  // --- CATEGORIES ---

  async getCategories(params?: { limit?: number; offset?: number }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.offset) qs.set("offset", params.offset.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/categoria${query}`);
  }

  async getCategory(id: number) {
    return this.request(`/categoria/${id}`);
  }

  async createCategory(data: Record<string, unknown>) {
    return this.request("/categoria", "POST", data);
  }

  // --- BRANDS ---

  async getBrands(params?: { limit?: number; offset?: number }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.offset) qs.set("offset", params.offset.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/marca${query}`);
  }

  async createBrand(data: Record<string, unknown>) {
    return this.request("/marca", "POST", data);
  }

  // --- SHIPPING ---

  async getShippingMethods() {
    return this.request("/forma_envio");
  }

  // --- STORE ---

  async getStore() {
    return this.request("/loja");
  }
}
