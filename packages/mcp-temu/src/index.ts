#!/usr/bin/env node
/**
 * @bridgeapi/mcp-temu — MCP Server
 * Part of the BridgeAPI ecosystem
 *
 * 18 tools  |  3 resources  |  3 prompts (PT-BR)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  TemuClient,
  preExecuteHook,
  postExecuteHook,
  type TemuConfig,
  type HookContext,
  type ApiResponse,
} from "./temu-client.js";

// ─── Config loader ───────────────────────────────────────────────────────────

function loadConfig(): TemuConfig {
  const appKey = process.env.TEMU_APP_KEY;
  if (!appKey) throw new Error("TEMU_APP_KEY is required");
  const appSecret = process.env.TEMU_APP_SECRET;
  if (!appSecret) throw new Error("TEMU_APP_SECRET is required");
  const accessToken = process.env.TEMU_ACCESS_TOKEN;
  if (!accessToken) throw new Error("TEMU_ACCESS_TOKEN is required");
  const shopId = process.env.TEMU_SHOP_ID;
  if (!shopId) throw new Error("TEMU_SHOP_ID is required");
  return { appKey, appSecret, accessToken, shopId };
}

// ─── Hook wrapper ────────────────────────────────────────────────────────────

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: TemuConfig,
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

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const config = loadConfig();
const client = new TemuClient(config);

const server = new McpServer(
  { name: "bridgeapi-temu", version: "0.1.0" },
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

// ─── Products (5) ────────────────────────────────────────────────────────────

server.tool(
  "get_products",
  "Listar produtos da loja Temu com paginacao e filtro de status.",
  {
    page: z.number().optional().default(1).describe("Numero da pagina"),
    page_size: z.number().optional().default(20).describe("Itens por pagina"),
    status: z.string().optional().describe("Filtrar por status do produto"),
  },
  async (params) =>
    executeWithHooks("get_products", params, config, () =>
      client.getProducts(params),
    ),
);

server.tool(
  "get_product",
  "Obter detalhes de um produto Temu pelo ID.",
  {
    product_id: z.string().describe("ID do produto"),
  },
  async ({ product_id }) =>
    executeWithHooks("get_product", { product_id }, config, () =>
      client.getProduct(product_id),
    ),
);

server.tool(
  "create_product",
  "Criar um novo produto na loja Temu.",
  {
    data: z.record(z.string(), z.unknown()).describe("Dados do produto (titulo, descricao, preco, imagens, categoria, etc.)"),
  },
  async ({ data }) =>
    executeWithHooks("create_product", { data }, config, () =>
      client.createProduct(data),
    ),
);

server.tool(
  "update_product",
  "Atualizar campos de um produto existente na Temu.",
  {
    product_id: z.string().describe("ID do produto"),
    data: z.record(z.string(), z.unknown()).describe("Campos a atualizar"),
  },
  async ({ product_id, data }) =>
    executeWithHooks("update_product", { product_id, data }, config, () =>
      client.updateProduct(product_id, data),
    ),
);

server.tool(
  "delete_product",
  "Remover um produto da loja Temu.",
  {
    product_id: z.string().describe("ID do produto a remover"),
  },
  async ({ product_id }) =>
    executeWithHooks("delete_product", { product_id }, config, () =>
      client.deleteProduct(product_id),
    ),
);

// ─── Orders (4) ──────────────────────────────────────────────────────────────

server.tool(
  "get_orders",
  "Listar pedidos da loja Temu com filtros de status e periodo.",
  {
    page: z.number().optional().default(1).describe("Numero da pagina"),
    page_size: z.number().optional().default(20).describe("Itens por pagina"),
    status: z.string().optional().describe("Filtrar por status do pedido"),
    start_time: z.string().optional().describe("Data inicio (ISO 8601)"),
    end_time: z.string().optional().describe("Data fim (ISO 8601)"),
  },
  async (params) =>
    executeWithHooks("get_orders", params, config, () =>
      client.getOrders(params),
    ),
);

server.tool(
  "get_order",
  "Obter detalhes completos de um pedido Temu.",
  {
    order_id: z.string().describe("ID do pedido"),
  },
  async ({ order_id }) =>
    executeWithHooks("get_order", { order_id }, config, () =>
      client.getOrder(order_id),
    ),
);

server.tool(
  "ship_order",
  "Marcar pedido como enviado informando dados de rastreamento.",
  {
    order_id: z.string().describe("ID do pedido"),
    data: z.record(z.string(), z.unknown()).describe("Dados de envio (tracking_number, carrier, etc.)"),
  },
  async ({ order_id, data }) =>
    executeWithHooks("ship_order", { order_id, data }, config, () =>
      client.shipOrder(order_id, data),
    ),
);

server.tool(
  "get_shipment_info",
  "Consultar informacoes de envio/rastreamento de um pedido.",
  {
    order_id: z.string().describe("ID do pedido"),
  },
  async ({ order_id }) =>
    executeWithHooks("get_shipment_info", { order_id }, config, () =>
      client.getShipmentInfo(order_id),
    ),
);

// ─── Categories (2) ──────────────────────────────────────────────────────────

server.tool(
  "get_categories",
  "Listar todas as categorias disponiveis na Temu.",
  {},
  async () =>
    executeWithHooks("get_categories", {}, config, () =>
      client.getCategories(),
    ),
);

server.tool(
  "get_category_attributes",
  "Obter atributos obrigatorios/opcionais de uma categoria Temu.",
  {
    category_id: z.string().describe("ID da categoria"),
  },
  async ({ category_id }) =>
    executeWithHooks("get_category_attributes", { category_id }, config, () =>
      client.getCategoryAttributes(category_id),
    ),
);

// ─── Inventory (2) ───────────────────────────────────────────────────────────

server.tool(
  "get_inventory",
  "Consultar estoque atual de um produto Temu.",
  {
    product_id: z.string().describe("ID do produto"),
  },
  async ({ product_id }) =>
    executeWithHooks("get_inventory", { product_id }, config, () =>
      client.getInventory(product_id),
    ),
);

server.tool(
  "update_inventory",
  "Atualizar quantidade em estoque de um produto Temu.",
  {
    product_id: z.string().describe("ID do produto"),
    data: z.record(z.string(), z.unknown()).describe("Dados de estoque (quantity, sku_stocks, etc.)"),
  },
  async ({ product_id, data }) =>
    executeWithHooks("update_inventory", { product_id, data }, config, () =>
      client.updateInventory(product_id, data),
    ),
);

// ─── Returns / After-sale (3) ────────────────────────────────────────────────

server.tool(
  "get_return_orders",
  "Listar pedidos de devolucao/pos-venda na Temu.",
  {
    page: z.number().optional().default(1).describe("Numero da pagina"),
    page_size: z.number().optional().default(20).describe("Itens por pagina"),
    status: z.string().optional().describe("Filtrar por status da devolucao"),
  },
  async (params) =>
    executeWithHooks("get_return_orders", params, config, () =>
      client.getReturnOrders(params),
    ),
);

server.tool(
  "approve_return",
  "Aprovar uma solicitacao de devolucao na Temu.",
  {
    return_id: z.string().describe("ID da devolucao"),
  },
  async ({ return_id }) =>
    executeWithHooks("approve_return", { return_id }, config, () =>
      client.approveReturn(return_id),
    ),
);

server.tool(
  "reject_return",
  "Rejeitar uma solicitacao de devolucao na Temu informando motivo.",
  {
    return_id: z.string().describe("ID da devolucao"),
    reason: z.string().describe("Motivo da rejeicao"),
  },
  async ({ return_id, reason }) =>
    executeWithHooks("reject_return", { return_id, reason }, config, () =>
      client.rejectReturn(return_id, reason),
    ),
);

// ─── Shop / Finance (2) ──────────────────────────────────────────────────────

server.tool(
  "get_shop_info",
  "Obter informacoes da loja Temu (nome, status, metricas).",
  {},
  async () =>
    executeWithHooks("get_shop_info", {}, config, () =>
      client.getShopInfo(),
    ),
);

server.tool(
  "get_financial_statement",
  "Obter extrato financeiro da loja Temu por periodo.",
  {
    start_date: z.string().describe("Data inicio (YYYY-MM-DD)"),
    end_date: z.string().describe("Data fim (YYYY-MM-DD)"),
    page: z.number().optional().default(1).describe("Numero da pagina"),
    page_size: z.number().optional().default(20).describe("Itens por pagina"),
  },
  async (params) =>
    executeWithHooks("get_financial_statement", params, config, () =>
      client.getFinancialStatement(params),
    ),
);

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCES (3)
// ═══════════════════════════════════════════════════════════════════════════════

server.resource("products", "temu://products", async () => {
  const result = await client.getProducts({ page: 1, page_size: 50 });
  return {
    contents: [
      {
        uri: "temu://products",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("orders", "temu://orders", async () => {
  const result = await client.getOrders({ page: 1, page_size: 50 });
  return {
    contents: [
      {
        uri: "temu://orders",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("shop", "temu://shop", async () => {
  const result = await client.getShopInfo();
  return {
    contents: [
      {
        uri: "temu://shop",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS (3 — PT-BR)
// ═══════════════════════════════════════════════════════════════════════════════

server.prompt(
  "listador-produtos",
  "Guia para listar, filtrar e inspecionar produtos da loja Temu",
  {
    filtro: z.string().optional().describe("Filtro ou busca desejada"),
  },
  ({ filtro }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "Voce e um assistente especializado na plataforma Temu.",
            `Preciso listar produtos${filtro ? ` com filtro: "${filtro}"` : ""}.`,
            "Use a tool get_products para buscar a listagem com paginacao.",
            "Para detalhes de um produto especifico, use get_product.",
            "Apresente os resultados em formato de tabela quando possivel.",
          ].join("\n"),
        },
      },
    ],
  }),
);

server.prompt(
  "expedidor-pedidos",
  "Guia para gerenciar expedicao e rastreamento de pedidos Temu",
  {
    status: z.string().optional().describe("Filtrar pedidos por status"),
  },
  ({ status }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "Voce e um assistente de logistica para lojas Temu.",
            `Preciso gerenciar pedidos${status ? ` com status "${status}"` : ""}.`,
            "Use get_orders para listar, get_order para detalhes,",
            "ship_order para informar envio e get_shipment_info para rastreamento.",
            "Alerte sobre pedidos com prazo de envio proximo do vencimento.",
          ].join("\n"),
        },
      },
    ],
  }),
);

server.prompt(
  "sincronizador-estoque",
  "Guia para consultar e atualizar estoque de produtos Temu",
  {
    produto: z.string().optional().describe("ID ou nome do produto"),
  },
  ({ produto }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "Voce e um assistente de gestao de estoque para lojas Temu.",
            `Preciso sincronizar estoque${produto ? ` do produto "${produto}"` : ""}.`,
            "Use get_inventory para consultar quantidades atuais",
            "e update_inventory para ajustar niveis de estoque.",
            "Alerte sobre produtos com estoque abaixo de 10 unidades.",
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
  console.error("BridgeAPI Temu MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
