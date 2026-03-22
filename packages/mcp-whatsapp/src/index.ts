#!/usr/bin/env node
/**
 * @bridgeapi/mcp-whatsapp — MCP Server for WhatsApp Business Cloud API
 *
 * Connect any AI Agent to WhatsApp via the Model Context Protocol.
 * Part of the BridgeAPI ecosystem: https://bridgeapi.com.br
 *
 * Phase 1: passthrough with structured logging (hooks are no-ops)
 * Phase 2: Execution Engine plugs into pre/post hooks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  WhatsAppClient,
  preExecuteHook,
  postExecuteHook,
  type WhatsAppConfig,
  type HookContext,
  type ApiResponse,
} from "./whatsapp-client.js";

// ─── CONFIG ──────────────────────────────────────────────────

function loadConfig(): WhatsAppConfig {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";

  if (!accessToken) throw new Error("WHATSAPP_ACCESS_TOKEN is required");
  if (!phoneNumberId) throw new Error("WHATSAPP_PHONE_NUMBER_ID is required");
  if (!businessAccountId)
    throw new Error("WHATSAPP_BUSINESS_ACCOUNT_ID is required");

  return { accessToken, phoneNumberId, businessAccountId, apiVersion };
}

// ─── TOOL WRAPPER WITH HOOKS ─────────────────────────────────
// Every tool call goes through this wrapper.
// Phase 1: hooks are no-ops that log.
// Phase 2: hooks evaluate confidence and may block/escalate.

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: WhatsAppConfig,
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
      // Phase 2 fields (null in Phase 1, ready for expansion)
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
const wa = new WhatsAppClient(config);

const server = new McpServer(
  {
    name: "bridgeapi-whatsapp",
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
// TOOLS
// ═══════════════════════════════════════════════════════════════

// ─── MESSAGING TOOLS ─────────────────────────────────────────

server.tool(
  "send_text_message",
  "Send a text message to a WhatsApp number. Works within the 24-hour conversation window. For messages outside this window, use send_template_message instead.",
  {
    to: z.string().describe("Recipient phone number in international format (e.g., 5541999999999)"),
    body: z.string().describe("Message text content"),
    preview_url: z.boolean().optional().default(false).describe("Whether to show URL previews"),
  },
  async ({ to, body, preview_url }) =>
    executeWithHooks("send_text_message", { to, body, preview_url }, config, () =>
      wa.sendTextMessage(to, body, preview_url)
    )
);

server.tool(
  "send_template_message",
  "Send a pre-approved template message. Required for initiating conversations outside the 24-hour window. Templates must be approved by Meta before use.",
  {
    to: z.string().describe("Recipient phone number in international format"),
    template_name: z.string().describe("Name of the approved template"),
    language: z.string().default("pt_BR").describe("Template language code (e.g., pt_BR, en_US)"),
    components: z
      .array(z.record(z.string(), z.unknown()))
      .optional()
      .describe("Template components with variable values (header, body, button params)"),
  },
  async ({ to, template_name, language, components }) =>
    executeWithHooks(
      "send_template_message",
      { to, template_name, language, components },
      config,
      () => wa.sendTemplateMessage(to, template_name, language, components)
    )
);

server.tool(
  "send_media_message",
  "Send an image, video, audio, or document to a WhatsApp number.",
  {
    to: z.string().describe("Recipient phone number in international format"),
    media_type: z.enum(["image", "video", "audio", "document"]).describe("Type of media to send"),
    media_url: z.string().optional().describe("Public URL of the media file"),
    media_id: z.string().optional().describe("Media ID from a previous upload"),
    caption: z.string().optional().describe("Caption for the media (images and videos only)"),
    filename: z.string().optional().describe("Filename for documents"),
  },
  async ({ to, media_type, media_url, media_id, caption, filename }) => {
    const media: Record<string, string> = {};
    if (media_url) media.link = media_url;
    if (media_id) media.id = media_id;
    if (caption) media.caption = caption;
    if (filename) media.filename = filename;

    return executeWithHooks(
      "send_media_message",
      { to, media_type, media_url, media_id, caption, filename },
      config,
      () => wa.sendMediaMessage(to, media_type, media)
    );
  }
);

server.tool(
  "send_interactive_message",
  "Send an interactive message with buttons or a selection list.",
  {
    to: z.string().describe("Recipient phone number"),
    interactive_type: z.enum(["button", "list"]).describe("Type of interactive message"),
    body_text: z.string().describe("Main body text of the message"),
    buttons: z
      .array(z.object({ id: z.string(), title: z.string() }))
      .optional()
      .describe("Buttons array (max 3) for button type. Each needs id and title."),
    sections: z
      .array(
        z.object({
          title: z.string(),
          rows: z.array(z.object({ id: z.string(), title: z.string(), description: z.string().optional() })),
        })
      )
      .optional()
      .describe("Sections for list type. Each section has title and rows."),
    header_text: z.string().optional().describe("Header text"),
    footer_text: z.string().optional().describe("Footer text"),
    button_text: z.string().optional().default("Menu").describe("Button label for list type"),
  },
  async ({ to, interactive_type, body_text, buttons, sections, header_text, footer_text, button_text }) => {
    const action: Record<string, unknown> =
      interactive_type === "button"
        ? { buttons: (buttons || []).map((b) => ({ type: "reply", reply: b })) }
        : { button: button_text, sections: sections || [] };

    return executeWithHooks(
      "send_interactive_message",
      { to, interactive_type, body_text },
      config,
      () =>
        wa.sendInteractiveMessage(to, interactive_type, {
          ...(header_text ? { header: { type: "text", text: header_text } } : {}),
          body: { text: body_text },
          ...(footer_text ? { footer: { text: footer_text } } : {}),
          action,
        })
    );
  }
);

server.tool(
  "send_location_message",
  "Send a location pin to a WhatsApp number.",
  {
    to: z.string().describe("Recipient phone number"),
    latitude: z.number().describe("Location latitude"),
    longitude: z.number().describe("Location longitude"),
    name: z.string().optional().describe("Location name"),
    address: z.string().optional().describe("Location address"),
  },
  async ({ to, latitude, longitude, name, address }) =>
    executeWithHooks("send_location_message", { to, latitude, longitude }, config, () =>
      wa.sendLocationMessage(to, { latitude, longitude, name, address })
    )
);

server.tool(
  "send_contact_message",
  "Send a contact card to a WhatsApp number.",
  {
    to: z.string().describe("Recipient phone number"),
    contacts: z
      .array(
        z.object({
          name: z.object({ formatted_name: z.string(), first_name: z.string().optional() }),
          phones: z.array(z.object({ phone: z.string(), type: z.string().optional() })).optional(),
          emails: z.array(z.object({ email: z.string(), type: z.string().optional() })).optional(),
        })
      )
      .describe("Array of contact cards to send"),
  },
  async ({ to, contacts }) =>
    executeWithHooks("send_contact_message", { to, contacts }, config, () =>
      wa.sendContactMessage(to, contacts)
    )
);

server.tool(
  "mark_message_read",
  "Mark a received message as read (blue checkmarks). Use the message_id from a received webhook.",
  {
    message_id: z.string().describe("The wamid of the message to mark as read"),
  },
  async ({ message_id }) =>
    executeWithHooks("mark_message_read", { message_id }, config, () =>
      wa.markMessageRead(message_id)
    )
);

// ─── TEMPLATE TOOLS ──────────────────────────────────────────

server.tool(
  "list_templates",
  "List all message templates in the WhatsApp Business Account, optionally filtered by status.",
  {
    status: z
      .enum(["APPROVED", "PENDING", "REJECTED"])
      .optional()
      .describe("Filter templates by approval status"),
    limit: z.number().optional().default(20).describe("Max templates to return"),
  },
  async ({ status, limit }) =>
    executeWithHooks("list_templates", { status, limit }, config, () =>
      wa.listTemplates({ status, limit })
    )
);

server.tool(
  "create_template",
  "Create a new message template for approval by Meta. Templates are required for outbound messages outside the 24-hour window.",
  {
    name: z.string().describe("Template name (lowercase, underscores only)"),
    language: z.string().default("pt_BR").describe("Template language code"),
    category: z
      .enum(["MARKETING", "UTILITY", "AUTHENTICATION"])
      .describe("Template category — affects pricing and approval rules"),
    components: z
      .array(z.record(z.string(), z.unknown()))
      .describe("Template components: HEADER, BODY, FOOTER, BUTTONS"),
  },
  async ({ name, language, category, components }) =>
    executeWithHooks("create_template", { name, language, category }, config, () =>
      wa.createTemplate({ name, language, category, components })
    )
);

server.tool(
  "delete_template",
  "Delete a message template by name. This action is irreversible.",
  {
    template_name: z.string().describe("Name of the template to delete"),
  },
  async ({ template_name }) =>
    executeWithHooks("delete_template", { template_name }, config, () =>
      wa.deleteTemplate(template_name)
    )
);

// ─── ACCOUNT TOOLS ───────────────────────────────────────────

server.tool(
  "get_phone_numbers",
  "List all phone numbers registered on this WhatsApp Business Account, including quality rating and messaging limits.",
  {},
  async () =>
    executeWithHooks("get_phone_numbers", {}, config, () => wa.getPhoneNumbers())
);

server.tool(
  "get_business_profile",
  "Get the WhatsApp Business profile (about, address, description, email, websites, profile picture).",
  {},
  async () =>
    executeWithHooks("get_business_profile", {}, config, () =>
      wa.getBusinessProfile()
    )
);

server.tool(
  "update_business_profile",
  "Update the WhatsApp Business profile information.",
  {
    about: z.string().optional().describe("Short description (max 139 chars)"),
    description: z.string().optional().describe("Business description (max 512 chars)"),
    address: z.string().optional().describe("Business address"),
    email: z.string().optional().describe("Business email"),
    websites: z.array(z.string()).optional().describe("Business website URLs (max 2)"),
  },
  async (params) =>
    executeWithHooks("update_business_profile", params, config, () =>
      wa.updateBusinessProfile(params)
    )
);

// ─── ANALYTICS TOOLS ─────────────────────────────────────────

server.tool(
  "get_analytics",
  "Get messaging analytics (sent, delivered, read counts) for a date range.",
  {
    start_date: z.string().describe("Start date in UNIX timestamp format"),
    end_date: z.string().describe("End date in UNIX timestamp format"),
    granularity: z
      .enum(["HALF_HOUR", "DAY", "MONTH"])
      .default("DAY")
      .describe("Data granularity"),
  },
  async ({ start_date, end_date, granularity }) =>
    executeWithHooks(
      "get_analytics",
      { start_date, end_date, granularity },
      config,
      () => wa.getAnalytics({ start: start_date, end: end_date, granularity })
    )
);

// ─── MEDIA TOOLS ─────────────────────────────────────────────

server.tool(
  "upload_media",
  "Upload a media file for later sending. Returns a media_id that can be used with send_media_message.",
  {
    file_url: z.string().describe("Public URL of the file to upload"),
    type: z.string().describe("MIME type (e.g., image/jpeg, application/pdf)"),
  },
  async ({ file_url, type }) =>
    executeWithHooks("upload_media", { file_url, type }, config, () =>
      wa.uploadMedia(file_url, type)
    )
);

server.tool(
  "get_media_url",
  "Get the download URL for a received media file. URLs are valid for 5 minutes.",
  {
    media_id: z.string().describe("Media ID from a received message webhook"),
  },
  async ({ media_id }) =>
    executeWithHooks("get_media_url", { media_id }, config, () =>
      wa.getMediaUrl(media_id)
    )
);

// ═══════════════════════════════════════════════════════════════
// RESOURCES (read-only context for agents)
// ═══════════════════════════════════════════════════════════════

server.resource("templates", "whatsapp://templates", async () => {
  const result = await wa.listTemplates({ limit: 100 });
  return {
    contents: [
      {
        uri: "whatsapp://templates",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("business-profile", "whatsapp://profile", async () => {
  const result = await wa.getBusinessProfile();
  return {
    contents: [
      {
        uri: "whatsapp://profile",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("phone-numbers", "whatsapp://phone-numbers", async () => {
  const result = await wa.getPhoneNumbers();
  return {
    contents: [
      {
        uri: "whatsapp://phone-numbers",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

// ═══════════════════════════════════════════════════════════════
// PROMPTS (reusable templates for common tasks)
// ═══════════════════════════════════════════════════════════════

server.prompt(
  "campaign-sender",
  "Guide for sending a marketing campaign via WhatsApp templates",
  {
    product_name: z.string().describe("Name of the product/offer to promote"),
    audience_size: z.string().optional().describe("Approximate number of recipients"),
  },
  ({ product_name, audience_size }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso enviar uma campanha de marketing para o produto "${product_name}"${audience_size ? ` para aproximadamente ${audience_size} contatos` : ""}.

Passos:
1. Primeiro, use list_templates para verificar se já existe um template aprovado para esse tipo de campanha.
2. Se não existir, use create_template para criar um com categoria MARKETING.
3. Após aprovação, use send_template_message para enviar aos contatos.

IMPORTANTE:
- Templates de marketing estão sujeitos a Template Pacing da Meta (começa com ~1.000 envios e escala).
- Verifique o quality_rating do número antes de enviar alto volume via get_phone_numbers.
- Custo por mensagem de marketing no Brasil: ~R$0,30 por mensagem entregue.`,
        },
      },
    ],
  })
);

server.prompt(
  "support-responder",
  "Guide for handling customer support messages on WhatsApp",
  {
    context: z.string().optional().describe("Additional context about the customer inquiry"),
  },
  ({ context }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso responder uma mensagem de suporte no WhatsApp${context ? `. Contexto: ${context}` : ""}.

Regras:
1. Mensagens de serviço (iniciadas pelo cliente) são GRATUITAS dentro da janela de 24 horas.
2. Dentro dessa janela, use send_text_message ou send_interactive_message livremente.
3. Use mark_message_read para marcar como lida antes de responder.
4. Se a janela de 24h expirou, APENAS templates aprovados funcionam (use send_template_message).
5. Para respostas rápidas, use send_interactive_message com botões (max 3 botões).
6. Para menus complexos, use send_interactive_message com lista.`,
        },
      },
    ],
  })
);

server.prompt(
  "template-creator",
  "Guide for creating a WhatsApp message template following Meta's rules",
  {
    purpose: z.string().describe("What the template is for (e.g., order confirmation, promotion)"),
    category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).describe("Template category"),
  },
  ({ purpose, category }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso criar um template de WhatsApp para: "${purpose}" (categoria: ${category}).

Regras da Meta para aprovação:
1. Nome do template: apenas letras minúsculas e underscores (ex: confirmacao_pedido).
2. Não use capitalização excessiva ou linguagem vaga.
3. Inclua sempre uma opção de opt-out para templates de MARKETING.
4. Variáveis usam formato {{1}}, {{2}}, etc.
5. HEADER pode ser text, image, video ou document.
6. BODY é obrigatório e contém o texto principal.
7. FOOTER é opcional (max 60 chars).
8. BUTTONS: máximo 3 (quick_reply ou call_to_action com URL ou phone).

Use create_template com esses componentes formatados corretamente.
Após criar, o template leva de algumas horas até 48h para ser aprovado.
Use list_templates para verificar o status.`,
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
  console.error("BridgeAPI WhatsApp MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
