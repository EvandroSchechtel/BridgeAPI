#!/usr/bin/env node
/**
 * @bridgeapi/mcp-tiktok-shop -- MCP Server for TikTok Shop API
 *
 * Connect any AI Agent to TikTok Shop via the Model Context Protocol.
 * Part of the BridgeAPI ecosystem: https://bridgeapi.com.br
 *
 * 18 tools | 3 resources | 3 prompts (PT-BR)
 * Phase 1: passthrough with structured logging (hooks are no-ops)
 * Phase 2: Execution Engine plugs into pre/post hooks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  TikTokShopClient,
  preExecuteHook,
  postExecuteHook,
  type TikTokShopConfig,
  type HookContext,
  type ApiResponse,
} from "./tiktok-shop-client.js";

// ─── CONFIG ──────────────────────────────────────────────────

function loadConfig(): TikTokShopConfig {
  const appKey = process.env.TIKTOK_SHOP_APP_KEY;
  const appSecret = process.env.TIKTOK_SHOP_APP_SECRET;
  const accessToken = process.env.TIKTOK_SHOP_ACCESS_TOKEN;
  const shopId = process.env.TIKTOK_SHOP_SHOP_ID;

  if (!appKey) throw new Error("TIKTOK_SHOP_APP_KEY is required");
  if (!appSecret) throw new Error("TIKTOK_SHOP_APP_SECRET is required");
  if (!accessToken) throw new Error("TIKTOK_SHOP_ACCESS_TOKEN is required");
  if (!shopId) throw new Error("TIKTOK_SHOP_SHOP_ID is required");

  return { appKey, appSecret, accessToken, shopId };
}

// ─── TOOL WRAPPER WITH HOOKS ─────────────────────────────────

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: TikTokShopConfig,
  executor: () => Promise<ApiResponse<T>>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const hookCtx: HookContext = {
    tool_name: toolName,
    params,
    config,
    timestamp: new Date().toISOString(),
  };

  // PRE-EXECUTE HOOK
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

  // POST-EXECUTE HOOK
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
const tiktok = new TikTokShopClient(config);

const server = new McpServer(
  {
    name: "bridgeapi-tiktok-shop",
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

// =================================================================
// TOOLS (18 TikTok Shop-specific tools)
// =================================================================

// ─── 1. get_products ─────────────────────────────────────────

server.tool(
  "get_products",
  "List products from your TikTok Shop. Filter by status. Returns paginated product list with titles, prices, and stock info.",
  {
    page_size: z
      .number()
      .optional()
      .default(20)
      .describe("Number of products per page (default: 20, max: 100)"),
    page_number: z
      .number()
      .optional()
      .describe("Page number for pagination (starts at 1)"),
    search_status: z
      .number()
      .optional()
      .describe(
        "Product status filter: 1=Draft, 2=Pending, 3=Failed, 4=Active/Live, 5=Seller deactivated, 6=Platform deactivated, 7=Freeze, 8=Deleted"
      ),
  },
  async ({ page_size, page_number, search_status }) =>
    executeWithHooks(
      "get_products",
      { page_size, page_number, search_status },
      config,
      () => tiktok.getProducts({ page_size, page_number, search_status })
    )
);

// ─── 2. get_product ──────────────────────────────────────────

server.tool(
  "get_product",
  "Get detailed information about a specific product by its ID. Returns title, description, images, pricing, variants, and inventory data.",
  {
    product_id: z.string().describe("TikTok Shop product ID"),
  },
  async ({ product_id }) =>
    executeWithHooks("get_product", { product_id }, config, () =>
      tiktok.getProduct(product_id)
    )
);

// ─── 3. create_product ───────────────────────────────────────

server.tool(
  "create_product",
  "Create a new product on TikTok Shop. Requires title, description, category, images, price, and inventory. Returns the created product ID.",
  {
    product_data: z
      .record(z.string(), z.unknown())
      .describe(
        "Product data object: product_name (string), description (string), category_id (string), images (array of {id}), skus (array with price/stock), package_weight (object). See TikTok Shop API docs for full schema."
      ),
  },
  async ({ product_data }) =>
    executeWithHooks("create_product", { product_data }, config, () =>
      tiktok.createProduct(product_data)
    )
);

// ─── 4. update_product ───────────────────────────────────────

server.tool(
  "update_product",
  "Update an existing product on TikTok Shop. Partial updates supported -- only include fields you want to change.",
  {
    product_id: z.string().describe("TikTok Shop product ID to update"),
    product_data: z
      .record(z.string(), z.unknown())
      .describe(
        "Partial product data to update. Can include: product_name, description, images, skus (price/stock changes), etc."
      ),
  },
  async ({ product_id, product_data }) =>
    executeWithHooks(
      "update_product",
      { product_id, product_data },
      config,
      () => tiktok.updateProduct(product_id, product_data)
    )
);

// ─── 5. deactivate_product ───────────────────────────────────

server.tool(
  "deactivate_product",
  "Deactivate (hide) one or more products from your TikTok Shop. Products won't be visible to buyers but data is preserved.",
  {
    product_ids: z
      .array(z.string())
      .describe("Array of product IDs to deactivate"),
  },
  async ({ product_ids }) =>
    executeWithHooks(
      "deactivate_product",
      { product_ids },
      config,
      () => tiktok.deactivateProduct(product_ids)
    )
);

// ─── 6. activate_product ─────────────────────────────────────

server.tool(
  "activate_product",
  "Activate (show) one or more previously deactivated products on your TikTok Shop.",
  {
    product_ids: z
      .array(z.string())
      .describe("Array of product IDs to activate"),
  },
  async ({ product_ids }) =>
    executeWithHooks(
      "activate_product",
      { product_ids },
      config,
      () => tiktok.activateProduct(product_ids)
    )
);

// ─── 7. get_orders ───────────────────────────────────────────

server.tool(
  "get_orders",
  "List orders from your TikTok Shop. Filter by status and date range. Returns paginated order list with buyer info and totals.",
  {
    order_status: z
      .number()
      .optional()
      .describe(
        "Order status filter: 100=Unpaid, 111=Awaiting shipment, 112=Awaiting collection, 114=Partially shipped, 121=On-hold, 122=In transit, 130=Delivered, 140=Completed, 200=Cancelled"
      ),
    page_size: z
      .number()
      .optional()
      .default(20)
      .describe("Number of orders per page (default: 20, max: 50)"),
    cursor: z
      .string()
      .optional()
      .describe("Pagination cursor from previous response"),
    create_time_from: z
      .number()
      .optional()
      .describe("Start of creation date range (Unix timestamp in seconds)"),
    create_time_to: z
      .number()
      .optional()
      .describe("End of creation date range (Unix timestamp in seconds)"),
    sort_by: z
      .string()
      .optional()
      .describe("Sort field: 'create_time' or 'update_time'"),
    sort_type: z
      .number()
      .optional()
      .describe("Sort direction: 1=ASC, 2=DESC"),
  },
  async ({
    order_status,
    page_size,
    cursor,
    create_time_from,
    create_time_to,
    sort_by,
    sort_type,
  }) =>
    executeWithHooks(
      "get_orders",
      {
        order_status,
        page_size,
        cursor,
        create_time_from,
        create_time_to,
        sort_by,
        sort_type,
      },
      config,
      () =>
        tiktok.getOrders({
          order_status,
          page_size,
          cursor,
          create_time_from,
          create_time_to,
          sort_by,
          sort_type,
        })
    )
);

// ─── 8. get_order ────────────────────────────────────────────

server.tool(
  "get_order",
  "Get detailed information about one or more orders by their IDs. Returns full order data including items, buyer info, shipping address, and payment details.",
  {
    order_ids: z
      .array(z.string())
      .describe("Array of order IDs to retrieve (max 50)"),
  },
  async ({ order_ids }) =>
    executeWithHooks("get_order", { order_ids }, config, () =>
      tiktok.getOrder(order_ids)
    )
);

// ─── 9. ship_order ───────────────────────────────────────────

server.tool(
  "ship_order",
  "Ship an order by providing tracking information. Marks the order as shipped and notifies the buyer.",
  {
    order_id: z.string().describe("Order ID to ship"),
    pick_up_type: z
      .number()
      .optional()
      .describe("Pick-up type: 1=Pick-up, 2=Drop-off"),
    shipping_provider_id: z
      .string()
      .optional()
      .describe("Shipping provider/carrier ID"),
    tracking_number: z
      .string()
      .optional()
      .describe("Tracking number from the carrier"),
  },
  async ({ order_id, pick_up_type, shipping_provider_id, tracking_number }) =>
    executeWithHooks(
      "ship_order",
      { order_id, pick_up_type, shipping_provider_id, tracking_number },
      config,
      () =>
        tiktok.shipOrder({
          order_id,
          pick_up_type,
          shipping_provider_id,
          tracking_number,
        })
    )
);

// ─── 10. get_order_packages ──────────────────────────────────

server.tool(
  "get_order_packages",
  "Get package/shipment details for an order. Returns tracking info, package status, and carrier details.",
  {
    order_id: z
      .string()
      .describe("Order ID to get package information for"),
  },
  async ({ order_id }) =>
    executeWithHooks("get_order_packages", { order_id }, config, () =>
      tiktok.getOrderPackages(order_id)
    )
);

// ─── 11. get_categories ──────────────────────────────────────

server.tool(
  "get_categories",
  "List all available product categories on TikTok Shop. Returns category tree with IDs and names. Use category IDs when creating products.",
  {},
  async () =>
    executeWithHooks("get_categories", {}, config, () =>
      tiktok.getCategories()
    )
);

// ─── 12. get_category_attributes ─────────────────────────────

server.tool(
  "get_category_attributes",
  "Get required and optional attributes for a specific product category. Use this before creating a product to know which fields are needed.",
  {
    category_id: z
      .string()
      .describe("Category ID to get attributes for"),
  },
  async ({ category_id }) =>
    executeWithHooks(
      "get_category_attributes",
      { category_id },
      config,
      () => tiktok.getCategoryAttributes(category_id)
    )
);

// ─── 13. get_shop_info ───────────────────────────────────────

server.tool(
  "get_shop_info",
  "Get information about the authorized TikTok Shop. Returns shop name, region, status, and seller details.",
  {},
  async () =>
    executeWithHooks("get_shop_info", {}, config, () =>
      tiktok.getShopInfo()
    )
);

// ─── 14. get_seller_performance ──────────────────────────────

server.tool(
  "get_seller_performance",
  "Get the seller's performance metrics on TikTok Shop. Returns order defect rate, late shipment rate, and cancellation rate.",
  {},
  async () =>
    executeWithHooks("get_seller_performance", {}, config, () =>
      tiktok.getSellerPerformance()
    )
);

// ─── 15. get_warehouse ───────────────────────────────────────

server.tool(
  "get_warehouse",
  "List all warehouses configured for your TikTok Shop. Returns warehouse IDs, names, and addresses.",
  {},
  async () =>
    executeWithHooks("get_warehouse", {}, config, () =>
      tiktok.getWarehouse()
    )
);

// ─── 16. update_inventory ────────────────────────────────────

server.tool(
  "update_inventory",
  "Update stock/inventory quantity for a specific SKU in a warehouse. Use this to sync inventory levels.",
  {
    product_id: z
      .string()
      .describe("Product ID that contains the SKU"),
    sku_id: z.string().describe("SKU ID to update inventory for"),
    warehouse_id: z
      .string()
      .describe("Warehouse ID where inventory is stored"),
    quantity: z
      .number()
      .describe("New inventory quantity (absolute value, not delta)"),
  },
  async ({ product_id, sku_id, warehouse_id, quantity }) =>
    executeWithHooks(
      "update_inventory",
      { product_id, sku_id, warehouse_id, quantity },
      config,
      () =>
        tiktok.updateInventory({
          product_id,
          sku_id,
          warehouse_id,
          quantity,
        })
    )
);

// ─── 17. get_return_orders ───────────────────────────────────

server.tool(
  "get_return_orders",
  "List return/refund requests from buyers. Filter by status and date range.",
  {
    page_size: z
      .number()
      .optional()
      .default(20)
      .describe("Number of returns per page (default: 20)"),
    cursor: z
      .string()
      .optional()
      .describe("Pagination cursor from previous response"),
    status: z
      .number()
      .optional()
      .describe(
        "Return status filter: 1=Pending, 2=Seller approved, 3=Seller rejected, 4=Buyer cancelled, 5=Buyer returned, 6=Refunded, 7=Closed"
      ),
    create_time_from: z
      .number()
      .optional()
      .describe("Start of creation date range (Unix timestamp in seconds)"),
    create_time_to: z
      .number()
      .optional()
      .describe("End of creation date range (Unix timestamp in seconds)"),
  },
  async ({ page_size, cursor, status, create_time_from, create_time_to }) =>
    executeWithHooks(
      "get_return_orders",
      { page_size, cursor, status, create_time_from, create_time_to },
      config,
      () =>
        tiktok.getReturnOrders({
          page_size,
          cursor,
          status,
          create_time_from,
          create_time_to,
        })
    )
);

// ─── 18. approve_return ──────────────────────────────────────

server.tool(
  "approve_return",
  "Approve or reject a return/refund request from a buyer. Include a reason when rejecting.",
  {
    return_id: z.string().describe("Return/reverse order ID"),
    decision: z
      .enum(["ACCEPT", "REJECT"])
      .describe("Decision: ACCEPT to approve the return, REJECT to deny it"),
    reason: z
      .string()
      .optional()
      .describe("Reason for the decision (required when rejecting)"),
  },
  async ({ return_id, decision, reason }) =>
    executeWithHooks(
      "approve_return",
      { return_id, decision, reason },
      config,
      () => tiktok.approveReturn(return_id, decision, reason)
    )
);

// =================================================================
// RESOURCES (read-only context for agents)
// =================================================================

server.resource("products", "tiktokshop://products", async () => {
  const result = await tiktok.getProducts({ page_size: 100 });
  return {
    contents: [
      {
        uri: "tiktokshop://products",
        mimeType: "application/json",
        text: JSON.stringify(result.data ?? null, null, 2),
      },
    ],
  };
});

server.resource("orders", "tiktokshop://orders", async () => {
  const result = await tiktok.getOrders({ page_size: 50 });
  return {
    contents: [
      {
        uri: "tiktokshop://orders",
        mimeType: "application/json",
        text: JSON.stringify(result.data ?? null, null, 2),
      },
    ],
  };
});

server.resource("shop", "tiktokshop://shop", async () => {
  const result = await tiktok.getShopInfo();
  return {
    contents: [
      {
        uri: "tiktokshop://shop",
        mimeType: "application/json",
        text: JSON.stringify(result.data ?? null, null, 2),
      },
    ],
  };
});

// =================================================================
// PROMPTS (PT-BR reusable templates for common tasks)
// =================================================================

server.prompt(
  "listador-produtos",
  "Guia para listar e gerenciar produtos no TikTok Shop",
  {
    acao: z
      .string()
      .describe(
        "Acao desejada: listar, buscar, criar, atualizar, ativar, desativar"
      ),
    produto_info: z
      .string()
      .optional()
      .describe("Nome ou ID do produto (opcional)"),
  },
  ({ acao, produto_info }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso gerenciar produtos no TikTok Shop. Acao: "${acao}"${produto_info ? `. Produto: ${produto_info}` : ""}.

Passos:
1. Para LISTAR: use get_products com filtro de status se necessario.
2. Para BUSCAR: use get_product com o product_id.
3. Para CRIAR:
   a. Use get_categories para encontrar a categoria correta.
   b. Use get_category_attributes para saber os campos obrigatorios.
   c. Use create_product com todos os campos necessarios.
4. Para ATUALIZAR: use update_product com o product_id e os campos a alterar.
5. Para ATIVAR/DESATIVAR: use activate_product ou deactivate_product com array de IDs.

STATUS DOS PRODUTOS:
- 1=Rascunho, 2=Pendente, 3=Falhou, 4=Ativo/Live
- 5=Desativado pelo vendedor, 6=Desativado pela plataforma
- 7=Congelado, 8=Deletado

DICAS:
- Sempre verifique os atributos da categoria antes de criar um produto.
- Imagens devem ser enviadas previamente via API de upload e referenciadas pelo ID.
- Precos sao em centavos na moeda local da loja.
- SKUs (variantes) sao obrigatorios mesmo para produtos sem variacao.`,
        },
      },
    ],
  })
);

server.prompt(
  "expedidor-pedidos",
  "Guia para processar e enviar pedidos do TikTok Shop",
  {
    acao: z
      .string()
      .describe(
        "Acao desejada: listar_pendentes, ver_detalhes, enviar, rastrear"
      ),
    pedido_info: z
      .string()
      .optional()
      .describe("ID do pedido ou informacao relevante"),
  },
  ({ acao, pedido_info }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso processar pedidos no TikTok Shop. Acao: "${acao}"${pedido_info ? `. Pedido: ${pedido_info}` : ""}.

Passos:
1. Para LISTAR PENDENTES: use get_orders com order_status=111 (aguardando envio).
2. Para VER DETALHES: use get_order com o array de order_ids.
3. Para ENVIAR:
   a. Obtenha os detalhes do pedido com get_order.
   b. Use ship_order com o order_id, shipping_provider_id e tracking_number.
   c. Confirme o envio verificando com get_order_packages.
4. Para RASTREAR: use get_order_packages com o order_id.

STATUS DOS PEDIDOS:
- 100=Nao pago, 111=Aguardando envio, 112=Aguardando coleta
- 114=Parcialmente enviado, 121=Em espera, 122=Em transito
- 130=Entregue, 140=Concluido, 200=Cancelado

DICAS:
- Pedidos com status 111 precisam ser enviados dentro do prazo de SLA.
- O pick_up_type define se voce vai despachar (2=Drop-off) ou se o TikTok coleta (1=Pick-up).
- Atrasos no envio afetam a performance do vendedor (get_seller_performance).
- Sempre confirme o tracking_number antes de marcar como enviado.`,
        },
      },
    ],
  })
);

server.prompt(
  "gerenciador-estoque",
  "Guia para gerenciar estoque e inventario no TikTok Shop",
  {
    acao: z
      .string()
      .describe(
        "Acao desejada: verificar_estoque, atualizar_quantidade, listar_armazens"
      ),
    produto_info: z
      .string()
      .optional()
      .describe("ID do produto ou SKU"),
  },
  ({ acao, produto_info }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso gerenciar o estoque no TikTok Shop. Acao: "${acao}"${produto_info ? `. Produto/SKU: ${produto_info}` : ""}.

Passos:
1. Para LISTAR ARMAZENS: use get_warehouse para ver todos os armazens configurados.
2. Para VERIFICAR ESTOQUE:
   a. Use get_product com o product_id para ver as quantidades atuais por SKU.
   b. Cada SKU mostra a quantidade disponivel por armazem.
3. Para ATUALIZAR QUANTIDADE:
   a. Identifique o product_id, sku_id e warehouse_id.
   b. Use update_inventory com a nova quantidade ABSOLUTA (nao delta).
   c. Verifique a atualizacao com get_product.

DICAS:
- A quantidade no update_inventory e ABSOLUTA, nao relativa. Se tem 50 unidades e quer adicionar 10, envie 60.
- Produtos com estoque zero sao automaticamente marcados como "esgotado" no TikTok Shop.
- Sincronize o estoque frequentemente se vende em multiplos canais.
- Use get_warehouse para obter os IDs corretos dos armazens antes de atualizar.
- Monitore produtos com estoque baixo para evitar vendas sem estoque (overselling).`,
        },
      },
    ],
  })
);

// =================================================================
// START SERVER
// =================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BridgeAPI TikTok Shop MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
