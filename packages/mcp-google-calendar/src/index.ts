#!/usr/bin/env node
/**
 * @bridgeapi/mcp-google-calendar -- MCP Server
 * Part of the BridgeAPI ecosystem
 *
 * 18 Google Calendar tools, 3 resources, 3 prompts (PT-BR).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  GoogleCalendarClient,
  preExecuteHook,
  postExecuteHook,
  type GoogleCalendarConfig,
  type HookContext,
  type ApiResponse,
} from "./google-calendar-client.js";

// ═══════════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════════

function loadConfig(): GoogleCalendarConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is required");

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) throw new Error("GOOGLE_CLIENT_SECRET is required");

  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("GOOGLE_REFRESH_TOKEN is required");

  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

  return { clientId, clientSecret, refreshToken, calendarId };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook executor
// ═══════════════════════════════════════════════════════════════════════════════

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: GoogleCalendarConfig,
  executor: () => Promise<ApiResponse<T>>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const hookCtx: HookContext = {
    tool_name: toolName,
    params,
    config,
    timestamp: new Date().toISOString(),
  };

  const preResult = await preExecuteHook(hookCtx);
  if (!preResult.allow) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            blocked: true,
            reason: preResult.reason || "Blocked",
            escalation_id: preResult.escalation_id,
          }),
        },
      ],
    };
  }

  const response = await executor();
  const postResult = await postExecuteHook(hookCtx, response);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: response.success,
            ...(response.data ? { data: response.data } : {}),
            ...(response.error ? { error: response.error } : {}),
            meta: {
              ...response.meta,
              confidence_score: null,
              execution_mode: "auto",
              flags: postResult.flags || [],
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Bootstrap
// ═══════════════════════════════════════════════════════════════════════════════

const config = loadConfig();
const client = new GoogleCalendarClient(config);

const server = new McpServer(
  { name: "bridgeapi-google-calendar", version: "0.1.0" },
  {
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false },
      prompts: { listChanged: false },
    },
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS (18)
// ═══════════════════════════════════════════════════════════════════════════════

// 1 ── list_calendars ────────────────────────────────────────────────────────
server.tool(
  "list_calendars",
  "List all calendars visible to the authenticated user.",
  {},
  async () =>
    executeWithHooks("list_calendars", {}, config, () =>
      client.listCalendars(),
    ),
);

// 2 ── get_calendar ──────────────────────────────────────────────────────────
server.tool(
  "get_calendar",
  "Get metadata about a specific calendar.",
  {
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
  },
  async ({ calendar_id }) =>
    executeWithHooks(
      "get_calendar",
      { calendar_id },
      config,
      () => client.getCalendar(calendar_id),
    ),
);

// 3 ── list_events ───────────────────────────────────────────────────────────
server.tool(
  "list_events",
  "List events from a calendar with optional filters.",
  {
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
    time_min: z
      .string()
      .optional()
      .describe("Lower bound (RFC3339) for event end time"),
    time_max: z
      .string()
      .optional()
      .describe("Upper bound (RFC3339) for event start time"),
    max_results: z
      .number()
      .optional()
      .describe("Maximum number of events returned"),
    query: z.string().optional().describe("Free text search terms"),
    single_events: z
      .boolean()
      .optional()
      .describe(
        "Whether to expand recurring events into instances (default: true)",
      ),
  },
  async ({
    calendar_id,
    time_min,
    time_max,
    max_results,
    query,
    single_events,
  }) =>
    executeWithHooks(
      "list_events",
      { calendar_id, time_min, time_max, max_results, query, single_events },
      config,
      () =>
        client.listEvents(
          calendar_id,
          time_min,
          time_max,
          max_results,
          query,
          single_events,
          single_events ? "startTime" : undefined,
        ),
    ),
);

// 4 ── get_event ─────────────────────────────────────────────────────────────
server.tool(
  "get_event",
  "Get full details of a specific event.",
  {
    event_id: z.string().describe("The event ID"),
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
  },
  async ({ event_id, calendar_id }) =>
    executeWithHooks(
      "get_event",
      { event_id, calendar_id },
      config,
      () => client.getEvent(calendar_id, event_id),
    ),
);

// 5 ── create_event ──────────────────────────────────────────────────────────
server.tool(
  "create_event",
  "Create a new calendar event.",
  {
    summary: z.string().describe("Event title"),
    start_datetime: z
      .string()
      .describe("Start time in RFC3339 format (e.g. 2026-03-22T10:00:00-03:00)"),
    end_datetime: z
      .string()
      .describe("End time in RFC3339 format"),
    description: z.string().optional().describe("Event description"),
    location: z.string().optional().describe("Event location"),
    attendees: z
      .array(z.string())
      .optional()
      .describe("List of attendee email addresses"),
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
    timezone: z
      .string()
      .optional()
      .describe("IANA timezone (e.g. America/Sao_Paulo)"),
  },
  async ({
    summary,
    start_datetime,
    end_datetime,
    description,
    location,
    attendees,
    calendar_id,
    timezone,
  }) => {
    const event: Record<string, unknown> = {
      summary,
      start: { dateTime: start_datetime, timeZone: timezone },
      end: { dateTime: end_datetime, timeZone: timezone },
    };
    if (description) event.description = description;
    if (location) event.location = location;
    if (attendees?.length) {
      event.attendees = attendees.map((email) => ({ email }));
    }

    return executeWithHooks(
      "create_event",
      { summary, start_datetime, end_datetime, description, location, attendees, calendar_id, timezone },
      config,
      () => client.createEvent(calendar_id, event),
    );
  },
);

// 6 ── update_event ──────────────────────────────────────────────────────────
server.tool(
  "update_event",
  "Update an existing calendar event (partial update).",
  {
    event_id: z.string().describe("The event ID to update"),
    summary: z.string().optional().describe("New title"),
    start_datetime: z.string().optional().describe("New start time (RFC3339)"),
    end_datetime: z.string().optional().describe("New end time (RFC3339)"),
    description: z.string().optional().describe("New description"),
    location: z.string().optional().describe("New location"),
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
  },
  async ({
    event_id,
    summary,
    start_datetime,
    end_datetime,
    description,
    location,
    calendar_id,
  }) => {
    const patch: Record<string, unknown> = {};
    if (summary !== undefined) patch.summary = summary;
    if (description !== undefined) patch.description = description;
    if (location !== undefined) patch.location = location;
    if (start_datetime !== undefined)
      patch.start = { dateTime: start_datetime };
    if (end_datetime !== undefined) patch.end = { dateTime: end_datetime };

    return executeWithHooks(
      "update_event",
      { event_id, summary, start_datetime, end_datetime, description, location, calendar_id },
      config,
      () => client.updateEvent(calendar_id, event_id, patch),
    );
  },
);

// 7 ── delete_event ──────────────────────────────────────────────────────────
server.tool(
  "delete_event",
  "Delete an event from a calendar.",
  {
    event_id: z.string().describe("The event ID to delete"),
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
  },
  async ({ event_id, calendar_id }) =>
    executeWithHooks(
      "delete_event",
      { event_id, calendar_id },
      config,
      () => client.deleteEvent(calendar_id, event_id),
    ),
);

// 8 ── quick_add_event ───────────────────────────────────────────────────────
server.tool(
  "quick_add_event",
  "Quick-add an event using natural language text.",
  {
    text: z
      .string()
      .describe(
        'Natural language event description (e.g. "Lunch with John tomorrow at noon")',
      ),
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
  },
  async ({ text, calendar_id }) =>
    executeWithHooks(
      "quick_add_event",
      { text, calendar_id },
      config,
      () => client.quickAddEvent(calendar_id, text),
    ),
);

// 9 ── get_free_busy ─────────────────────────────────────────────────────────
server.tool(
  "get_free_busy",
  "Query free/busy information for a set of calendars.",
  {
    time_min: z.string().describe("Start of the interval (RFC3339)"),
    time_max: z.string().describe("End of the interval (RFC3339)"),
    calendars: z
      .array(z.string())
      .describe("List of calendar IDs to check"),
  },
  async ({ time_min, time_max, calendars }) =>
    executeWithHooks(
      "get_free_busy",
      { time_min, time_max, calendars },
      config,
      () =>
        client.getFreeBusy(
          time_min,
          time_max,
          calendars.map((id) => ({ id })),
        ),
    ),
);

// 10 ── move_event ───────────────────────────────────────────────────────────
server.tool(
  "move_event",
  "Move an event to a different calendar.",
  {
    event_id: z.string().describe("The event ID to move"),
    destination_calendar_id: z
      .string()
      .describe("Destination calendar ID"),
    calendar_id: z
      .string()
      .optional()
      .describe('Source calendar ID (default: "primary")'),
  },
  async ({ event_id, destination_calendar_id, calendar_id }) =>
    executeWithHooks(
      "move_event",
      { event_id, destination_calendar_id, calendar_id },
      config,
      () =>
        client.moveEvent(calendar_id, event_id, destination_calendar_id),
    ),
);

// 11 ── create_recurring_event ───────────────────────────────────────────────
server.tool(
  "create_recurring_event",
  "Create a recurring calendar event with RRULE recurrence strings.",
  {
    summary: z.string().describe("Event title"),
    start_datetime: z.string().describe("Start time (RFC3339)"),
    end_datetime: z.string().describe("End time (RFC3339)"),
    recurrence: z
      .array(z.string())
      .describe(
        'RRULE strings (e.g. ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"])',
      ),
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
  },
  async ({ summary, start_datetime, end_datetime, recurrence, calendar_id }) => {
    const event: Record<string, unknown> = {
      summary,
      start: { dateTime: start_datetime },
      end: { dateTime: end_datetime },
      recurrence,
    };

    return executeWithHooks(
      "create_recurring_event",
      { summary, start_datetime, end_datetime, recurrence, calendar_id },
      config,
      () => client.createEvent(calendar_id, event),
    );
  },
);

// 12 ── get_recurring_instances ───────────────────────────────────────────────
server.tool(
  "get_recurring_instances",
  "Get all instances of a recurring event.",
  {
    event_id: z.string().describe("The recurring event ID"),
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
  },
  async ({ event_id, calendar_id }) =>
    executeWithHooks(
      "get_recurring_instances",
      { event_id, calendar_id },
      config,
      () => client.getRecurringInstances(calendar_id, event_id),
    ),
);

// 13 ── add_attendee ─────────────────────────────────────────────────────────
server.tool(
  "add_attendee",
  "Add an attendee to an existing event.",
  {
    event_id: z.string().describe("The event ID"),
    email: z.string().describe("Email address of the attendee to add"),
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
  },
  async ({ event_id, email, calendar_id }) => {
    // Fetch current event to preserve existing attendees
    const current = await client.getEvent(calendar_id, event_id);
    const existingAttendees = (
      (current.data as Record<string, unknown>)?.attendees ?? []
    ) as Array<{ email: string }>;

    // Avoid duplicates
    if (!existingAttendees.some((a) => a.email === email)) {
      existingAttendees.push({ email });
    }

    return executeWithHooks(
      "add_attendee",
      { event_id, email, calendar_id },
      config,
      () =>
        client.updateEvent(calendar_id, event_id, {
          attendees: existingAttendees,
        }),
    );
  },
);

// 14 ── remove_attendee ──────────────────────────────────────────────────────
server.tool(
  "remove_attendee",
  "Remove an attendee from an existing event.",
  {
    event_id: z.string().describe("The event ID"),
    email: z
      .string()
      .describe("Email address of the attendee to remove"),
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
  },
  async ({ event_id, email, calendar_id }) => {
    const current = await client.getEvent(calendar_id, event_id);
    const existingAttendees = (
      (current.data as Record<string, unknown>)?.attendees ?? []
    ) as Array<{ email: string }>;

    const filtered = existingAttendees.filter(
      (a) => a.email.toLowerCase() !== email.toLowerCase(),
    );

    return executeWithHooks(
      "remove_attendee",
      { event_id, email, calendar_id },
      config,
      () =>
        client.updateEvent(calendar_id, event_id, {
          attendees: filtered,
        }),
    );
  },
);

// 15 ── find_available_slots ─────────────────────────────────────────────────
server.tool(
  "find_available_slots",
  "Find available time slots across one or more calendars.",
  {
    duration_minutes: z
      .number()
      .describe("Required meeting duration in minutes"),
    time_min: z.string().describe("Start of the search range (RFC3339)"),
    time_max: z.string().describe("End of the search range (RFC3339)"),
    calendars: z
      .array(z.string())
      .optional()
      .describe('Calendar IDs to check (defaults to ["primary"])'),
  },
  async ({ duration_minutes, time_min, time_max, calendars }) => {
    const calendarIds = calendars?.length ? calendars : ["primary"];
    const items = calendarIds.map((id) => ({ id }));

    // Fetch free/busy data
    const fbResult = await client.getFreeBusy(time_min, time_max, items);

    if (!fbResult.success) {
      return executeWithHooks(
        "find_available_slots",
        { duration_minutes, time_min, time_max, calendars },
        config,
        async () => fbResult,
      );
    }

    // Parse busy intervals from all calendars
    const fbData = fbResult.data as {
      calendars: Record<
        string,
        { busy: Array<{ start: string; end: string }> }
      >;
    };

    const allBusy: Array<{ start: number; end: number }> = [];
    for (const calId of calendarIds) {
      const calBusy = fbData.calendars?.[calId]?.busy ?? [];
      for (const slot of calBusy) {
        allBusy.push({
          start: new Date(slot.start).getTime(),
          end: new Date(slot.end).getTime(),
        });
      }
    }

    // Sort and merge overlapping busy intervals
    allBusy.sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [];
    for (const interval of allBusy) {
      const last = merged[merged.length - 1];
      if (last && interval.start <= last.end) {
        last.end = Math.max(last.end, interval.end);
      } else {
        merged.push({ ...interval });
      }
    }

    // Find free slots
    const durationMs = duration_minutes * 60 * 1000;
    const rangeStart = new Date(time_min).getTime();
    const rangeEnd = new Date(time_max).getTime();
    const slots: Array<{ start: string; end: string }> = [];

    let cursor = rangeStart;
    for (const busy of merged) {
      if (busy.start - cursor >= durationMs) {
        slots.push({
          start: new Date(cursor).toISOString(),
          end: new Date(cursor + durationMs).toISOString(),
        });
      }
      cursor = Math.max(cursor, busy.end);
    }
    // Check the remaining time after the last busy block
    if (rangeEnd - cursor >= durationMs) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(cursor + durationMs).toISOString(),
      });
    }

    return executeWithHooks(
      "find_available_slots",
      { duration_minutes, time_min, time_max, calendars },
      config,
      async () => ({
        success: true,
        data: { available_slots: slots, total: slots.length } as unknown,
        meta: { latency_ms: 0, endpoint: "/freeBusy", method: "POST" },
      }),
    );
  },
);

// 16 ── get_upcoming_events ──────────────────────────────────────────────────
server.tool(
  "get_upcoming_events",
  "Get the next upcoming events from now.",
  {
    max_results: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of events (default: 10)"),
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
  },
  async ({ max_results, calendar_id }) =>
    executeWithHooks(
      "get_upcoming_events",
      { max_results, calendar_id },
      config,
      () =>
        client.listEvents(
          calendar_id,
          new Date().toISOString(),
          undefined,
          max_results,
          undefined,
          true,
          "startTime",
        ),
    ),
);

// 17 ── get_colors ───────────────────────────────────────────────────────────
server.tool(
  "get_colors",
  "Get the color definitions available in Google Calendar.",
  {},
  async () =>
    executeWithHooks("get_colors", {}, config, () => client.getColors()),
);

// 18 ── set_event_color ──────────────────────────────────────────────────────
server.tool(
  "set_event_color",
  "Set the color of a calendar event.",
  {
    event_id: z.string().describe("The event ID"),
    color_id: z
      .string()
      .describe(
        'Google Calendar color ID (1-11). 1=Lavender, 2=Sage, 3=Grape, 4=Flamingo, 5=Banana, 6=Tangerine, 7=Peacock, 8=Graphite, 9=Blueberry, 10=Basil, 11=Tomato',
      ),
    calendar_id: z
      .string()
      .optional()
      .describe('Calendar ID (default: "primary")'),
  },
  async ({ event_id, color_id, calendar_id }) =>
    executeWithHooks(
      "set_event_color",
      { event_id, color_id, calendar_id },
      config,
      () =>
        client.updateEvent(calendar_id, event_id, { colorId: color_id }),
    ),
);

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCES (3)
// ═══════════════════════════════════════════════════════════════════════════════

server.resource(
  "calendars",
  "gcal://calendars",
  async () => {
    const result = await client.listCalendars();
    return {
      contents: [
        {
          uri: "gcal://calendars",
          mimeType: "application/json",
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  },
);

server.resource(
  "events",
  "gcal://events",
  async () => {
    const result = await client.listEvents(
      undefined,
      new Date().toISOString(),
      undefined,
      50,
      undefined,
      true,
      "startTime",
    );
    return {
      contents: [
        {
          uri: "gcal://events",
          mimeType: "application/json",
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  },
);

server.resource(
  "settings",
  "gcal://settings",
  async () => {
    const result = await client.request("/users/me/settings");
    return {
      contents: [
        {
          uri: "gcal://settings",
          mimeType: "application/json",
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS (3 — PT-BR)
// ═══════════════════════════════════════════════════════════════════════════════

server.prompt(
  "agendador-reunioes",
  "Agende reunioes de forma inteligente verificando disponibilidade.",
  {
    participantes: z
      .string()
      .describe("Emails dos participantes separados por virgula"),
    duracao: z
      .string()
      .optional()
      .describe("Duracao em minutos (padrao: 60)"),
    periodo: z
      .string()
      .optional()
      .describe('Periodo para buscar (ex: "proxima semana")'),
  },
  ({ participantes, duracao, periodo }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Preciso agendar uma reuniao com: ${participantes}.`,
            `Duracao: ${duracao || "60"} minutos.`,
            periodo ? `Periodo preferido: ${periodo}.` : "",
            "",
            "Passos:",
            "1. Use find_available_slots para encontrar horarios livres.",
            "2. Apresente as melhores opcoes.",
            "3. Apos confirmacao, use create_event para agendar.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      },
    ],
  }),
);

server.prompt(
  "buscador-disponibilidade",
  "Encontre horarios livres para reunioes.",
  {
    calendarios: z
      .string()
      .optional()
      .describe("IDs dos calendarios separados por virgula"),
    dias: z
      .string()
      .optional()
      .describe("Numero de dias para buscar (padrao: 7)"),
  },
  ({ calendarios, dias }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "Mostre minha disponibilidade para os proximos dias.",
            calendarios
              ? `Calendarios: ${calendarios}`
              : 'Calendario: "primary".',
            `Periodo: proximos ${dias || "7"} dias.`,
            "",
            "Use get_free_busy e list_events para montar um resumo claro dos horarios livres.",
          ].join("\n"),
        },
      },
    ],
  }),
);

server.prompt(
  "organizador-calendario",
  "Organize e gerencie seus eventos do calendario.",
  {
    acao: z
      .string()
      .describe(
        'Acao desejada (ex: "listar eventos da semana", "cancelar reuniao X")',
      ),
  },
  ({ acao }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Preciso: ${acao}`,
            "",
            "Use as ferramentas do Google Calendar disponiveis para executar esta acao.",
            "Ferramentas: list_events, get_event, create_event, update_event, delete_event, quick_add_event, move_event, etc.",
          ].join("\n"),
        },
      },
    ],
  }),
);

// ═══════════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    "BridgeAPI Google Calendar MCP Server v0.1.0 running on stdio",
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
