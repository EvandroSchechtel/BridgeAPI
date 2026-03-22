/**
 * Calendly API Client
 * Wrapper for Calendly's REST API v2
 *
 * @bridgeapi/mcp-calendly
 */

export interface CalendlyConfig {
  accessToken: string;
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
  config: CalendlyConfig;
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

export class CalendlyClient {
  private config: CalendlyConfig;
  private baseUrl: string;

  constructor(config: CalendlyConfig) {
    this.config = config;
    this.baseUrl = "https://api.calendly.com";
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
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
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
            code: res.status,
            message:
              (err?.message as string) ??
              (err?.title as string) ??
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

  // ─── USER ──────────────────────────────────────────────

  async getCurrentUser() {
    return this.request("/users/me");
  }

  // ─── EVENT TYPES ───────────────────────────────────────

  async getEventTypes(params?: {
    userUri?: string;
    count?: number;
    pageToken?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.userUri) qs.set("user", params.userUri);
    if (params?.count) qs.set("count", params.count.toString());
    if (params?.pageToken) qs.set("page_token", params.pageToken);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/event_types${query}`);
  }

  async getEventType(uuid: string) {
    return this.request(`/event_types/${uuid}`);
  }

  // ─── SCHEDULED EVENTS ─────────────────────────────────

  async getScheduledEvents(params?: {
    userUri?: string;
    minStartTime?: string;
    maxStartTime?: string;
    status?: string;
    count?: number;
    pageToken?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.userUri) qs.set("user", params.userUri);
    if (params?.minStartTime) qs.set("min_start_time", params.minStartTime);
    if (params?.maxStartTime) qs.set("max_start_time", params.maxStartTime);
    if (params?.status) qs.set("status", params.status);
    if (params?.count) qs.set("count", params.count.toString());
    if (params?.pageToken) qs.set("page_token", params.pageToken);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/scheduled_events${query}`);
  }

  async getScheduledEvent(uuid: string) {
    return this.request(`/scheduled_events/${uuid}`);
  }

  // ─── INVITEES ──────────────────────────────────────────

  async getEventInvitees(
    eventUuid: string,
    params?: { count?: number; pageToken?: string }
  ) {
    const qs = new URLSearchParams();
    if (params?.count) qs.set("count", params.count.toString());
    if (params?.pageToken) qs.set("page_token", params.pageToken);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/scheduled_events/${eventUuid}/invitees${query}`);
  }

  // ─── CANCEL EVENT ──────────────────────────────────────

  async cancelEvent(uuid: string, reason?: string) {
    return this.request(`/scheduled_events/${uuid}/cancellation`, "POST", {
      ...(reason ? { reason } : {}),
    });
  }

  // ─── WEBHOOKS ──────────────────────────────────────────

  async getWebhookSubscriptions(
    organizationUri: string,
    scope?: string
  ) {
    const qs = new URLSearchParams();
    qs.set("organization", organizationUri);
    if (scope) qs.set("scope", scope);
    return this.request(`/webhook_subscriptions?${qs.toString()}`);
  }

  async createWebhookSubscription(params: {
    url: string;
    events: string[];
    organizationUri: string;
    scope?: string;
  }) {
    return this.request("/webhook_subscriptions", "POST", {
      url: params.url,
      events: params.events,
      organization: params.organizationUri,
      scope: params.scope || "organization",
    });
  }

  async deleteWebhookSubscription(uuid: string) {
    return this.request(`/webhook_subscriptions/${uuid}`, "DELETE");
  }

  // ─── AVAILABILITY ──────────────────────────────────────

  async getUserAvailability(
    userUri: string,
    startTime: string,
    endTime: string
  ) {
    const qs = new URLSearchParams();
    qs.set("user", userUri);
    qs.set("start_time", startTime);
    qs.set("end_time", endTime);
    return this.request(`/user_availability_schedules?${qs.toString()}`);
  }

  // ─── ORGANIZATION ──────────────────────────────────────

  async getOrganizationMemberships(organizationUri?: string) {
    const qs = new URLSearchParams();
    if (organizationUri) qs.set("organization", organizationUri);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/organization_memberships${query}`);
  }

  // ─── ROUTING FORMS ─────────────────────────────────────

  async getRoutingForms(organizationUri?: string) {
    const qs = new URLSearchParams();
    if (organizationUri) qs.set("organization", organizationUri);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/routing_forms${query}`);
  }

  async getRoutingFormSubmissions(formUuid?: string) {
    const qs = new URLSearchParams();
    if (formUuid) qs.set("form", formUuid);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/routing_form_submissions${query}`);
  }

  // ─── NO-SHOW ───────────────────────────────────────────

  async markNoShow(inviteeUri: string) {
    return this.request("/invitee_no_shows", "POST", {
      invitee: inviteeUri,
    });
  }

  // ─── ACTIVITY LOG ──────────────────────────────────────

  async getActivityLog(organizationUri?: string) {
    const qs = new URLSearchParams();
    if (organizationUri) qs.set("organization", organizationUri);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/activity_log_entries${query}`);
  }
}
