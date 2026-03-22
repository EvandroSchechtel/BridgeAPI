/**
 * Pix API Client
 * @bridgeapi/mcp-pix
 *
 * Implements OAuth2 client_credentials flow and all Pix API v2 endpoints.
 * Supports multiple PSPs (Gerencianet/Efipay, Banco do Brasil, Itau).
 */

import * as fs from "node:fs";
import * as https from "node:https";

// ── Types ──────────────────────────────────────────────────────────────

export type Psp = "gerencianet" | "bb" | "itau";
export type Environment = "production" | "sandbox";

export interface PixConfig {
  clientId: string;
  clientSecret: string;
  certificatePath: string;
  pixKey: string;
  psp: Psp;
  environment: Environment;
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
  config: PixConfig;
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

// ── Hooks ──────────────────────────────────────────────────────────────

export async function preExecuteHook(_ctx: HookContext): Promise<PreHookResult> {
  // Extensible: add rate-limit, allowlist, audit logging, etc.
  return { allow: true };
}

export async function postExecuteHook(
  _ctx: HookContext,
  _response: ApiResponse,
): Promise<PostHookResult> {
  // Extensible: add anomaly detection, alerting, etc.
  return { accept: true };
}

// ── Base URL map ───────────────────────────────────────────────────────

const BASE_URLS: Record<Psp, Record<Environment, string>> = {
  gerencianet: {
    production: "https://pix.api.efipay.com.br",
    sandbox: "https://pix-h.api.efipay.com.br",
  },
  bb: {
    production: "https://api.bb.com.br/pix/v2",
    sandbox: "https://api.hm.bb.com.br/pix/v2",
  },
  itau: {
    production: "https://secure.api.itau/pix/v2",
    sandbox: "https://sandbox.api.itau/pix/v2",
  },
};

const AUTH_URLS: Record<Psp, Record<Environment, string>> = {
  gerencianet: {
    production: "https://pix.api.efipay.com.br/oauth/token",
    sandbox: "https://pix-h.api.efipay.com.br/oauth/token",
  },
  bb: {
    production: "https://oauth.bb.com.br/oauth/token",
    sandbox: "https://oauth.hm.bb.com.br/oauth/token",
  },
  itau: {
    production: "https://sts.itau.com.br/as/token.oauth2",
    sandbox: "https://sts.sandbox.itau.com.br/as/token.oauth2",
  },
};

// ── Token cache ────────────────────────────────────────────────────────

interface CachedToken {
  access_token: string;
  expires_at: number; // epoch ms
}

// ── Charge types ───────────────────────────────────────────────────────

export interface CreateChargeData {
  calendario: { expiracao: number };
  devedor?: { cpf?: string; cnpj?: string; nome?: string };
  valor: { original: string };
  chave: string;
  solicitacaoPagador?: string;
  infoAdicionais?: Array<{ nome: string; valor: string }>;
}

export interface UpdateChargeData {
  status?: string;
  valor?: { original: string };
  solicitacaoPagador?: string;
}

export interface RefundData {
  valor: string;
}

// ── Client ─────────────────────────────────────────────────────────────

export class PixClient {
  private config: PixConfig;
  private baseUrl: string;
  private authUrl: string;
  private tokenCache: CachedToken | null = null;
  private httpsAgent: https.Agent | undefined;

  constructor(config: PixConfig) {
    this.config = config;
    this.baseUrl = BASE_URLS[config.psp][config.environment];
    this.authUrl = AUTH_URLS[config.psp][config.environment];

    // Load mTLS certificate if file exists
    if (config.certificatePath && fs.existsSync(config.certificatePath)) {
      const certBuffer = fs.readFileSync(config.certificatePath);
      this.httpsAgent = new https.Agent({
        pfx: certBuffer,
        rejectUnauthorized: config.environment === "production",
      });
    }
  }

  // ── OAuth2 token ───────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expires_at > now + 30_000) {
      return this.tokenCache.access_token;
    }

    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString("base64");

