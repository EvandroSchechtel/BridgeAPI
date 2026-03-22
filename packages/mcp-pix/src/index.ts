#!/usr/bin/env node
/**
 * @bridgeapi/mcp-pix — MCP Server for Pix API
 *
 * Exposes 15 Pix-specific tools, 3 resources, and 3 prompts
 * for AI agents to interact with the Brazilian Pix instant payment system.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  PixClient,
  preExecuteHook,
  postExecuteHook,
  type PixConfig,
  type HookContext,
  type ApiResponse,
  type Psp,
  type Environment,
} from "./pix-client.js";

// ── Config loader ──────────────────────────────────────────────────────

function loadConfig(): PixConfig {
  const clientId = process.env.PIX_CLIENT_ID;
  if (!clientId) throw new Error("PIX_CLIENT_ID is required");

  const clientSecret = process.env.PIX_CLIENT_SECRET;
  if (!clientSecret) throw new Error("PIX_CLIENT_SECRET is required");

  const pixKey = process.env.PIX_KEY;
  if (!pixKey) throw new Error("PIX_KEY is required");

  const certificatePath = process.env.PIX_CERTIFICATE_PATH || "";
  const psp = (process.env.PIX_PSP || "gerencianet") as Psp;
  const environment = (process.env.PIX_ENVIRONMENT || "sandbox") as Environment;

  return { clientId, clientSecret, certificatePath, pixKey, psp, environment };
}

// ── Hook executor ──────────────────────────────────────────────────────

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: PixConfig,
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
            ...(response.data !== undefined ? { data: response.data } : {}),
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

// ── Bootstrap ──────────────────────────────────────────────────────────

const config = loadConfig();
const client = new PixClient(config);

const server = new McpServer(
  { name: "bridgeapi-pix", version: "0.1.0" },
  {
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false },
      prompts: { listChanged: false },
    },
  },
);

// ═══════════════════════════════════════════════════════════════════════
// TOOLS (15)
// ═══════════════════════════════════════════════════════════════════════

// 1. create_charge
server.tool(
  "create_charge",
  "Create a Pix charge (cobranca) with a specific transaction ID (txid). The charge generates a Pix billing that can be paid via QR code or copy-paste. The txid must be 26-35 alphanumeric characters.",
  {
    txid: z.string().describe("Unique transaction identifier (26-35 alphanumeric chars)"),
    expiracao: z.number().describe("Charge expiration time in seconds (e.g. 3600 for 1 hour)"),
    valor: z.string().describe("Charge amount in BRL as a string with 2 decimal places (e.g. '10.50')"),
    chave: z.string().describe("Pix key (CPF, CNPJ, email, phone, or random key) to receive the payment"),
    devedor_cpf: z.string().optional().describe("Payer CPF (11 digits) — optional"),
    devedor_nome: z.string().optional().describe("Payer name — optional"),
    solicitacao_pagador: z.string().optional().describe("Message shown to the payer (max 140 chars) — optional"),
  },
  async (params) =>
    executeWithHooks("create_charge", params as Record<string, unknown>, config, () =>
      client.createCharge(params.txid, {
        calendario: { expiracao: params.expiracao },
        valor: { original: params.valor },
        chave: params.chave,
        ...(params.devedor_cpf || params.devedor_nome
          ? {
              devedor: {
                ...(params.devedor_cpf ? { cpf: params.devedor_cpf } : {}),
                ...(params.devedor_nome ? { nome: params.devedor_nome } : {}),
              },
            }
          : {}),
        ...(params.solicitacao_pagador
          ? { solicitacaoPagador: params.solicitacao_pagador }
          : {}),
      }),
    ),
);

// 2. create_immediate_charge
server.tool(
  "create_immediate_charge",
  "Create an immediate Pix charge without specifying a txid. The PSP will auto-generate the txid. Use this for quick one-off charges where you don't need a custom transaction identifier.",
  {
    expiracao: z.number().describe("Charge expiration time in seconds (e.g. 3600 for 1 hour)"),
    valor: z.string().describe("Charge amount in BRL as a string with 2 decimal places (e.g. '29.90')"),
    chave: z.string().describe("Pix key to receive the payment"),
    solicitacao_pagador: z.string().optional().describe("Message shown to the payer (max 140 chars) — optional"),
  },
  async (params) =>
    executeWithHooks("create_immediate_charge", params as Record<string, unknown>, config, () =>
      client.createImmediateCharge({
        calendario: { expiracao: params.expiracao },
        valor: { original: params.valor },
        chave: params.chave,
        ...(params.solicitacao_pagador
          ? { solicitacaoPagador: params.solicitacao_pagador }
          : {}),
      }),
    ),
);

// 3. get_charge
server.tool(
  "get_charge",
  "Retrieve the full details of a Pix charge by its transaction ID (txid). Returns status, amount, payer info, location for QR code, timestamps, and payment details if already paid.",
  {
    txid: z.string().describe("Transaction ID of the charge to look up"),
  },
  async ({ txid }) =>
    executeWithHooks("get_charge", { txid }, config, () => client.getCharge(txid)),
);

// 4. list_charges
server.tool(
  "list_charges",
  "List all Pix charges within a date/time range. Optionally filter by status (ATIVA, CONCLUIDA, REMOVIDA_PELO_USUARIO_RECEBEDOR, REMOVIDA_PELO_PSP). Dates must be ISO 8601 strings with timezone.",
  {
    inicio: z.string().describe("Start date-time in ISO 8601 format (e.g. '2026-01-01T00:00:00Z')"),
    fim: z.string().describe("End date-time in ISO 8601 format (e.g. '2026-01-31T23:59:59Z')"),
    status: z.string().optional().describe("Filter by charge status: ATIVA, CONCLUIDA, REMOVIDA_PELO_USUARIO_RECEBEDOR, or REMOVIDA_PELO_PSP"),
  },
  async (params) =>
    executeWithHooks("list_charges", params as Record<string, unknown>, config, () =>
      client.listCharges(params.inicio, params.fim, params.status),
    ),
);

// 5. update_charge
server.tool(
  "update_charge",
  "Update (revise) an existing Pix charge. You can change the status to cancel it, update the amount, or modify the payer message. Only allowed while the charge is still active.",
  {
    txid: z.string().describe("Transaction ID of the charge to update"),
    status: z.string().optional().describe("New status (e.g. 'REMOVIDA_PELO_USUARIO_RECEBEDOR' to cancel)"),
    valor: z.string().optional().describe("New amount in BRL (e.g. '15.00')"),
    solicitacao_pagador: z.string().optional().describe("New message to display to the payer"),
  },
  async (params) =>
    executeWithHooks("update_charge", params as Record<string, unknown>, config, () =>
      client.updateCharge(params.txid, {
        ...(params.status ? { status: params.status } : {}),
        ...(params.valor ? { valor: { original: params.valor } } : {}),
        ...(params.solicitacao_pagador
          ? { solicitacaoPagador: params.solicitacao_pagador }
          : {}),
      }),
    ),
);

// 6. get_payment
server.tool(
  "get_payment",
  "Get details of a received Pix payment using its end-to-end ID (e2eid). Returns payer information, amount, timestamp, and refund details if any refunds were issued.",
  {
    e2eid: z.string().describe("End-to-end ID of the Pix payment (32-char identifier)"),
  },
  async ({ e2eid }) =>
    executeWithHooks("get_payment", { e2eid }, config, () => client.getPayment(e2eid)),
);

// 7. refund_payment
server.tool(
  "refund_payment",
  "Request a refund (devolucao) for a received Pix payment. You must provide the end-to-end ID, a unique refund identifier, and the refund amount. Partial refunds are supported.",
  {
    e2eid: z.string().describe("End-to-end ID of the original Pix payment"),
    refund_id: z.string().describe("Unique identifier for this refund request (you define it)"),
    valor: z.string().describe("Amount to refund in BRL (e.g. '5.00'). Can be partial."),
  },
  async ({ e2eid, refund_id, valor }) =>
    executeWithHooks("refund_payment", { e2eid, refund_id, valor }, config, () =>
      client.refundPayment(e2eid, refund_id, valor),
    ),
);

// 8. list_payments
server.tool(
  "list_payments",
  "List all received Pix payments within a date/time range. Returns each payment with e2eid, amount, payer info, and timestamps. Useful for reconciliation and reporting.",
  {
    inicio: z.string().describe("Start date-time in ISO 8601 format (e.g. '2026-03-01T00:00:00Z')"),
    fim: z.string().describe("End date-time in ISO 8601 format (e.g. '2026-03-31T23:59:59Z')"),
  },
  async (params) =>
    executeWithHooks("list_payments", params as Record<string, unknown>, config, () =>
      client.listPayments(params.inicio, params.fim),
    ),
);

// 9. generate_qr_code
server.tool(
  "generate_qr_code",
  "Generate a QR Code for a Pix charge using its location ID (loc.id). Returns the QR code as a base64-encoded image and the copy-paste payload (qrcode/pixCopiaECola). Get the loc_id from a charge response.",
  {
    loc_id: z.number().describe("Location ID from the charge response (loc.id field)"),
  },
  async ({ loc_id }) =>
    executeWithHooks("generate_qr_code", { loc_id }, config, () =>
      client.generateQRCode(loc_id),
    ),
);

// 10. configure_webhook
server.tool(
  "configure_webhook",
  "Configure a webhook URL to receive Pix payment notifications for a specific Pix key. The PSP will POST to this URL whenever a payment is received on the key.",
  {
    chave: z.string().describe("Pix key to configure the webhook for"),
    webhook_url: z.string().describe("HTTPS URL that will receive payment notification POSTs"),
  },
  async ({ chave, webhook_url }) =>
    executeWithHooks("configure_webhook", { chave, webhook_url }, config, () =>
      client.configureWebhook(chave, webhook_url),
    ),
);

// 11. get_webhook
server.tool(
  "get_webhook",
  "Retrieve the webhook configuration for a specific Pix key. Returns the currently configured webhook URL and creation timestamp.",
  {
    chave: z.string().describe("Pix key to look up the webhook for"),
  },
  async ({ chave }) =>
    executeWithHooks("get_webhook", { chave }, config, () => client.getWebhook(chave)),
);

// 12. delete_webhook
server.tool(
  "delete_webhook",
  "Remove the webhook configuration for a specific Pix key. After deletion, no more payment notifications will be sent for this key.",
  {
    chave: z.string().describe("Pix key to remove the webhook from"),
  },
  async ({ chave }) =>
    executeWithHooks("delete_webhook", { chave }, config, () =>
      client.deleteWebhook(chave),
    ),
);

// 13. list_webhooks
server.tool(
  "list_webhooks",
  "List all configured webhooks across all Pix keys. Returns each webhook with its key, URL, and creation timestamp.",
  {},
  async () =>
    executeWithHooks("list_webhooks", {}, config, () => client.listWebhooks()),
);

// 14. get_balance
server.tool(
  "get_balance",
  "Get the current account balance. Note: this endpoint is specific to Gerencianet/Efipay PSP and may not be available on other PSPs.",
  {},
  async () =>
    executeWithHooks("get_balance", {}, config, () => client.getBalance()),
);

// 15. get_statements
server.tool(
  "get_statements",
  "Get account statements (extrato) within a date range. Returns all credit and debit transactions. Note: this endpoint is specific to Gerencianet/Efipay PSP.",
  {
    inicio: z.string().describe("Start date-time in ISO 8601 format"),
    fim: z.string().describe("End date-time in ISO 8601 format"),
  },
  async (params) =>
    executeWithHooks("get_statements", params as Record<string, unknown>, config, () =>
      client.getStatements(params.inicio, params.fim),
    ),
);

// ═══════════════════════════════════════════════════════════════════════
// RESOURCES (3)
// ═══════════════════════════════════════════════════════════════════════

server.resource("charges", "pix://charges", async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const result = await client.listCharges(
    thirtyDaysAgo.toISOString(),
    now.toISOString(),
  );
  return {
    contents: [
      {
        uri: "pix://charges",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("webhooks", "pix://webhooks", async () => {
  const result = await client.listWebhooks();
  return {
    contents: [
      {
        uri: "pix://webhooks",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("balance", "pix://balance", async () => {
  const result = await client.getBalance();
  return {
    contents: [
      {
        uri: "pix://balance",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

// ═══════════════════════════════════════════════════════════════════════
// PROMPTS (3) — Portuguese
// ═══════════════════════════════════════════════════════════════════════

server.prompt(
  "cobrador",
  "Guia passo a passo para criar cobran\u00e7as Pix e gerar QR Codes",
  {
    valor: z.string().describe("Valor da cobranca em reais (ex: '50.00')"),
    descricao: z.string().optional().describe("Descricao da cobranca"),
  },
  ({ valor, descricao }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Preciso criar uma cobranca Pix no valor de R$ ${valor}${descricao ? ` referente a: ${descricao}` : ""}.`,
            "",
            "Siga estes passos usando as tools disponiveis:",
            "1. Use create_immediate_charge com o valor e a chave Pix configurada",
            "2. Pegue o loc.id da resposta",
            "3. Use generate_qr_code com o loc_id para gerar o QR Code",
            "4. Retorne o QR Code (pixCopiaECola) e o txid para acompanhamento",
            "",
            "Se o pagamento nao for confirmado, use get_charge com o txid para verificar o status.",
          ].join("\n"),
        },
      },
    ],
  }),
);

server.prompt(
  "reembolso",
  "Guia para processar devolu\u00e7\u00f5es (refunds) de pagamentos Pix recebidos",
  {
    e2eid: z.string().describe("End-to-end ID do pagamento a devolver"),
    valor: z.string().optional().describe("Valor a devolver (parcial ou total)"),
  },
  ({ e2eid, valor }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Preciso processar uma devolucao para o pagamento Pix com e2eid: ${e2eid}${valor ? ` no valor de R$ ${valor}` : ""}.`,
            "",
            "Siga estes passos:",
            "1. Use get_payment com o e2eid para verificar os detalhes do pagamento original",
            "2. Confirme o valor recebido e se ja existem devolucoes anteriores",
            `3. Use refund_payment com o e2eid, um refund_id unico, e o valor${valor ? ` de ${valor}` : " total"}`,
            "4. Verifique o status da devolucao na resposta",
            "",
            "Devolucoes parciais sao permitidas. O valor total devolvido nao pode exceder o valor original.",
          ].join("\n"),
        },
      },
    ],
  }),
);

server.prompt(
  "conciliacao",
  "Guia para concilia\u00e7\u00e3o de pagamentos Pix recebidos em um periodo",
  {
    inicio: z.string().describe("Data inicial (ISO 8601)"),
    fim: z.string().describe("Data final (ISO 8601)"),
  },
  ({ inicio, fim }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Preciso fazer a conciliacao dos pagamentos Pix recebidos de ${inicio} ate ${fim}.`,
            "",
            "Siga estes passos:",
            "1. Use list_charges para listar todas as cobrancas no periodo",
            "2. Use list_payments para listar todos os pagamentos recebidos no periodo",
            "3. Cruze as cobrancas com os pagamentos usando o txid",
            "4. Identifique cobrancas pendentes (ATIVA) que nao foram pagas",
            "5. Identifique pagamentos sem cobranca correspondente",
            "6. Use get_balance para verificar o saldo atual",
            "7. Se necessario, use get_statements para o extrato completo",
            "",
            "Apresente um resumo com: total cobrado, total recebido, cobrancas pendentes, e devolucoes.",
          ].join("\n"),
        },
      },
    ],
  }),
);

// ═══════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BridgeAPI Pix MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
