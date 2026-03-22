#!/usr/bin/env node
/**
 * @bridgeapi/mcp-hotmart — MCP Server for Hotmart API
 *
 * Connect any AI Agent to Hotmart via the Model Context Protocol.
 * Part of the BridgeAPI ecosystem: https://bridgeapi.com.br
 *
 * Phase 1: passthrough with structured logging (hooks are no-ops)
 * Phase 2: Execution Engine plugs into pre/post hooks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  HotmartClient,
  preExecuteHook,
  postExecuteHook,
  type HotmartConfig,
  type HookContext,
  type ApiResponse,
} from "./hotmart-client.js";

// ─── CONFIG ──────────────────────────────────────────────────

function loadConfig(): HotmartConfig {
  const clientId = process.env.HOTMART_CLIENT_ID;
  const clientSecret = process.env.HOTMART_CLIENT_SECRET;
  const basicToken = process.env.HOTMART_BASIC_TOKEN;
  const environment =
    (process.env.HOTMART_ENVIRONMENT as "production" | "sandbox") ||
    "production";

  if (!clientId) throw new Error("HOTMART_CLIENT_ID is required");
  if (!clientSecret) throw new Error("HOTMART_CLIENT_SECRET is required");
  if (!basicToken) throw new Error("HOTMART_BASIC_TOKEN is required");

  return { clientId, clientSecret, basicToken, environment };
}

// ─── TOOL WRAPPER WITH HOOKS ─────────────────────────────────
// Every tool call goes through this wrapper.
// Phase 1: hooks are no-ops that log.
// Phase 2: hooks evaluate confidence and may block/escalate.

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: HotmartConfig,
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
const hotmart = new HotmartClient(config);

const server = new McpServer(
  {
    name: "bridgeapi-hotmart",
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

// ─── SALES TOOLS ────────────────────────────────────────────

server.tool(
  "get_sales_history",
  "Get sales history from Hotmart. Filter by product, buyer email, date range, or transaction status. Returns a paginated list of sales with transaction details.",
  {
    product_id: z
      .number()
      .optional()
      .describe("Hotmart product ID to filter sales"),
    buyer_email: z
      .string()
      .optional()
      .describe("Buyer email to filter sales"),
    start_date: z
      .number()
      .optional()
      .describe(
        "Start date as Unix timestamp in milliseconds (e.g., 1700000000000)"
      ),
    end_date: z
      .number()
      .optional()
      .describe(
        "End date as Unix timestamp in milliseconds (e.g., 1700000000000)"
      ),
    status: z
      .string()
      .optional()
      .describe(
        "Transaction status filter: APPROVED, COMPLETE, CANCELLED, REFUNDED, CHARGEBACK, EXPIRED, etc."
      ),
    max_results: z
      .number()
      .optional()
      .default(50)
      .describe("Max results per page (default: 50)"),
  },
  async ({ product_id, buyer_email, start_date, end_date, status, max_results }) =>
    executeWithHooks(
      "get_sales_history",
      { product_id, buyer_email, start_date, end_date, status, max_results },
      config,
      () =>
        hotmart.getSalesHistory({
          product_id,
          buyer_email,
          start_date,
          end_date,
          transaction_status: status,
          max_results,
        })
    )
);

server.tool(
  "get_sale_summary",
  "Get a summary of a specific sale by transaction code. Returns payment details, product info, buyer data, and commission breakdown.",
  {
    transaction_code: z
      .string()
      .describe("The Hotmart transaction code (e.g., HP12345678901234)"),
  },
  async ({ transaction_code }) =>
    executeWithHooks(
      "get_sale_summary",
      { transaction_code },
      config,
      () => hotmart.getSaleSummary(transaction_code)
    )
);

server.tool(
  "get_sale_participants",
  "Get all participants of a sale (producer, affiliate, buyer). Shows commission split and roles.",
  {
    transaction_code: z
      .string()
      .describe("The Hotmart transaction code"),
  },
  async ({ transaction_code }) =>
    executeWithHooks(
      "get_sale_participants",
      { transaction_code },
      config,
      () => hotmart.getSaleParticipants(transaction_code)
    )
);

server.tool(
  "get_commissions",
  "Get commission history. Filter by product and date range to see earnings breakdown.",
  {
    product_id: z
      .number()
      .optional()
      .describe("Product ID to filter commissions"),
    start_date: z
      .number()
      .optional()
      .describe("Start date as Unix timestamp in milliseconds"),
    end_date: z
      .number()
      .optional()
      .describe("End date as Unix timestamp in milliseconds"),
  },
  async ({ product_id, start_date, end_date }) =>
    executeWithHooks(
      "get_commissions",
      { product_id, start_date, end_date },
      config,
      () => hotmart.getCommissions({ product_id, start_date, end_date })
    )
);

// ─── SUBSCRIPTION TOOLS ─────────────────────────────────────

server.tool(
  "get_subscriptions",
  "List subscriptions from Hotmart. Filter by product, subscriber email, or status. Returns subscriber details and plan info.",
  {
    product_id: z
      .number()
      .optional()
      .describe("Product ID to filter subscriptions"),
    subscriber_email: z
      .string()
      .optional()
      .describe("Subscriber email to search"),
    status: z
      .string()
      .optional()
      .describe(
        "Subscription status: ACTIVE, INACTIVE, CANCELLED_BY_CUSTOMER, CANCELLED_BY_SELLER, CANCELLED_BY_ADMIN, OVERDUE, STARTED"
      ),
    max_results: z
      .number()
      .optional()
      .default(50)
      .describe("Max results per page (default: 50)"),
  },
  async ({ product_id, subscriber_email, status, max_results }) =>
    executeWithHooks(
      "get_subscriptions",
      { product_id, subscriber_email, status, max_results },
      config,
      () =>
        hotmart.getSubscriptions({
          product_id,
          subscriber_email,
          status,
          max_results,
        })
    )
);

server.tool(
  "get_subscription",
  "Get details of a specific subscription by subscriber code.",
  {
    subscriber_code: z
      .string()
      .describe("The unique subscriber code from Hotmart"),
  },
  async ({ subscriber_code }) =>
    executeWithHooks(
      "get_subscription",
      { subscriber_code },
      config,
      () => hotmart.getSubscription(subscriber_code)
    )
);

server.tool(
  "cancel_subscription",
  "Cancel an active subscription. Optionally sends a cancellation email to the subscriber.",
  {
    subscriber_code: z
      .string()
      .describe("The unique subscriber code to cancel"),
    send_email: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to send cancellation email to subscriber (default: true)"),
  },
  async ({ subscriber_code, send_email }) =>
    executeWithHooks(
      "cancel_subscription",
      { subscriber_code, send_email },
      config,
      () => hotmart.cancelSubscription(subscriber_code, send_email)
    )
);

server.tool(
  "reactivate_subscription",
  "Reactivate a previously cancelled subscription.",
  {
    subscriber_code: z
      .string()
      .describe("The unique subscriber code to reactivate"),
  },
  async ({ subscriber_code }) =>
    executeWithHooks(
      "reactivate_subscription",
      { subscriber_code },
      config,
      () => hotmart.reactivateSubscription(subscriber_code)
    )
);

server.tool(
  "change_subscription_due_day",
  "Change the billing due day for a subscription. The new due day must be between 1 and 28.",
  {
    subscriber_code: z
      .string()
      .describe("The unique subscriber code"),
    due_day: z
      .number()
      .min(1)
      .max(28)
      .describe("New due day of the month (1-28)"),
  },
  async ({ subscriber_code, due_day }) =>
    executeWithHooks(
      "change_subscription_due_day",
      { subscriber_code, due_day },
      config,
      () => hotmart.changeSubscriptionDueDay(subscriber_code, due_day)
    )
);

// ─── PRODUCT TOOLS ──────────────────────────────────────────

server.tool(
  "get_products",
  "List all products in your Hotmart account. Returns product name, ID, status, pricing, and creation date.",
  {},
  async () =>
    executeWithHooks("get_products", {}, config, () => hotmart.getProducts())
);

// ─── CLUB (Area de Membros) TOOLS ───────────────────────────

server.tool(
  "get_modules",
  "Get modules/lessons from a Hotmart Club (members area) product. Shows module names, pages, and content structure.",
  {
    product_id: z
      .string()
      .describe("Product ID for the Club (members area)"),
  },
  async ({ product_id }) =>
    executeWithHooks(
      "get_modules",
      { product_id },
      config,
      () => hotmart.getModules(product_id)
    )
);

server.tool(
  "get_student_progress",
  "Get a student's progress in a Hotmart Club product. Shows completed modules, percentage, and last access.",
  {
    product_id: z
      .string()
      .describe("Product ID for the Club (members area)"),
    student_email: z
      .string()
      .describe("Student email to check progress"),
  },
  async ({ product_id, student_email }) =>
    executeWithHooks(
      "get_student_progress",
      { product_id, student_email },
      config,
      () => hotmart.getStudentProgress(product_id, student_email)
    )
);

// ─── COUPON TOOLS ───────────────────────────────────────────

server.tool(
  "get_coupons",
  "List discount coupons. Optionally filter by product ID.",
  {
    product_id: z
      .number()
      .optional()
      .describe("Product ID to filter coupons"),
  },
  async ({ product_id }) =>
    executeWithHooks(
      "get_coupons",
      { product_id },
      config,
      () => hotmart.getCoupons(product_id)
    )
);

server.tool(
  "create_coupon",
  "Create a new discount coupon for a Hotmart product. Supports percentage or fixed amount discounts.",
  {
    product_id: z.number().describe("Product ID to create the coupon for"),
    coupon_code: z
      .string()
      .describe("Unique coupon code (e.g., PROMO2026, BLACKFRIDAY)"),
    discount_type: z
      .enum(["percentage", "fixed"])
      .describe("Discount type: 'percentage' (e.g., 20% off) or 'fixed' (e.g., R$50 off)"),
    discount_value: z
      .number()
      .describe(
        "Discount value: for percentage use 0-100 (e.g., 20 for 20%), for fixed use amount in cents"
      ),
    max_uses: z
      .number()
      .optional()
      .describe("Maximum number of times the coupon can be used"),
    valid_until: z
      .string()
      .optional()
      .describe("Expiration date in ISO 8601 format (e.g., 2026-12-31T23:59:59Z)"),
  },
  async ({ product_id, coupon_code, discount_type, discount_value, max_uses, valid_until }) =>
    executeWithHooks(
      "create_coupon",
      { product_id, coupon_code, discount_type, discount_value, max_uses, valid_until },
      config,
      () =>
        hotmart.createCoupon({
          product_id,
          coupon_code,
          discount_type: discount_type === "percentage" ? "PERCENTAGE" : "FIXED",
          discount_value,
          max_uses,
          valid_until,
        })
    )
);

// ═══════════════════════════════════════════════════════════════
// RESOURCES (read-only context for agents)
// ═══════════════════════════════════════════════════════════════

server.resource("sales", "hotmart://sales", async () => {
  const result = await hotmart.getSalesHistory({ max_results: 100 });
  return {
    contents: [
      {
        uri: "hotmart://sales",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("subscriptions", "hotmart://subscriptions", async () => {
  const result = await hotmart.getSubscriptions({ max_results: 100 });
  return {
    contents: [
      {
        uri: "hotmart://subscriptions",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("products", "hotmart://products", async () => {
  const result = await hotmart.getProducts();
  return {
    contents: [
      {
        uri: "hotmart://products",
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
  "subscription-manager",
  "Guia para gerenciar assinaturas Hotmart — cancelar, reativar, alterar vencimento",
  {
    action: z
      .string()
      .describe(
        "Ação desejada: cancelar, reativar, alterar_vencimento, consultar"
      ),
    subscriber_info: z
      .string()
      .optional()
      .describe(
        "Email ou código do assinante"
      ),
  },
  ({ action, subscriber_info }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso gerenciar uma assinatura na Hotmart. Ação: "${action}"${subscriber_info ? `. Assinante: ${subscriber_info}` : ""}.

Passos:
1. Se tiver o email do assinante, use get_subscriptions com subscriber_email para encontrar o subscriber_code.
2. Se já tiver o subscriber_code, use get_subscription para ver o status atual.
3. Execute a ação solicitada:
   - **cancelar**: use cancel_subscription (pergunte se deseja enviar email ao assinante)
   - **reativar**: use reactivate_subscription (só funciona para assinaturas canceladas)
   - **alterar_vencimento**: use change_subscription_due_day (dia entre 1 e 28)
   - **consultar**: use get_subscription para detalhes completos

IMPORTANTE:
- Cancelamentos são irreversíveis na prática (reativação nem sempre funciona dependendo do status do pagamento).
- Alteração de vencimento só vale para a próxima cobrança.
- Sempre confirme a ação com o usuário antes de executar cancelamentos.`,
        },
      },
    ],
  })
);

server.prompt(
  "sales-analyzer",
  "Guia para analisar vendas e comissões na Hotmart",
  {
    product_name: z
      .string()
      .optional()
      .describe("Nome do produto para filtrar"),
    period: z
      .string()
      .optional()
      .describe(
        "Período de análise: hoje, semana, mes, trimestre, ou datas específicas"
      ),
  },
  ({ product_name, period }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso analisar as vendas na Hotmart${product_name ? ` do produto "${product_name}"` : ""}${period ? ` no período: ${period}` : ""}.

Passos:
1. Use get_products para listar produtos e encontrar o product_id correto.
2. Use get_sales_history com filtros de data e produto para obter as vendas.
3. Use get_commissions para ver a divisão de comissões (produtor, afiliado, coprodutor).
4. Para detalhes de uma venda específica, use get_sale_summary com o transaction_code.

DICAS DE ANÁLISE:
- Agrupe vendas por status (APPROVED, REFUNDED, CHARGEBACK) para ver taxa de conversão real.
- Compare períodos para identificar tendências.
- Verifique taxa de chargeback — acima de 1% pode gerar problemas na Hotmart.
- Use get_sale_participants para entender a divisão de comissões em vendas de afiliados.

TIMESTAMPS:
- A API Hotmart usa timestamps em milissegundos (ex: 1700000000000).
- Para converter data: new Date("2026-01-01").getTime() = timestamp em ms.`,
        },
      },
    ],
  })
);

server.prompt(
  "coupon-creator",
  "Guia para criar cupons promocionais na Hotmart",
  {
    product_name: z.string().describe("Nome do produto para o cupom"),
    discount_type: z
      .enum(["percentage", "fixed"])
      .describe("Tipo de desconto: percentage ou fixed"),
  },
  ({ product_name, discount_type }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso criar um cupom de desconto na Hotmart para o produto "${product_name}" (tipo: ${discount_type === "percentage" ? "percentual" : "valor fixo"}).

Passos:
1. Use get_products para encontrar o product_id do produto "${product_name}".
2. Use get_coupons com o product_id para ver cupons existentes (evitar duplicatas).
3. Use create_coupon para criar o novo cupom.

BOAS PRÁTICAS PARA CUPONS:
- Código do cupom: use algo memorável e em MAIÚSCULAS (ex: BLACKFRIDAY, PROMO50, LANCAMENTO).
- Desconto percentual: valores entre 5% e 50% são mais comuns. Acima de 50% pode impactar margens.
- Desconto fixo: valor em centavos (R$50.00 = 5000 centavos).
- Limite de uso: defina max_uses para controlar o impacto financeiro.
- Validade: sempre defina valid_until para criar senso de urgência.
- CUIDADO: cupons sem limite de uso ou data de expiração podem ser compartilhados indiscriminadamente.

ESTRATÉGIAS COMUNS:
- Lançamento: 20-30% off, limite de 100 usos, válido por 48h.
- Black Friday: 40-50% off, sem limite, válido por 1 semana.
- Recuperação de carrinho: 10-15% off, limite de 1 uso por pessoa.
- Afiliado exclusivo: desconto fixo, sem limite de uso, sem expiração.`,
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
  console.error("BridgeAPI Hotmart MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