    const res = await fetch(this.authUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      ...(this.httpsAgent ? { dispatcher: this.httpsAgent as unknown as undefined } : {}),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OAuth2 token request failed (${res.status}): ${text}`);
    }

    const body = (await res.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    this.tokenCache = {
      access_token: body.access_token,
      expires_at: now + body.expires_in * 1000,
    };

    return this.tokenCache.access_token;
  }

  // ── Generic HTTP request ───────────────────────────────────────────

  async request<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const start = Date.now();

    try {
      const token = await this.getAccessToken();

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const res = await fetch(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const latency_ms = Date.now() - start;

      if (res.status === 204) {
        return {
          success: true,
          data: undefined as T,
          meta: { latency_ms, endpoint, method },
        };
      }

      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        return {
          success: false,
          error: {
            code: res.status,
            message: String(
              data.mensagem || data.message || `HTTP ${res.status}`,
            ),
            details: data,
          },
          meta: { latency_ms, endpoint, method },
        };
      }

      return { success: true, data: data as T, meta: { latency_ms, endpoint, method } };
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

  // ── Cobran?as (Charges) ────────────────────────────────────────────

  /** Create a Pix charge with a given txid */
  async createCharge(txid: string, data: CreateChargeData): Promise<ApiResponse> {
    return this.request(`/v2/cob/${txid}`, "PUT", data);
  }

  /** Create an immediate Pix charge (txid auto-generated by PSP) */
  async createImmediateCharge(data: CreateChargeData): Promise<ApiResponse> {
    return this.request("/v2/cob", "POST", data);
  }

  /** Get details of a specific charge by txid */
  async getCharge(txid: string): Promise<ApiResponse> {
    return this.request(`/v2/cob/${txid}`);
  }

  /** List charges within a date range, optionally filtered by status */
  async listCharges(inicio: string, fim: string, status?: string): Promise<ApiResponse> {
    const params = new URLSearchParams({ inicio, fim });
    if (status) params.set("status", status);
    return this.request(`/v2/cob?${params.toString()}`);
  }

  /** Update (revise) an existing charge */
  async updateCharge(txid: string, data: UpdateChargeData): Promise<ApiResponse> {
    return this.request(`/v2/cob/${txid}`, "PATCH", data);
  }

  // ── Pagamentos (Payments / Pix received) ───────────────────────────

  /** Get details of a received Pix payment by e2eid */
  async getPayment(e2eid: string): Promise<ApiResponse> {
    return this.request(`/v2/pix/${e2eid}`);
  }

  /** Request a refund (devolucao) for a received payment */
  async refundPayment(e2eid: string, id: string, valor: string): Promise<ApiResponse> {
    return this.request(`/v2/pix/${e2eid}/devolucao/${id}`, "PUT", { valor });
  }

  /** List received Pix payments within a date range */
  async listPayments(inicio: string, fim: string): Promise<ApiResponse> {
    const params = new URLSearchParams({ inicio, fim });
    return this.request(`/v2/pix?${params.toString()}`);
  }

  // ── QR Code ────────────────────────────────────────────────────────

  /** Generate a QR Code image for a given location ID */
  async generateQRCode(locId: number): Promise<ApiResponse> {
    return this.request(`/v2/loc/${locId}/qrcode`);
  }

  // ── Webhooks ───────────────────────────────────────────────────────

  /** Configure a webhook URL for a Pix key */
  async configureWebhook(chave: string, webhookUrl: string): Promise<ApiResponse> {
    return this.request(`/v2/webhook/${chave}`, "PUT", { webhookUrl });
  }

  /** Get the configured webhook for a Pix key */
  async getWebhook(chave: string): Promise<ApiResponse> {
    return this.request(`/v2/webhook/${chave}`);
  }

  /** Delete the webhook configured for a Pix key */
  async deleteWebhook(chave: string): Promise<ApiResponse> {
    return this.request(`/v2/webhook/${chave}`, "DELETE");
  }

  /** List all configured webhooks */
  async listWebhooks(): Promise<ApiResponse> {
    return this.request("/v2/webhook");
  }

  // ── Saldo / Extrato (Gerencianet-specific) ─────────────────────────

  /** Get account balance (Gerencianet/Efipay only) */
  async getBalance(): Promise<ApiResponse> {
    return this.request("/v2/gn/balance");
  }

  /** Get account statements within a date range (Gerencianet/Efipay only) */
  async getStatements(inicio: string, fim: string): Promise<ApiResponse> {
    const params = new URLSearchParams({ inicio, fim });
    return this.request(`/v2/gn/statements?${params.toString()}`);
  }
}
