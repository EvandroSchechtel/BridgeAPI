#!/usr/bin/env node
/**
 * @bridgeapi/mcp-calendly — MCP Server for Calendly API
 *
 * Connect any AI Agent to Calendly via the Model Context Protocol.
 * Part of the BridgeAPI ecosystem: https://bridgeapi.com.br
 *
 * Phase 1: passthrough with structured logging (hooks are no-ops)
 * Phase 2: Execution Engine plugs into pre/post hooks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  CalendlyClient,
  preExecuteHook,
  postExecuteHook,
  type CalendlyConfig,
  type HookContext,
  type ApiResponse,
} from "./calendly-client.js";

// ─── CONFIG ──────────────────────────────────────────────────

function loadConfig(): CalendlyConfig {
  const accessToken = process.env.CALENDLY_ACCESS_TOKEN;
  if (!accessToken) throw new Error("CALENDLY_ACCESS_TOKEN is required");
  return { accessToken };
}

// ─── TOOL WRAPPER WITH HOOKS ─────────────────────────────────

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: CalendlyConfig,
  executor: () => Promise<ApiResponse<T>>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const hookCtx: HookContext = {
    tool_name: toolName,
    params,
    config,
    timestamp: new Date().toISOString(),
  };

  // PRE-EXECUTE HOOK (Phase 1: always allows)
  const preResult = await preExecuteHook(hookCtx);
  if (!preResult.allow) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            blocked: true,
            reason: preResult.reason || "Blocked by execution policy",
            escalation_id: preResult.escalation_id,
          }),
        },
      ],
    };
  }

  // EXECUTE
  const response = await executor();

  // POST-EXECUTE HOOK (Phase 1: always accepts)
  const postResult = await postExecuteHook(hookCtx, response);

  // FORMAT RESPONSE
  const output: Record<string, unknown> = {
    success: response.success,
    ...(response.data ? { data: response.data } : {}),
    ...(response.error ? { error: response.error } : {}),
    meta: {
      ...response.meta,
      confidence_score: null,
      execution_mode: "auto",
      flags: postResult.flags || [],
    },
  };

  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
  };
}

// ─── SERVER SETUP ────────────────────────────────────────────

const config = loadConfig();
const calendly = new CalendlyClient(config);

const server = new McpServer(
  {
    name: "bridgeapi-calendly",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false },
      prompts: { listChanged: false },
    },
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOLS (16)
// ═══════════════════════════════════════════════════════════════

// ─── USER ────────────────────────────────────────────────────

server.tool(
  "get_current_user",
  "Get your Calendly profile. Returns user URI, name, email, timezone, organization URI, and scheduling URL.",
  {},
  async () =>
    executeWithHooks("get_current_user", {}, config, () =>
      calendly.getCurrentUser()
    )
);

// ─── EVENT TYPES ─────────────────────────────────────────────

server.tool(
  "get_event_types",
  "List your Calendly event types (meeting templates). Filter by user URI. Returns name, duration, scheduling URL, color, and active status.",
  {
    user_uri: z
      .string()
      .optional()
      .describe(
        "User URI to filter event types (e.g., https://api.calendly.com/users/XXXXXXXX). If omitted, fetches for current user."
      ),
    count: z
      .number()
      .optional()
      .describe("Number of results per page (default: 20, max: 100)"),
    page_token: z
      .string()
      .optional()
      .describe("Token for pagination from previous response"),
  },
  async ({ user_uri, count, page_token }) =>
    executeWithHooks(
      "get_event_types",
      { user_uri, count, page_token },
      config,
      () =>
        calendly.getEventTypes({
          userUri: user_uri,
          count,
          pageToken: page_token,
        })
    )
);

server.tool(
  "get_event_type",
  "Get details of a specific event type by UUID. Returns full configuration including duration, description, scheduling rules, and custom questions.",
  {
    uuid: z
      .string()
      .describe(
        "Event type UUID (the last segment of the event type URI)"
      ),
  },
  async ({ uuid }) =>
    executeWithHooks("get_event_type", { uuid }, config, () =>
      calendly.getEventType(uuid)
    )
);

// ─── SCHEDULED EVENTS ────────────────────────────────────────

server.tool(
  "get_scheduled_events",
  "List scheduled events (booked meetings). Filter by user, date range, and status. Returns event details including start/end time, invitees count, and location.",
  {
    user_uri: z
      .string()
      .optional()
      .describe(
        "User URI to filter events. If omitted, fetches for current user."
      ),
    min_start_time: z
      .string()
      .optional()
      .describe(
        "Lower bound for event start time in ISO 8601 format (e.g., 2026-03-01T00:00:00Z)"
      ),
    max_start_time: z
      .string()
      .optional()
      .describe(
        "Upper bound for event start time in ISO 8601 format (e.g., 2026-03-31T23:59:59Z)"
      ),
    status: z
      .string()
      .optional()
      .describe("Filter by status: active or canceled"),
    count: z
      .number()
      .optional()
      .describe("Number of results per page (default: 20, max: 100)"),
    page_token: z
      .string()
      .optional()
      .describe("Token for pagination from previous response"),
  },
  async ({ user_uri, min_start_time, max_start_time, status, count, page_token }) =>
    executeWithHooks(
      "get_scheduled_events",
      { user_uri, min_start_time, max_start_time, status, count, page_token },
      config,
      () =>
        calendly.getScheduledEvents({
          userUri: user_uri,
          minStartTime: min_start_time,
          maxStartTime: max_start_time,
          status,
          count,
          pageToken: page_token,
        })
    )
);

server.tool(
  "get_scheduled_event",
  "Get full details of a single scheduled event by UUID. Returns event name, start/end time, location, status, invitees, and cancellation info.",
  {
    uuid: z
      .string()
      .describe(
        "Scheduled event UUID (the last segment of the event URI)"
      ),
  },
  async ({ uuid }) =>
    executeWithHooks("get_scheduled_event", { uuid }, config, () =>
      calendly.getScheduledEvent(uuid)
    )
);

// ─── INVITEES ────────────────────────────────────────────────

server.tool(
  "get_event_invitees",
  "List invitees (attendees) of a scheduled event. Returns name, email, status, questions/answers, timezone, and tracking info.",
  {
    event_uuid: z
      .string()
      .describe("Scheduled event UUID to list invitees for"),
    count: z
      .number()
      .optional()
      .describe("Number of results per page (default: 20, max: 100)"),
    page_token: z
      .string()
      .optional()
      .describe("Token for pagination from previous response"),
  },
  async ({ event_uuid, count, page_token }) =>
    executeWithHooks(
      "get_event_invitees",
      { event_uuid, count, page_token },
      config,
      () =>
        calendly.getEventInvitees(event_uuid, {
          count,
          pageToken: page_token,
        })
    )
);

// ─── CANCEL EVENT ────────────────────────────────────────────

server.tool(
  "cancel_event",
  "Cancel a scheduled event. Sends cancellation notifications to all invitees. Optionally provide a cancellation reason.",
  {
    uuid: z
      .string()
      .describe("Scheduled event UUID to cancel"),
    reason: z
      .string()
      .optional()
      .describe("Reason for cancellation (sent to invitees in the notification)"),
  },
  async ({ uuid, reason }) =>
    executeWithHooks("cancel_event", { uuid, reason }, config, () =>
      calendly.cancelEvent(uuid, reason)
    )
);

// ─── WEBHOOKS ────────────────────────────────────────────────

server.tool(
  "get_webhook_subscriptions",
  "List active webhook subscriptions for the organization. Returns URL, events, scope, and creation date.",
  {
    organization_uri: z
      .string()
      .describe("Organization URI (from user profile)"),
    scope: z
      .string()
      .optional()
      .describe("Filter by scope: organization or user"),
  },
  async ({ organization_uri, scope }) =>
    executeWithHooks(
      "get_webhook_subscriptions",
      { organization_uri, scope },
      config,
      () => calendly.getWebhookSubscriptions(organization_uri, scope)
    )
);

server.tool(
  "create_webhook_subscription",
  "Create a new webhook subscription. Calendly will POST event data to your URL when specified events occur.",
  {
    url: z
      .string()
      .describe("The URL Calendly will POST webhook events to (must be HTTPS)"),
    events: z
      .array(z.string())
      .describe(
        "List of events to subscribe to: invitee.created, invitee.canceled, routing_form_submission.created"
      ),
    organization_uri: z
      .string()
      .describe("Organization URI (from user profile)"),
    scope: z
      .string()
      .optional()
      .describe("Webhook scope: organization (default) or user"),
  },
  async ({ url, events, organization_uri, scope }) =>
    executeWithHooks(
      "create_webhook_subscription",
      { url, events, organization_uri, scope },
      config,
      () =>
        calendly.createWebhookSubscription({
          url,
          events,
          organizationUri: organization_uri,
          scope,
        })
    )
);

server.tool(
  "delete_webhook_subscription",
  "Delete/unsubscribe an existing webhook. Stops Calendly from sending events to the webhook URL.",
  {
    uuid: z
      .string()
      .describe("Webhook subscription UUID to delete"),
  },
  async ({ uuid }) =>
    executeWithHooks("delete_webhook_subscription", { uuid }, config, () =>
      calendly.deleteWebhookSubscription(uuid)
    )
);

// ─── AVAILABILITY ────────────────────────────────────────────

server.tool(
  "get_user_availability",
  "Get a user's availability schedule. Returns available time slots within the given date range.",
  {
    user_uri: z
      .string()
      .describe("User URI to check availability for"),
    start_time: z
      .string()
      .describe("Start of availability window in ISO 8601 format (e.g., 2026-03-22T00:00:00Z)"),
    end_time: z
      .string()
      .describe("End of availability window in ISO 8601 format (e.g., 2026-03-29T23:59:59Z)"),
  },
  async ({ user_uri, start_time, end_time }) =>
    executeWithHooks(
      "get_user_availability",
      { user_uri, start_time, end_time },
      config,
      () => calendly.getUserAvailability(user_uri, start_time, end_time)
    )
);

// ─── ORGANIZATION ────────────────────────────────────────────

server.tool(
  "get_organization_memberships",
  "List members of the Calendly organization. Returns user details, roles, and join date.",
  {
    organization_uri: z
      .string()
      .optional()
      .describe("Organization URI. If omitted, uses current user's organization."),
  },
  async ({ organization_uri }) =>
    executeWithHooks(
      "get_organization_memberships",
      { organization_uri },
      config,
      () => calendly.getOrganizationMemberships(organization_uri)
    )
);

// ─── ROUTING FORMS ───────────────────────────────────────────

server.tool(
  "get_routing_forms",
  "List routing forms for the organization. Returns form name, questions, and routing rules.",
  {
    organization_uri: z
      .string()
      .optional()
      .describe("Organization URI to filter routing forms"),
  },
  async ({ organization_uri }) =>
    executeWithHooks(
      "get_routing_forms",
      { organization_uri },
      config,
      () => calendly.getRoutingForms(organization_uri)
    )
);

server.tool(
  "get_routing_form_submissions",
  "List submissions for a routing form. Returns answers, routing results, and submission timestamps.",
  {
    form_uuid: z
      .string()
      .optional()
      .describe("Routing form UUID to filter submissions"),
  },
  async ({ form_uuid }) =>
    executeWithHooks(
      "get_routing_form_submissions",
      { form_uuid },
      config,
      () => calendly.getRoutingFormSubmissions(form_uuid)
    )
);

// ─── NO-SHOW ─────────────────────────────────────────────────

server.tool(
  "mark_no_show",
  "Mark an invitee as a no-show for a scheduled event. Useful for tracking attendance and analytics.",
  {
    invitee_uri: z
      .string()
      .describe(
        "Full invitee URI (e.g., https://api.calendly.com/scheduled_events/XXX/invitees/YYY)"
      ),
  },
  async ({ invitee_uri }) =>
    executeWithHooks("mark_no_show", { invitee_uri }, config, () =>
      calendly.markNoShow(invitee_uri)
    )
);

// ─── ACTIVITY LOG ────────────────────────────────────────────

server.tool(
  "get_activity_log",
  "Get the organization's activity log. Returns recent actions like event creation, cancellation, and settings changes.",
  {
    organization_uri: z
      .string()
      .optional()
      .describe("Organization URI to filter activity log"),
  },
  async ({ organization_uri }) =>
    executeWithHooks(
      "get_activity_log",
      { organization_uri },
      config,
      () => calendly.getActivityLog(organization_uri)
    )
);

// ═══════════════════════════════════════════════════════════════
// RESOURCES (read-only context for agents)
// ═══════════════════════════════════════════════════════════════

server.resource("event-types", "calendly://event-types", async () => {
  const result = await calendly.getEventTypes({ count: 100 });
  return {
    contents: [
      {
        uri: "calendly://event-types",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("scheduled-events", "calendly://scheduled-events", async () => {
  const result = await calendly.getScheduledEvents({ count: 100 });
  return {
    contents: [
      {
        uri: "calendly://scheduled-events",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("profile", "calendly://profile", async () => {
  const result = await calendly.getCurrentUser();
  return {
    contents: [
      {
        uri: "calendly://profile",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

// ═══════════════════════════════════════════════════════════════
// PROMPTS (reusable templates — PT-BR)
// ═══════════════════════════════════════════════════════════════

server.prompt(
  "agendador",
  "Guia para agendar e gerenciar reuniões no Calendly",
  {
    action: z
      .string()
      .describe(
        "Ação desejada: listar, cancelar, consultar_invitees, marcar_no_show"
      ),
    event_info: z
      .string()
      .optional()
      .describe("UUID do evento ou intervalo de datas (ISO 8601)"),
  },
  ({ action, event_info }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso gerenciar reuniões no Calendly. Ação: "${action}"${event_info ? `. Info: ${event_info}` : ""}.

Passos:
1. Use get_current_user para obter seu user_uri e organization_uri.
2. Dependendo da ação:
   - **listar**: use get_scheduled_events com filtros de data e status.
   - **cancelar**: use get_scheduled_event para confirmar detalhes, depois cancel_event com motivo.
   - **consultar_invitees**: use get_event_invitees com o event_uuid.
   - **marcar_no_show**: use get_event_invitees para encontrar o invitee_uri, depois mark_no_show.

IMPORTANTE:
- Cancelamentos enviam notificações automáticas a todos os convidados.
- Sempre confirme a ação com o usuário antes de cancelar.
- Use min_start_time e max_start_time em formato ISO 8601 (ex: 2026-03-22T00:00:00Z).
- Paginação: use page_token do resultado anterior para obter mais resultados.`,
        },
      },
    ],
  })
);

server.prompt(
  "disponibilidade",
  "Guia para consultar disponibilidade e tipos de evento no Calendly",
  {
    period: z
      .string()
      .optional()
      .describe("Período de consulta: hoje, semana, mes, ou datas ISO 8601"),
  },
  ({ period }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso verificar disponibilidade no Calendly${period ? ` para o período: ${period}` : ""}.

Passos:
1. Use get_current_user para obter o user_uri.
2. Use get_event_types para ver os tipos de reunião configurados (duração, link, status ativo/inativo).
3. Use get_user_availability com start_time e end_time para ver os horários livres.
4. Use get_scheduled_events no mesmo período para ver reuniões já agendadas.

DICAS:
- Compare availability vs scheduled_events para entender a ocupação real.
- Event types inativos não aparecem na página de agendamento — use get_event_types para identificar.
- Horários estão no timezone do usuário (veja campo timezone no perfil).
- Para ver horários livres de outra pessoa da organização, use get_organization_memberships primeiro.`,
        },
      },
    ],
  })
);

server.prompt(
  "configurador-webhooks",
  "Guia para configurar webhooks e integrações no Calendly",
  {
    webhook_url: z
      .string()
      .optional()
      .describe("URL do webhook a ser configurado"),
  },
  ({ webhook_url }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso configurar webhooks no Calendly${webhook_url ? ` para a URL: ${webhook_url}` : ""}.

Passos:
1. Use get_current_user para obter o organization_uri.
2. Use get_webhook_subscriptions para ver webhooks existentes (evitar duplicatas).
3. Use create_webhook_subscription para criar um novo webhook.

EVENTOS DISPONÍVEIS:
- invitee.created — quando alguém agenda uma reunião.
- invitee.canceled — quando um agendamento é cancelado.
- routing_form_submission.created — quando alguém envia um formulário de roteamento.

BOAS PRÁTICAS:
- A URL deve ser HTTPS e acessível publicamente.
- Scope "organization" recebe eventos de todos os membros; "user" apenas do usuário autenticado.
- Implemente verificação de assinatura no seu endpoint para validar a origem.
- Use get_webhook_subscriptions periodicamente para verificar se os webhooks estão ativos.
- Para remover, use delete_webhook_subscription com o UUID do webhook.

FLUXOS COMUNS:
- CRM: invitee.created → cria lead + invitee.canceled → atualiza status.
- Notificação WhatsApp: invitee.created → envia confirmação via Z-API/ManyChat.
- Analytics: todos os eventos → dashboard de métricas de agendamento.`,
        },
      },
    ],
  })
);

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BridgeAPI Calendly MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
