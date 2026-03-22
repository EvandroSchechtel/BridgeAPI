#!/usr/bin/env node
/**
 * @bridgeapi/mcp-shopify — MCP Server for Shopify Admin API
 *
 * Connect any AI Agent to Shopify via the Model Context Protocol.
 * Part of the BridgeAPI ecosystem: https://bridgeapi.com.br
 *
 * Phase 1: passthrough with structured logging (hooks are no-ops)
 * Phase 2: Execution Engine plugs into pre/post hooks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  ShopifyClient,
  preExecuteHook,
  postExecuteHook,
  type ShopifyConfig,
  type HookContext,
  type ApiResponse,
} from "./shopify-client.js";

// ─── CONFIG ──────────────────────────────────────────────────

function loadConfig(): ShopifyConfig {
  const storeUrl = process.env.SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-10";

  if (!storeUrl) throw new Error("SHOPIFY_STORE_URL is required (e.g., my-store.myshopify.com)");
  if (!accessToken) throw new Error("SHOPIFY_ACCESS_TOKEN is required");

  return { storeUrl, accessToken, apiVersion };
}

// ─── TOOL WRAPPER WITH HOOKS ─────────────────────────────────

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: ShopifyConfig,
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
const shopify = new ShopifyClient(config);

const server = new McpServer(
  {
    name: "bridgeapi-shopify",
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
// TOOLS (24 tools)
// ═══════════════════════════════════════════════════════════════

// ─── PRODUCT TOOLS (6) ───────────────────────────────────────

server.tool(
  "get_products",
  "List products from Shopify store. Filter by status, vendor, product type, or collection. Returns paginated product data with variants and images.",
  {
    limit: z.number().optional().default(50).describe("Max products to return (max 250)"),
    status: z.string().optional().describe("Product status filter: active, draft, archived"),
    collection_id: z.string().optional().describe("Filter by collection ID"),
    product_type: z.string().optional().describe("Filter by product type"),
    vendor: z.string().optional().describe("Filter by vendor name"),
    title: z.string().optional().describe("Filter by title"),
  },
  async ({ limit, status, collection_id, product_type, vendor, title }) =>
    executeWithHooks(
      "get_products",
      { limit, status, collection_id, product_type, vendor, title },
      config,
      () => shopify.getProducts({ limit, status, collection_id, product_type, vendor, title })
    )
);

server.tool(
  "get_product",
  "Get a single product by ID. Returns full product details including variants, images, options, and metafields.",
  {
    product_id: z.string().describe("Shopify product ID"),
  },
  async ({ product_id }) =>
    executeWithHooks(
      "get_product",
      { product_id },
      config,
      () => shopify.getProduct(product_id)
    )
);

server.tool(
  "create_product",
  "Create a new product in Shopify. Provide title, description, variants, images, and other product data.",
  {
    product: z.record(z.string(), z.unknown()).describe("Product data object: title (required), body_html, vendor, product_type, tags, variants[], images[], options[]"),
  },
  async ({ product }) =>
    executeWithHooks(
      "create_product",
      { product },
      config,
      () => shopify.createProduct(product)
    )
);

server.tool(
  "update_product",
  "Update an existing product. Only include fields you want to change. Supports updating title, description, variants, images, tags, status.",
  {
    product_id: z.string().describe("Shopify product ID to update"),
    product: z.record(z.string(), z.unknown()).describe("Fields to update: title, body_html, vendor, product_type, tags, status, variants[], images[]"),
  },
  async ({ product_id, product }) =>
    executeWithHooks(
      "update_product",
      { product_id, product },
      config,
      () => shopify.updateProduct(product_id, product)
    )
);

server.tool(
  "delete_product",
  "Permanently delete a product from Shopify. This action is irreversible.",
  {
    product_id: z.string().describe("Shopify product ID to delete"),
  },
  async ({ product_id }) =>
    executeWithHooks(
      "delete_product",
      { product_id },
      config,
      () => shopify.deleteProduct(product_id)
    )
);

server.tool(
  "get_product_variants",
  "List all variants for a specific product. Returns variant details including price, SKU, inventory, and options.",
  {
    product_id: z.string().describe("Shopify product ID"),
    limit: z.number().optional().default(50).describe("Max variants to return (max 250)"),
  },
  async ({ product_id, limit }) =>
    executeWithHooks(
      "get_product_variants",
      { product_id, limit },
      config,
      () => shopify.getProductVariants(product_id, { limit })
    )
);

// ─── ORDER TOOLS (4) ─────────────────────────────────────────

server.tool(
  "get_orders",
  "List orders from Shopify. Filter by status, financial status, fulfillment status, or date range. Returns paginated order data.",
  {
    limit: z.number().optional().default(50).describe("Max orders to return (max 250)"),
    status: z.string().optional().describe("Order status: open, closed, cancelled, any (default: open)"),
    financial_status: z.string().optional().describe("Financial status: authorized, pending, paid, partially_paid, refunded, voided, partially_refunded, any"),
    fulfillment_status: z.string().optional().describe("Fulfillment status: shipped, partial, unshipped, any, unfulfilled"),
    created_at_min: z.string().optional().describe("Min creation date (ISO 8601 format, e.g., 2026-01-01T00:00:00Z)"),
    created_at_max: z.string().optional().describe("Max creation date (ISO 8601 format)"),
    since_id: z.string().optional().describe("Return only orders after this ID"),
  },
  async ({ limit, status, financial_status, fulfillment_status, created_at_min, created_at_max, since_id }) =>
    executeWithHooks(
      "get_orders",
      { limit, status, financial_status, fulfillment_status, created_at_min, created_at_max, since_id },
      config,
      () => shopify.getOrders({ limit, status, financial_status, fulfillment_status, created_at_min, created_at_max, since_id })
    )
);

server.tool(
  "get_order",
  "Get a single order by ID. Returns full order details including line items, shipping, billing, fulfillments, and transactions.",
  {
    order_id: z.string().describe("Shopify order ID"),
  },
  async ({ order_id }) =>
    executeWithHooks(
      "get_order",
      { order_id },
      config,
      () => shopify.getOrder(order_id)
    )
);

server.tool(
  "close_order",
  "Close an order. The order is marked as closed and no further edits can be made.",
  {
    order_id: z.string().describe("Shopify order ID to close"),
  },
  async ({ order_id }) =>
    executeWithHooks(
      "close_order",
      { order_id },
      config,
      () => shopify.closeOrder(order_id)
    )
);

server.tool(
  "cancel_order",
  "Cancel an order. Optionally specify reason, whether to send email notification, and whether to restock items.",
  {
    order_id: z.string().describe("Shopify order ID to cancel"),
    reason: z.string().optional().describe("Cancellation reason: customer, fraud, inventory, declined, other"),
    email: z.boolean().optional().default(true).describe("Send cancellation email to customer (default: true)"),
    restock: z.boolean().optional().default(true).describe("Restock cancelled items (default: true)"),
  },
  async ({ order_id, reason, email, restock }) =>
    executeWithHooks(
      "cancel_order",
      { order_id, reason, email, restock },
      config,
      () => shopify.cancelOrder(order_id, { reason, email, restock })
    )
);

// ─── FULFILLMENT TOOLS (1) ───────────────────────────────────

server.tool(
  "create_fulfillment",
  "Create a fulfillment for an order. Provide line items, tracking info, and location. Uses the Fulfillment Orders API format.",
  {
    fulfillment: z.record(z.string(), z.unknown()).describe("Fulfillment data: line_items_by_fulfillment_order (required), tracking_info { number, url, company }, notify_customer"),
  },
  async ({ fulfillment }) =>
    executeWithHooks(
      "create_fulfillment",
      { fulfillment },
      config,
      () => shopify.createFulfillment(fulfillment)
    )
);

// ─── CUSTOMER TOOLS (4) ──────────────────────────────────────

server.tool(
  "get_customers",
  "List customers from Shopify. Returns paginated customer data with contact info, order count, and total spent.",
  {
    limit: z.number().optional().default(50).describe("Max customers to return (max 250)"),
    since_id: z.string().optional().describe("Return only customers after this ID"),
    created_at_min: z.string().optional().describe("Min creation date (ISO 8601)"),
    created_at_max: z.string().optional().describe("Max creation date (ISO 8601)"),
  },
  async ({ limit, since_id, created_at_min, created_at_max }) =>
    executeWithHooks(
      "get_customers",
      { limit, since_id, created_at_min, created_at_max },
      config,
      () => shopify.getCustomers({ limit, since_id, created_at_min, created_at_max })
    )
);

server.tool(
  "get_customer",
  "Get a single customer by ID. Returns full customer profile including addresses, orders count, total spent, and tags.",
  {
    customer_id: z.string().describe("Shopify customer ID"),
  },
  async ({ customer_id }) =>
    executeWithHooks(
      "get_customer",
      { customer_id },
      config,
      () => shopify.getCustomer(customer_id)
    )
);

server.tool(
  "create_customer",
  "Create a new customer in Shopify. Provide email, name, phone, addresses, and tags.",
  {
    customer: z.record(z.string(), z.unknown()).describe("Customer data: email (required), first_name, last_name, phone, addresses[], tags, note, tax_exempt, send_email_invite"),
  },
  async ({ customer }) =>
    executeWithHooks(
      "create_customer",
      { customer },
      config,
      () => shopify.createCustomer(customer)
    )
);

server.tool(
  "search_customers",
  "Search customers by query string. Search by name, email, phone, or other fields. Returns matching customer profiles.",
  {
    query: z.string().describe("Search query (e.g., email:john@example.com, phone:+5511999, or free text)"),
  },
  async ({ query }) =>
    executeWithHooks(
      "search_customers",
      { query },
      config,
      () => shopify.searchCustomers(query)
    )
);

// ─── INVENTORY TOOLS (3) ─────────────────────────────────────

server.tool(
  "get_inventory_levels",
  "Get inventory levels for items at locations. Provide inventory_item_ids or location_ids to filter.",
  {
    inventory_item_ids: z.string().optional().describe("Comma-separated inventory item IDs"),
    location_ids: z.string().optional().describe("Comma-separated location IDs"),
    limit: z.number().optional().default(50).describe("Max results to return"),
  },
  async ({ inventory_item_ids, location_ids, limit }) =>
    executeWithHooks(
      "get_inventory_levels",
      { inventory_item_ids, location_ids, limit },
      config,
      () => shopify.getInventoryLevels({ inventory_item_ids, location_ids, limit })
    )
);

server.tool(
  "set_inventory_level",
  "Set the inventory level for an item at a specific location. Sets the absolute available quantity.",
  {
    inventory_item_id: z.number().describe("Inventory item ID"),
    location_id: z.number().describe("Location ID where inventory is stored"),
    available: z.number().describe("Quantity available to sell"),
  },
  async ({ inventory_item_id, location_id, available }) =>
    executeWithHooks(
      "set_inventory_level",
      { inventory_item_id, location_id, available },
      config,
      () => shopify.setInventoryLevel({ inventory_item_id, location_id, available })
    )
);

server.tool(
  "get_locations",
  "List all locations for the store. Returns location details including name, address, and whether it is active.",
  {},
  async () =>
    executeWithHooks(
      "get_locations",
      {},
      config,
      () => shopify.getLocations()
    )
);

// ─── COLLECTION TOOLS (2) ────────────────────────────────────

server.tool(
  "get_collections",
  "List custom collections from Shopify. Returns collection names, descriptions, and product counts.",
  {
    limit: z.number().optional().default(50).describe("Max collections to return (max 250)"),
    since_id: z.string().optional().describe("Return only collections after this ID"),
    title: z.string().optional().describe("Filter by collection title"),
  },
  async ({ limit, since_id, title }) =>
    executeWithHooks(
      "get_collections",
      { limit, since_id, title },
      config,
      () => shopify.getCollections({ limit, since_id, title })
    )
);

server.tool(
  "create_collection",
  "Create a new custom collection. Provide title, description, and optional product list.",
  {
    collection: z.record(z.string(), z.unknown()).describe("Collection data: title (required), body_html, image, published, sort_order, collects[]"),
  },
  async ({ collection }) =>
    executeWithHooks(
      "create_collection",
      { collection },
      config,
      () => shopify.createCollection(collection)
    )
);

// ─── DISCOUNT TOOLS (3) ──────────────────────────────────────

server.tool(
  "get_price_rules",
  "List price rules (discount configurations) from Shopify. Price rules define discount logic; discount codes are attached to them.",
  {
    limit: z.number().optional().default(50).describe("Max price rules to return (max 250)"),
    since_id: z.string().optional().describe("Return only price rules after this ID"),
  },
  async ({ limit, since_id }) =>
    executeWithHooks(
      "get_price_rules",
      { limit, since_id },
      config,
      () => shopify.getPriceRules({ limit, since_id })
    )
);

server.tool(
  "create_price_rule",
  "Create a new price rule (discount configuration). Define the discount type, value, target, eligibility, and usage limits.",
  {
    price_rule: z.record(z.string(), z.unknown()).describe("Price rule data: title (required), target_type (line_item/shipping_line), target_selection (all/entitled), allocation_method (across/each), value_type (fixed_amount/percentage), value (negative number e.g. -10.0), customer_selection (all/prerequisite), starts_at, ends_at, usage_limit"),
  },
  async ({ price_rule }) =>
    executeWithHooks(
      "create_price_rule",
      { price_rule },
      config,
      () => shopify.createPriceRule(price_rule)
    )
);

server.tool(
  "create_discount_code",
  "Create a discount code attached to a price rule. Customers enter this code at checkout to apply the discount.",
  {
    price_rule_id: z.string().describe("Price rule ID to attach the discount code to"),
    code: z.string().describe("Discount code string (e.g., PROMO10, BLACKFRIDAY)"),
  },
  async ({ price_rule_id, code }) =>
    executeWithHooks(
      "create_discount_code",
      { price_rule_id, code },
      config,
      () => shopify.createDiscountCode(price_rule_id, code)
    )
);

// ─── SHOP TOOL (1) ───────────────────────────────────────────

server.tool(
  "get_shop",
  "Get store information. Returns shop name, domain, currency, timezone, plan, and general settings.",
  {},
  async () =>
    executeWithHooks(
      "get_shop",
      {},
      config,
      () => shopify.getShop()
    )
);

// ═══════════════════════════════════════════════════════════════
// RESOURCES (read-only context for agents)
// ═══════════════════════════════════════════════════════════════

server.resource("products", "shopify://products", async () => {
  const result = await shopify.getProducts({ limit: 50 });
  return {
    contents: [
      {
        uri: "shopify://products",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("orders", "shopify://orders", async () => {
  const result = await shopify.getOrders({ limit: 50, status: "any" });
  return {
    contents: [
      {
        uri: "shopify://orders",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("shop", "shopify://shop", async () => {
  const result = await shopify.getShop();
  return {
    contents: [
      {
        uri: "shopify://shop",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

// ═══════════════════════════════════════════════════════════════
// PROMPTS (reusable templates in Portuguese)
// ═══════════════════════════════════════════════════════════════

server.prompt(
  "gerenciador-estoque",
  "Guia para gerenciar estoque no Shopify -- consultar, ajustar niveis, localizar itens com estoque baixo",
  {
    action: z
      .string()
      .describe(
        "Acao desejada: consultar, ajustar, estoque_baixo, transferir"
      ),
    product_name: z
      .string()
      .optional()
      .describe("Nome do produto para filtrar"),
  },
  ({ action, product_name }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso gerenciar o estoque no Shopify. Acao: "${action}"${product_name ? `. Produto: ${product_name}` : ""}.

Passos:
1. Use get_locations para listar os locais de estoque disponiveis.
2. Use get_products para encontrar o produto${product_name ? ` "${product_name}"` : ""} e obter o inventory_item_id das variantes.
3. Use get_inventory_levels com os inventory_item_ids para ver os niveis atuais.
4. Execute a acao solicitada:
   - **consultar**: mostre os niveis de estoque por local e variante.
   - **ajustar**: use set_inventory_level para definir a quantidade disponivel.
   - **estoque_baixo**: liste produtos com estoque abaixo de 10 unidades.
   - **transferir**: ajuste niveis entre locais (diminua em um, aumente no outro).

IMPORTANTE:
- set_inventory_level define o valor absoluto, nao incrementa.
- Sempre confirme a quantidade antes de alterar.
- Considere que variantes diferentes (tamanho, cor) tem inventory_item_ids distintos.
- Verifique se o local esta ativo antes de ajustar estoque.`,
        },
      },
    ],
  })
);

server.prompt(
  "processador-pedidos",
  "Guia para processar pedidos no Shopify -- visualizar, fulfil, cancelar, fechar",
  {
    action: z
      .string()
      .describe(
        "Acao desejada: listar, detalhar, fulfil, cancelar, fechar"
      ),
    order_id: z
      .string()
      .optional()
      .describe("ID do pedido (se aplicavel)"),
  },
  ({ action, order_id }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso processar pedidos no Shopify. Acao: "${action}"${order_id ? `. Pedido: #${order_id}` : ""}.

Passos:
1. Use get_orders para listar pedidos pendentes (status: open, fulfillment_status: unshipped).
2. Use get_order com o order_id para ver detalhes completos do pedido.
3. Execute a acao solicitada:
   - **listar**: mostre pedidos com filtros relevantes (status, data, financeiro).
   - **detalhar**: use get_order para ver line_items, endereco, pagamento.
   - **fulfil**: use create_fulfillment com tracking_info e line_items_by_fulfillment_order.
   - **cancelar**: use cancel_order (confirme motivo e se deseja restock e email).
   - **fechar**: use close_order para fechar o pedido manualmente.

DICAS:
- Pedidos cancelados nao podem ser reabertos.
- Ao fazer fulfillment, inclua numero de rastreio (tracking_number) quando possivel.
- Verifique o financial_status antes de fazer fulfillment (deve ser paid ou partially_paid).
- Use created_at_min/max para filtrar por periodo.`,
        },
      },
    ],
  })
);

server.prompt(
  "criador-descontos",
  "Guia para criar cupons de desconto no Shopify -- price rules e discount codes",
  {
    discount_type: z
      .enum(["percentage", "fixed_amount", "free_shipping"])
      .describe("Tipo de desconto: percentage, fixed_amount, free_shipping"),
    code: z
      .string()
      .optional()
      .describe("Codigo do cupom desejado (ex: PROMO10, BLACKFRIDAY)"),
  },
  ({ discount_type, code }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso criar um desconto no Shopify. Tipo: "${discount_type}"${code ? `. Codigo: ${code}` : ""}.

No Shopify, descontos sao criados em 2 etapas:
1. **Price Rule**: define a logica do desconto (tipo, valor, elegibilidade, limites).
2. **Discount Code**: o codigo que o cliente digita no checkout.

Passos:
1. Use get_price_rules para verificar regras existentes e evitar duplicatas.
2. Use create_price_rule com os parametros:
   - title: nome descritivo (ex: "Black Friday 20% OFF")
   - target_type: "line_item" (produto) ou "shipping_line" (frete)
   - target_selection: "all" (todos) ou "entitled" (produtos especificos)
   - allocation_method: "across" (divide entre itens) ou "each" (aplica em cada)
   - value_type: "${discount_type === "free_shipping" ? "percentage" : discount_type}"
   - value: valor NEGATIVO (ex: "-20.0" para 20% off ou "-10.00" para R$10 off)
   - customer_selection: "all" (todos clientes)
   - starts_at: data de inicio (ISO 8601)
   - ends_at: data de fim (opcional, para criar urgencia)
   - usage_limit: limite total de usos
3. Use create_discount_code com o price_rule_id e o codigo "${code || "DESCONTO"}".

BOAS PRATICAS:
- Codigos em MAIUSCULAS sao mais visiveis (ex: PROMO10, NATAL50).
- Sempre defina ends_at para criar senso de urgencia.
- Defina usage_limit para controlar impacto financeiro.
- Para frete gratis: value_type="percentage", value="-100", target_type="shipping_line".
- Valores fixos: value="-10.00" desconta R$10 (ou USD, dependendo da moeda da loja).
- Valores percentuais: value="-20.0" desconta 20%.`,
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
  console.error("BridgeAPI Shopify MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
