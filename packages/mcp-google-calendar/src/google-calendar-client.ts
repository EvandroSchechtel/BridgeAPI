/**
 * Google Calendar API Client
 * @bridgeapi/mcp-google-calendar
 *
 * Full OAuth2 refresh-token flow + typed methods for every Calendar v3 endpoint.
 */

// ── Config ──────────────────────────────────────────────────────────────────
export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId?: string; // defaults to "primary"
}

// ── API response envelope ───────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: number; message: string; details?: unknown };
  meta: { latency_ms: number; endpoint: string; method: string };
}

// ── Hooks ───────────────────────────────────────────────────────────────────
export interface HookContext {
  tool_name: string;
  params: Record<string, unknown>;
  config: GoogleCalendarConfig;
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

// ── Token cache ─────────────────────────────────────────────────────────────
interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

// ── Client ──────────────────────────────────────────────────────────────────
export class GoogleCalendarClient {
  private config: GoogleCalendarConfig;
  private baseUrl = "https://www.googleapis.com/calendar/v3";
  private tokenUrl = "https://oauth2.googleapis.com/token";
  private tokenCache: TokenCache | null = null;
  private defaultCalendarId: string;

  constructor(config: GoogleCalendarConfig) {
    this.config = config;
    this.defaultCalendarId = config.calendarId ?? "primary";
  }

  // ── OAuth2 refresh ──────────────────────────────────────────────────────
  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.accessToken;
    }

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: this.config.refreshToken,
      grant_type: "refresh_token",
    });

    const res = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OAuth2 token refresh failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.tokenCache.accessToken;
  }

  // ── Generic request ─────────────────────────────────────────────────────
  async request<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    body?: unknown,
    queryParams?: Record<string, string | undefined>,
  ): Promise<ApiResponse<T>> {
    const start = Date.now();
    try {
      const accessToken = await this.getAccessToken();

      // Build query string
      let url = `${this.baseUrl}${endpoint}`;
      if (queryParams) {
        const filtered = Object.entries(queryParams).filter(
          (entry): entry is [string, string] => entry[1] != null,
        );
        if (filtered.length > 0) {
          url += `?${new URLSearchParams(filtered).toString()}`;
        }
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      };

      const res = await fetch(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const latency_ms = Date.now() - start;

      // DELETE 204 has no body
      if (res.status === 204) {
        return {
          success: true,
          data: undefined as unknown as T,
          meta: { latency_ms, endpoint, method },
        };
      }

      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        const errObj = data.error as
          | { message?: string; errors?: unknown }
          | undefined;
        return {
          success: false,
          error: {
            code: res.status,
            message: errObj?.message ?? `HTTP ${res.status}`,
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

  // ── Resolve calendar ID helper ──────────────────────────────────────────
  private cal(calendarId?: string): string {
    return encodeURIComponent(calendarId ?? this.defaultCalendarId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Calendar List
  // ═══════════════════════════════════════════════════════════════════════════

  /** List calendars visible to the authenticated user. */
  async listCalendars() {
    return this.request("/users/me/calendarList");
  }

  /** Get metadata about a single calendar. */
  async getCalendar(calendarId?: string) {
    return this.request(`/users/me/calendarList/${this.cal(calendarId)}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Events
  // ═══════════════════════════════════════════════════════════════════════════

  /** List events with optional filters. */
  async listEvents(
    calendarId?: string,
    timeMin?: string,
    timeMax?: string,
    maxResults?: number,
    q?: string,
    singleEvents?: boolean,
    orderBy?: string,
  ) {
    return this.request(
      `/calendars/${this.cal(calendarId)}/events`,
      "GET",
      undefined,
      {
        timeMin,
        timeMax,
        maxResults: maxResults != null ? String(maxResults) : undefined,
        q,
        singleEvents:
          singleEvents != null ? String(singleEvents) : undefined,
        orderBy,
      },
    );
  }

  /** Get a single event by ID. */
  async getEvent(calendarId?: string, eventId?: string) {
    return this.request(
      `/calendars/${this.cal(calendarId)}/events/${eventId}`,
    );
  }

  /** Create a new event. */
  async createEvent(calendarId?: string, event?: Record<string, unknown>) {
    return this.request(
      `/calendars/${this.cal(calendarId)}/events`,
      "POST",
      event,
    );
  }

  /** Update (patch) an existing event. */
  async updateEvent(
    calendarId?: string,
    eventId?: string,
    event?: Record<string, unknown>,
  ) {
    return this.request(
      `/calendars/${this.cal(calendarId)}/events/${eventId}`,
      "PATCH",
      event,
    );
  }

  /** Delete an event. */
  async deleteEvent(calendarId?: string, eventId?: string) {
    return this.request(
      `/calendars/${this.cal(calendarId)}/events/${eventId}`,
      "DELETE",
    );
  }

  /** Quick-add an event from a text string (natural language). */
  async quickAddEvent(calendarId?: string, text?: string) {
    return this.request(
      `/calendars/${this.cal(calendarId)}/events/quickAdd`,
      "POST",
      undefined,
      { text },
    );
  }

  /** Move an event to another calendar. */
  async moveEvent(
    calendarId?: string,
    eventId?: string,
    destinationCalendarId?: string,
  ) {
    return this.request(
      `/calendars/${this.cal(calendarId)}/events/${eventId}/move`,
      "POST",
      undefined,
      { destination: destinationCalendarId },
    );
  }

  /** Get instances of a recurring event. */
  async getRecurringInstances(calendarId?: string, eventId?: string) {
    return this.request(
      `/calendars/${this.cal(calendarId)}/events/${eventId}/instances`,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FreeBusy
  // ═══════════════════════════════════════════════════════════════════════════

  /** Query free/busy for a set of calendars. */
  async getFreeBusy(
    timeMin: string,
    timeMax: string,
    items: Array<{ id: string }>,
  ) {
    return this.request("/freeBusy", "POST", { timeMin, timeMax, items });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Colors
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get the color definitions available in Google Calendar. */
  async getColors() {
    return this.request("/colors");
  }
}
