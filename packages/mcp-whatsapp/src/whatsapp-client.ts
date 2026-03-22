/**
 * WhatsApp Cloud API Client
 * Wrapper for Meta's WhatsApp Business Cloud API (v21.0+)
 *
 * @bridgeapi/mcp-whatsapp
 */

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
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
  config: WhatsAppConfig;
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
  return { allow: true };
}

export async function postExecuteHook(
  ctx: HookContext,
  response: ApiResponse
): Promise<PostHookResult> {
  // Phase 1: always accept. Log response for future dataset.
  // Phase 2: this function will validate response against rules
  return { accept: true };
}

// ─── API CLIENT ──────────────────────────────────────────────

export class WhatsAppClient {
  private baseUrl: string;
  private config: WhatsAppConfig;

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.baseUrl = `https://graph.facebook.com/${config.apiVersion}`;
  }

  private async request<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "DELETE" = "GET",
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const start = Date.now();

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const data = await res.json() as Record<string, unknown>;
      const latency_ms = Date.now() - start;

      if (!res.ok) {
        const err = (data as { error?: { code?: number; message?: string } }).error;
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

  // ─── MESSAGING ──────────────────────────────────────

  async sendTextMessage(to: string, body: string, previewUrl = false) {
    return this.request(`/${this.config.phoneNumberId}/messages`, "POST", {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: previewUrl, body },
    });
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    language: string,
    components?: unknown[]
  ) {
    return this.request(`/${this.config.phoneNumberId}/messages`, "POST", {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        ...(components ? { components } : {}),
      },
    });
  }

  async sendMediaMessage(
    to: string,
    mediaType: "image" | "video" | "audio" | "document",
    media: { link?: string; id?: string; caption?: string; filename?: string }
  ) {
    return this.request(`/${this.config.phoneNumberId}/messages`, "POST", {
      messaging_product: "whatsapp",
      to,
      type: mediaType,
      [mediaType]: media,
    });
  }

  async sendInteractiveMessage(
    to: string,
    interactiveType: "button" | "list",
    interactive: {
      header?: unknown;
      body: { text: string };
      footer?: { text: string };
      action: unknown;
    }
  ) {
    return this.request(`/${this.config.phoneNumberId}/messages`, "POST", {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: { type: interactiveType, ...interactive },
    });
  }

  async sendLocationMessage(
    to: string,
    location: { latitude: number; longitude: number; name?: string; address?: string }
  ) {
    return this.request(`/${this.config.phoneNumberId}/messages`, "POST", {
      messaging_product: "whatsapp",
      to,
      type: "location",
      location,
    });
  }

  async sendContactMessage(to: string, contacts: unknown[]) {
    return this.request(`/${this.config.phoneNumberId}/messages`, "POST", {
      messaging_product: "whatsapp",
      to,
      type: "contacts",
      contacts,
    });
  }

  async markMessageRead(messageId: string) {
    return this.request(`/${this.config.phoneNumberId}/messages`, "POST", {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });
  }

  // ─── TEMPLATES ──────────────────────────────────────

  async listTemplates(params?: { status?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", params.limit.toString());
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(
      `/${this.config.businessAccountId}/message_templates${query}`
    );
  }

  async createTemplate(template: {
    name: string;
    language: string;
    category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
    components: unknown[];
  }) {
    return this.request(
      `/${this.config.businessAccountId}/message_templates`,
      "POST",
      template
    );
  }

  async deleteTemplate(templateName: string) {
    return this.request(
      `/${this.config.businessAccountId}/message_templates?name=${templateName}`,
      "DELETE"
    );
  }

  // ─── PHONE NUMBERS & PROFILE ────────────────────────

  async getPhoneNumbers() {
    return this.request(`/${this.config.businessAccountId}/phone_numbers`);
  }

  async getBusinessProfile() {
    return this.request(
      `/${this.config.phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`
    );
  }

  async updateBusinessProfile(profile: Record<string, unknown>) {
    return this.request(
      `/${this.config.phoneNumberId}/whatsapp_business_profile`,
      "POST",
      { messaging_product: "whatsapp", ...profile }
    );
  }

  // ─── ANALYTICS ──────────────────────────────────────

  async getAnalytics(params: {
    start: string;
    end: string;
    granularity: "HALF_HOUR" | "DAY" | "MONTH";
  }) {
    return this.request(
      `/${this.config.businessAccountId}?fields=analytics.start(${params.start}).end(${params.end}).granularity(${params.granularity})`
    );
  }

  // ─── MEDIA ──────────────────────────────────────────

  async uploadMedia(file: string, type: string) {
    // Note: actual file upload requires multipart/form-data
    // This is a simplified version. In production, use FormData.
    return this.request(`/${this.config.phoneNumberId}/media`, "POST", {
      messaging_product: "whatsapp",
      type,
      link: file,
    });
  }

  async getMediaUrl(mediaId: string) {
    return this.request(`/${mediaId}`);
  }
}
