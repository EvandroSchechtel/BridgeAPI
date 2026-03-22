#!/usr/bin/env node
/**
 * @bridgeapi/mcp-eduzz — MCP Server for Eduzz API
 *
 * Connect any AI Agent to Eduzz via the Model Context Protocol.
 * Part of the BridgeAPI ecosystem: https://bridgeapi.com.br
 *
 * Phase 1: passthrough with structured logging (hooks are no-ops)
 * Phase 2: Execution Engine plugs into pre/post hooks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  EduzzClient,
  preExecuteHook,
  postExecuteHook,
  type EduzzConfig,
  type HookContext,
  type ApiResponse,
} from "./eduzz-client.js";

// --- CONFIG ----------------------------------------------

function loadConfig(): EduzzConfig {
  const apiKey = process.env.EDUZZ_API_KEY;
  const publicKey = process.env.EDUZZ_PUBLIC_KEY;
  const email = process.env.EDUZZ_EMAIL;
  const apiVersion = process.env.EDUZZ_API_VERSION || "1.0";

  if (!apiKey) throw new Error("EDUZZ_API_KEY is required");
  if (!publicKey) throw new Error("EDUZZ_PUBLIC_KEY is required");
  if (!email) throw new Error("EDUZZ_EMAIL is required");

  return { apiKey, publicKey, email, apiVersion };
}

// --- TOOL WRAPPER WITH HOOKS -----------------------------
// Every tool call goes through this wrapper.
// Phase 1: hooks are no-ops that log.
// Phase 2: hooks evaluate confidence and may block/escalate.

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: EduzzConfig,
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

// --- SERVER SETUP ----------------------------------------

const config = loadConfig();
const eduzz = new EduzzClient(config);

const server = new McpServer(
  {
    name: "bridgeapi-eduzz",
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

// ==========================================================
// TOOLS
// ==========================================================

// --- SALES TOOLS -----------------------------------------

server.tool(
  "get_sales",
  "List sales from your Eduzz account with optional filters by date, status, and product.",
  {
    start_date: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
    end_date: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
    status: z
      .string()
      .optional()
      .describe("Sale status filter (e.g., 'paid', 'refunded', 'waiting_payment', 'cancelled')"),
    product_id: z.number().optional().describe("Filter by product ID"),
    page: z.number().optional().describe("Page number for pagination"),
    page_size: z.number().optional().describe("Number of results per page"),
  },
  async ({ start_date, end_date, status, product_id, page, page_size }) =>
    executeWithHooks(
      "get_sales",
      { start_date, end_date, status, product_id, page, page_size },
      config,
      () => eduzz.getSales({ start_date, end_date, status, product_id, page, page_size })
    )
);

server.tool(
  "get_sale_details",
  "Get complete details of a specific sale including buyer info, payment method, and commissions.",
  {
    sale_id: z.number().describe("The unique sale ID"),
  },
  async ({ sale_id }) =>
    executeWithHooks("get_sale_details", { sale_id }, config, () =>
      eduzz.getSaleDetails(sale_id)
    )
);

server.tool(
  "request_refund",
  "Request a refund for a specific sale. This action may be irreversible.",
  {
    sale_id: z.number().describe("The sale ID to refund"),
    reason: z.string().describe("Reason for the refund request"),
  },
  async ({ sale_id, reason }) =>
    executeWithHooks("request_refund", { sale_id, reason }, config, () =>
      eduzz.requestRefund(sale_id, reason)
    )
);

// --- PRODUCT TOOLS ---------------------------------------

server.tool(
  "get_products",
  "List all products in your Eduzz account (infoprodutos, courses, ebooks, etc.).",
  {
    page: z.number().optional().describe("Page number for pagination"),
    page_size: z.number().optional().describe("Number of results per page"),
  },
  async ({ page, page_size }) =>
    executeWithHooks("get_products", { page, page_size }, config, () =>
      eduzz.getProducts({ page, page_size })
    )
);

server.tool(
  "get_product_details",
  "Get complete details of a specific product including pricing, description, and sales stats.",
  {
    product_id: z.number().describe("The unique product ID"),
  },
  async ({ product_id }) =>
    executeWithHooks("get_product_details", { product_id }, config, () =>
      eduzz.getProductDetails(product_id)
    )
);

// --- SUBSCRIPTION TOOLS ----------------------------------

server.tool(
  "get_subscriptions",
  "List subscriptions (assinaturas) with optional filters by status and product.",
  {
    status: z
      .string()
      .optional()
      .describe("Subscription status filter (e.g., 'active', 'cancelled', 'suspended')"),
    product_id: z.number().optional().describe("Filter by product ID"),
    page: z.number().optional().describe("Page number for pagination"),
  },
  async ({ status, product_id, page }) =>
    executeWithHooks("get_subscriptions", { status, product_id, page }, config, () =>
      eduzz.getSubscriptions({ status, product_id, page })
    )
);

server.tool(
  "cancel_subscription",
  "Cancel an active subscription. The subscriber will lose access at the end of the current billing period.",
  {
    subscription_id: z.number().describe("The subscription ID to cancel"),
    reason: z.string().optional().describe("Reason for cancellation"),
  },
  async ({ subscription_id, reason }) =>
    executeWithHooks(
      "cancel_subscription",
      { subscription_id, reason },
      config,
      () => eduzz.cancelSubscription(subscription_id, reason)
    )
);

// --- CONTRACT TOOLS --------------------------------------

server.tool(
  "get_contracts",
  "List contracts from your Eduzz account with optional status filter.",
  {
    status: z.string().optional().describe("Contract status filter"),
    page: z.number().optional().describe("Page number for pagination"),
  },
  async ({ status, page }) =>
    executeWithHooks("get_contracts", { status, page }, config, () =>
      eduzz.getContracts({ status, page })
    )
);

// --- AFFILIATE TOOLS -------------------------------------

server.tool(
  "get_my_affiliates",
  "List affiliates promoting your products, optionally filtered by product.",
  {
    product_id: z.number().optional().describe("Filter affiliates by product ID"),
    page: z.number().optional().describe("Page number for pagination"),
  },
  async ({ product_id, page }) =>
    executeWithHooks("get_my_affiliates", { product_id, page }, config, () =>
      eduzz.getMyAffiliates({ product_id, page })
    )
);

server.tool(
  "get_affiliate_products",
  "List products you are affiliated to (as an affiliate).",
  {
    page: z.number().optional().describe("Page number for pagination"),
  },
  async ({ page }) =>
    executeWithHooks("get_affiliate_products", { page }, config, () =>
      eduzz.getAffiliateProducts({ page })
    )
);

// --- FINANCIAL TOOLS -------------------------------------

server.tool(
  "get_financial_statement",
  "Get your financial statement (extrato financeiro) for a date range.",
  {
    start_date: z.string().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().describe("End date (YYYY-MM-DD)"),
    page: z.number().optional().describe("Page number for pagination"),
  },
  async ({ start_date, end_date, page }) =>
    executeWithHooks(
      "get_financial_statement",
      { start_date, end_date, page },
      config,
      () => eduzz.getFinancialStatement({ start_date, end_date, page })
    )
);

server.tool(
  "get_balance",
  "Get your current Eduzz account balance (saldo disponivel and saldo a receber).",
  {},
  async () =>
    executeWithHooks("get_balance", {}, config, () => eduzz.getBalance())
);

// --- COUPON TOOLS ----------------------------------------

server.tool(
  "get_coupons",
  "List discount coupons, optionally filtered by product.",
  {
    product_id: z.number().optional().describe("Filter coupons by product ID"),
  },
  async ({ product_id }) =>
    executeWithHooks("get_coupons", { product_id }, config, () =>
      eduzz.getCoupons({ product_id })
    )
);

server.tool(
  "create_coupon",
  "Create a new discount coupon for a product.",
  {
    product_id: z.number().describe("Product ID to apply the coupon to"),
    coupon_code: z.string().describe("The coupon code (e.g., 'PROMO50')"),
    discount_type: z
      .enum(["percentage", "fixed"])
      .describe("Type of discount: 'percentage' (e.g., 50%) or 'fixed' (e.g., R$50)"),
    discount_value: z.number().describe("Discount value (percentage 0-100 or fixed amount in BRL)"),
    quantity: z.number().optional().describe("Maximum number of uses (leave empty for unlimited)"),
    valid_until: z.string().optional().describe("Expiration date (YYYY-MM-DD)"),
  },
  async ({ product_id, coupon_code, discount_type, discount_value, quantity, valid_until }) =>
    executeWithHooks(
      "create_coupon",
      { product_id, coupon_code, discount_type, discount_value, quantity, valid_until },
      config,
      () =>
        eduzz.createCoupon({
          product_id,
          coupon_code,
          discount_type,
          discount_value,
          quantity,
          valid_until,
        })
    )
);

// ==========================================================
// RESOURCES (read-only context for agents)
// ==========================================================

server.resource("sales", "eduzz://sales", async () => {
  const result = await eduzz.getSales({ page_size: 50 });
  return {
    contents: [
      {
        uri: "eduzz://sales",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("products", "eduzz://products", async () => {
  const result = await eduzz.getProducts({ page_size: 50 });
  return {
    contents: [
      {
        uri: "eduzz://products",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("financial", "eduzz://financial", async () => {
  const result = await eduzz.getBalance();
  return {
    contents: [
      {
        uri: "eduzz://financial",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

// ==========================================================
// PROMPTS (reusable templates for common tasks)
// ==========================================================

server.prompt(
  "refund-handler",
  "Guia para processar solicitacoes de reembolso na Eduzz",
  {
    sale_info: z.string().optional().describe("Informacoes da venda (ID ou dados do comprador)"),
    reason: z.string().optional().describe("Motivo do reembolso informado pelo cliente"),
  },
  ({ sale_info, reason }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso processar uma solicitacao de reembolso na Eduzz${sale_info ? `. Informacoes da venda: ${sale_info}` : ""}${reason ? `. Motivo: ${reason}` : ""}.

Passos:
1. Primeiro, use get_sales para localizar a venda pelo ID ou dados do comprador.
2. Use get_sale_details para verificar os detalhes completos (data, valor, status, produto).
3. Verifique se a venda esta dentro do prazo de garantia do produto.
4. Se elegivel, use request_refund com o motivo documentado.

IMPORTANTE:
- O prazo legal de arrependimento no Brasil e de 7 dias (CDC Art. 49) para compras online.
- Produtos com garantia estendida podem ter prazos maiores.
- Reembolsos de assinaturas devem ser proporcionais ao periodo nao utilizado.
- Documente SEMPRE o motivo para controle interno.
- Apos o reembolso, o acesso do aluno e removido automaticamente.`,
        },
      },
    ],
  })
);

server.prompt(
  "sales-report",
  "Guia para gerar relatorios de vendas detalhados",
  {
    period: z.string().optional().describe("Periodo do relatorio (ex: 'ultimos 7 dias', 'marco 2026')"),
    product_name: z.string().optional().describe("Nome do produto para filtrar"),
  },
  ({ period, product_name }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso gerar um relatorio de vendas da Eduzz${period ? ` para o periodo: ${period}` : ""}${product_name ? ` do produto "${product_name}"` : ""}.

Passos:
1. Use get_products para listar os produtos e identificar IDs${product_name ? ` (procure por "${product_name}")` : ""}.
2. Use get_sales com filtros de data e produto para obter as vendas.
3. Use get_financial_statement para cruzar com os dados financeiros.
4. Use get_balance para ver o saldo atual.

Metricas importantes para incluir:
- Total de vendas no periodo
- Faturamento bruto e liquido
- Taxa de reembolso
- Ticket medio
- Vendas por produto (se multiplos)
- Comissoes de afiliados (use get_my_affiliates)
- Comparativo com periodo anterior (se disponivel)

DICA: Para periodos longos, use paginacao (page/page_size) para nao perder dados.`,
        },
      },
    ],
  })
);

server.prompt(
  "affiliate-manager",
  "Guia para gerenciar o programa de afiliados na Eduzz",
  {
    product_name: z.string().optional().describe("Nome do produto para gerenciar afiliados"),
  },
  ({ product_name }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso gerenciar o programa de afiliados na Eduzz${product_name ? ` para o produto "${product_name}"` : ""}.

Passos:
1. Use get_products para identificar o produto e suas configuracoes${product_name ? ` (procure por "${product_name}")` : ""}.
2. Use get_my_affiliates para listar os afiliados ativos do produto.
3. Use get_sales com filtros para analisar as vendas geradas por afiliados.
4. Use get_financial_statement para verificar as comissoes pagas.

Analises recomendadas:
- Top afiliados por volume de vendas
- Taxa de conversao por afiliado
- Comissao media por venda
- Afiliados inativos (sem vendas nos ultimos 30 dias)
- ROI do programa de afiliados

DICAS:
- Na Eduzz, a comissao padrao e definida no produto.
- Afiliados podem ter comissoes personalizadas.
- Use cupons (get_coupons / create_coupon) para campanhas especificas de afiliados.
- Monitore reembolsos por afiliado para identificar trafico de baixa qualidade.`,
        },
      },
    ],
  })
);

// ==========================================================
// START SERVER
// ==========================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BridgeAPI Eduzz MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
