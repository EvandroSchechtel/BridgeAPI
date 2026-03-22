#!/usr/bin/env node
/**
 * @bridgeapi/mcp-mercadolivre — MCP Server for Mercado Livre API
 *
 * Connect any AI Agent to Mercado Livre via the Model Context Protocol.
 * Part of the BridgeAPI ecosystem: https://bridgeapi.com.br
 *
 * Phase 1: passthrough with structured logging (hooks are no-ops)
 * Phase 2: Execution Engine plugs into pre/post hooks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  MercadoLivreClient,
  preExecuteHook,
  postExecuteHook,
  type MeliConfig,
  type HookContext,
  type ApiResponse,
} from "./mercadolivre-client.js";

// ─── CONFIG ──────────────────────────────────────────────────

function loadConfig(): MeliConfig {
  const appId = process.env.MELI_APP_ID;
  const clientSecret = process.env.MELI_CLIENT_SECRET;
  const accessToken = process.env.MELI_ACCESS_TOKEN;
  const refreshToken = process.env.MELI_REFRESH_TOKEN;
  const siteId = process.env.MELI_SITE_ID || "MLB";

  if (!appId) throw new Error("MELI_APP_ID is required");
  if (!clientSecret) throw new Error("MELI_CLIENT_SECRET is required");
  if (!accessToken) throw new Error("MELI_ACCESS_TOKEN is required");
  if (!refreshToken) throw new Error("MELI_REFRESH_TOKEN is required");

  return { appId, clientSecret, accessToken, refreshToken, siteId };
}

// ─── TOOL WRAPPER WITH HOOKS ─────────────────────────────────
// Every tool call goes through this wrapper.
// Phase 1: hooks are no-ops that log.
// Phase 2: hooks evaluate confidence and may block/escalate.

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: MeliConfig,
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
const meli = new MercadoLivreClient(config);

const server = new McpServer(
  {
    name: "bridgeapi-mercadolivre",
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
// TOOLS (20 total)
// ═══════════════════════════════════════════════════════════════

// ─── ITEM TOOLS ─────────────────────────────────────────────

server.tool(
  "search_items",
  "Search for items on Mercado Livre. Filter by query, category, or sort order. Returns paginated results with item details, prices, and seller info.",
  {
    query: z.string().describe("Search query (e.g., 'iPhone 15', 'notebook gamer')"),
    site_id: z
      .string()
      .optional()
      .default("MLB")
      .describe("Mercado Livre site ID (default: MLB for Brazil). Others: MLA (Argentina), MLM (Mexico)"),
    category: z
      .string()
      .optional()
      .describe("Category ID to filter results (e.g., MLB1055 for Cellphones)"),
    sort: z
      .string()
      .optional()
      .describe("Sort order: relevance, price_asc, price_desc"),
    offset: z.number().optional().describe("Pagination offset (default: 0)"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Results per page (default: 20, max: 50)"),
  },
  async ({ query, site_id, category, sort, offset, limit }) =>
    executeWithHooks(
      "search_items",
      { query, site_id, category, sort, offset, limit },
      config,
      () =>
        meli.searchItems({
          query,
          siteId: site_id,
          category,
          sort,
          offset,
          limit,
        })
    )
);

server.tool(
  "get_item",
  "Get complete details of a specific Mercado Livre item by its ID. Returns title, price, condition, seller, pictures, attributes, and more.",
  {
    item_id: z
      .string()
      .describe("Mercado Livre item ID (e.g., MLB1234567890)"),
  },
  async ({ item_id }) =>
    executeWithHooks("get_item", { item_id }, config, () =>
      meli.getItem(item_id)
    )
);

server.tool(
  "create_item",
  "Create a new product listing on Mercado Livre. Requires title, category, price, and quantity. Returns the created item with its new ID.",
  {
    title: z
      .string()
      .describe("Product title (max 60 chars). Be descriptive and include brand/model."),
    category_id: z
      .string()
      .describe("Category ID (use get_categories to find the right one)"),
    price: z.number().describe("Price in the specified currency (e.g., 199.90)"),
    currency_id: z
      .string()
      .optional()
      .default("BRL")
      .describe("Currency: BRL (Real), ARS (Peso), MXN (Peso mexicano). Default: BRL"),
    available_quantity: z
      .number()
      .describe("Available stock quantity"),
    buying_mode: z
      .string()
      .optional()
      .default("buy_it_now")
      .describe("Buying mode: buy_it_now (fixed price) or auction"),
    condition: z
      .enum(["new", "used"])
      .describe("Item condition: new or used"),
    listing_type_id: z
      .string()
      .optional()
      .default("gold_special")
      .describe("Listing type: free, bronze, silver, gold, gold_special, gold_premium, gold_pro"),
    description: z
      .string()
      .optional()
      .describe("Detailed product description in plain text"),
    pictures: z
      .array(z.string())
      .optional()
      .describe("Array of image URLs for the product"),
  },
  async ({
    title,
    category_id,
    price,
    currency_id,
    available_quantity,
    buying_mode,
    condition,
    listing_type_id,
    description,
    pictures,
  }) =>
    executeWithHooks(
      "create_item",
      {
        title,
        category_id,
        price,
        currency_id,
        available_quantity,
        buying_mode,
        condition,
        listing_type_id,
        description,
        pictures,
      },
      config,
      () =>
        meli.createItem({
          title,
          category_id,
          price,
          currency_id,
          available_quantity,
          buying_mode,
          condition,
          listing_type_id,
          description,
          pictures: pictures?.map((url) => ({ source: url })),
        })
    )
);

server.tool(
  "update_item",
  "Update an existing Mercado Livre listing. Can change price, quantity, status, or title. Only include fields you want to update.",
  {
    item_id: z
      .string()
      .describe("Mercado Livre item ID to update"),
    price: z.number().optional().describe("New price"),
    available_quantity: z
      .number()
      .optional()
      .describe("New available quantity"),
    status: z
      .string()
      .optional()
      .describe("New status: active, paused, closed"),
    title: z.string().optional().describe("New title"),
  },
  async ({ item_id, price, available_quantity, status, title }) =>
    executeWithHooks(
      "update_item",
      { item_id, price, available_quantity, status, title },
      config,
      () =>
        meli.updateItem(item_id, { price, available_quantity, status, title })
    )
);

server.tool(
  "pause_item",
  "Pause an active listing on Mercado Livre. The item will not be visible to buyers but can be reactivated later.",
  {
    item_id: z.string().describe("Mercado Livre item ID to pause"),
  },
  async ({ item_id }) =>
    executeWithHooks("pause_item", { item_id }, config, () =>
      meli.pauseItem(item_id)
    )
);

server.tool(
  "activate_item",
  "Reactivate a paused listing on Mercado Livre. The item becomes visible to buyers again.",
  {
    item_id: z
      .string()
      .describe("Mercado Livre item ID to activate"),
  },
  async ({ item_id }) =>
    executeWithHooks("activate_item", { item_id }, config, () =>
      meli.activateItem(item_id)
    )
);

server.tool(
  "delete_item",
  "Delete (close) a listing on Mercado Livre. This action is irreversible — the item will be permanently removed from the marketplace.",
  {
    item_id: z
      .string()
      .describe("Mercado Livre item ID to delete"),
  },
  async ({ item_id }) =>
    executeWithHooks("delete_item", { item_id }, config, () =>
      meli.deleteItem(item_id)
    )
);

server.tool(
  "get_item_description",
  "Get the full text description of a Mercado Livre item.",
  {
    item_id: z
      .string()
      .describe("Mercado Livre item ID"),
  },
  async ({ item_id }) =>
    executeWithHooks("get_item_description", { item_id }, config, () =>
      meli.getItemDescription(item_id)
    )
);

server.tool(
  "update_item_description",
  "Update the text description of a Mercado Livre item. Replaces the existing description with new plain text.",
  {
    item_id: z
      .string()
      .describe("Mercado Livre item ID"),
    plain_text: z
      .string()
      .describe("New description in plain text"),
  },
  async ({ item_id, plain_text }) =>
    executeWithHooks(
      "update_item_description",
      { item_id, plain_text },
      config,
      () => meli.updateItemDescription(item_id, plain_text)
    )
);

// ─── ORDER TOOLS ─────────────────────────────────────────────

server.tool(
  "get_orders",
  "List your Mercado Livre orders. Filter by status (paid, shipped, delivered). Returns buyer info, items, and payment details.",
  {
    status: z
      .enum(["paid", "shipped", "delivered"])
      .optional()
      .describe("Order status filter: paid, shipped, or delivered"),
    sort: z
      .string()
      .optional()
      .default("date_desc")
      .describe("Sort order: date_asc, date_desc (default: date_desc)"),
    offset: z.number().optional().describe("Pagination offset"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Results per page (default: 20)"),
  },
  async ({ status, sort, offset, limit }) =>
    executeWithHooks(
      "get_orders",
      { status, sort, offset, limit },
      config,
      () => meli.getOrders({ status, sort, offset, limit })
    )
);

server.tool(
  "get_order",
  "Get complete details of a specific Mercado Livre order by its ID. Returns buyer info, items, payment, and shipping details.",
  {
    order_id: z.string().describe("Mercado Livre order ID"),
  },
  async ({ order_id }) =>
    executeWithHooks("get_order", { order_id }, config, () =>
      meli.getOrder(order_id)
    )
);

// ─── QUESTION TOOLS ──────────────────────────────────────────

server.tool(
  "get_questions",
  "List questions received on your Mercado Livre listings. Filter by item or status (unanswered/answered). Great for customer service.",
  {
    item_id: z
      .string()
      .optional()
      .describe("Filter questions for a specific item ID"),
    status: z
      .enum(["unanswered", "answered"])
      .optional()
      .describe("Filter by status: unanswered or answered"),
    sort: z
      .string()
      .optional()
      .default("date_desc")
      .describe("Sort: date_desc (default), date_asc"),
    offset: z.number().optional().describe("Pagination offset"),
    limit: z.number().optional().describe("Results per page"),
  },
  async ({ item_id, status, sort, offset, limit }) =>
    executeWithHooks(
      "get_questions",
      { item_id, status, sort, offset, limit },
      config,
      () =>
        meli.getQuestions({ itemId: item_id, status, sort, offset, limit })
    )
);

server.tool(
  "answer_question",
  "Answer a buyer's question on Mercado Livre. Provides a public response visible to all potential buyers.",
  {
    question_id: z
      .number()
      .describe("Question ID to answer"),
    text: z
      .string()
      .describe("Your answer text (visible to all buyers viewing the listing)"),
  },
  async ({ question_id, text }) =>
    executeWithHooks(
      "answer_question",
      { question_id, text },
      config,
      () => meli.answerQuestion(question_id, text)
    )
);

// ─── MESSAGE TOOLS ───────────────────────────────────────────

server.tool(
  "get_messages",
  "Get messages exchanged with a buyer for a specific order. Returns the full conversation thread.",
  {
    order_id: z
      .string()
      .describe("Order ID to get messages for"),
  },
  async ({ order_id }) =>
    executeWithHooks("get_messages", { order_id }, config, () =>
      meli.getMessages(order_id)
    )
);

server.tool(
  "send_message",
  "Send a message to a buyer for a specific order. Used for post-sale communication.",
  {
    order_id: z.string().describe("Order ID to send message for"),
    text: z.string().describe("Message text to send to the buyer"),
    attachments: z
      .array(z.string())
      .optional()
      .describe("Array of attachment filenames"),
  },
  async ({ order_id, text, attachments }) =>
    executeWithHooks(
      "send_message",
      { order_id, text, attachments },
      config,
      () => meli.sendMessage(order_id, text, attachments)
    )
);

// ─── USER TOOLS ──────────────────────────────────────────────

server.tool(
  "get_me",
  "Get your Mercado Livre account information. Returns user ID, nickname, registration date, seller reputation, and account status.",
  {},
  async () =>
    executeWithHooks("get_me", {}, config, () => meli.getMe())
);

// ─── CATEGORY TOOLS ──────────────────────────────────────────

server.tool(
  "get_categories",
  "List all top-level categories for a Mercado Livre site. Useful for finding the right category when creating listings.",
  {
    site_id: z
      .string()
      .optional()
      .default("MLB")
      .describe("Site ID (default: MLB for Brazil)"),
  },
  async ({ site_id }) =>
    executeWithHooks("get_categories", { site_id }, config, () =>
      meli.getCategories(site_id)
    )
);

server.tool(
  "get_category_attributes",
  "Get required and optional attributes for a specific category. Essential before creating items — shows which fields are mandatory.",
  {
    category_id: z
      .string()
      .describe("Category ID (e.g., MLB1055)"),
  },
  async ({ category_id }) =>
    executeWithHooks(
      "get_category_attributes",
      { category_id },
      config,
      () => meli.getCategoryAttributes(category_id)
    )
);

// ─── SHIPPING TOOLS ──────────────────────────────────────────

server.tool(
  "get_shipment_tracking",
  "Get shipment tracking information including status, carrier, tracking number, and delivery dates.",
  {
    shipment_id: z
      .string()
      .describe("Shipment ID (obtained from order details)"),
  },
  async ({ shipment_id }) =>
    executeWithHooks(
      "get_shipment_tracking",
      { shipment_id },
      config,
      () => meli.getShipmentTracking(shipment_id)
    )
);

// ─── VISITS / ANALYTICS ─────────────────────────────────────

server.tool(
  "get_item_visits",
  "Get visit/view statistics for a specific item. Useful for tracking listing performance.",
  {
    item_id: z
      .string()
      .describe("Mercado Livre item ID"),
    date_from: z
      .string()
      .optional()
      .describe("Start date (ISO format: YYYY-MM-DD)"),
    date_to: z
      .string()
      .optional()
      .describe("End date (ISO format: YYYY-MM-DD)"),
  },
  async ({ item_id, date_from, date_to }) =>
    executeWithHooks(
      "get_item_visits",
      { item_id, date_from, date_to },
      config,
      () => meli.getItemVisits(item_id, date_from, date_to)
    )
);

// ═══════════════════════════════════════════════════════════════
// RESOURCES (read-only context for agents)
// ═══════════════════════════════════════════════════════════════

server.resource("orders", "meli://orders", async () => {
  const result = await meli.getOrders({ limit: 50 });
  return {
    contents: [
      {
        uri: "meli://orders",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("items", "meli://items", async () => {
  const result = await meli.getMyItems();
  return {
    contents: [
      {
        uri: "meli://items",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("me", "meli://me", async () => {
  const result = await meli.getMe();
  return {
    contents: [
      {
        uri: "meli://me",
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
  "listing-creator",
  "Guia para criar um anúncio otimizado no Mercado Livre — título, descrição, fotos e atributos",
  {
    product_name: z
      .string()
      .describe("Nome do produto a ser anunciado"),
    category: z
      .string()
      .optional()
      .describe("Categoria sugerida (opcional)"),
  },
  ({ product_name, category }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso criar um anúncio otimizado no Mercado Livre para: "${product_name}"${category ? ` na categoria "${category}"` : ""}.

Passos:
1. Use get_categories para encontrar a categoria ideal (se não fornecida).
2. Use get_category_attributes para saber os atributos obrigatórios da categoria.
3. Use search_items para pesquisar produtos similares e analisar títulos, preços e fotos dos concorrentes.
4. Use create_item para criar o anúncio.
5. Use update_item_description para adicionar uma descrição completa.

BOAS PRÁTICAS PARA ANÚNCIOS NO MERCADO LIVRE:
- TÍTULO (máx 60 caracteres): Inclua marca + modelo + característica principal + diferencial.
  Exemplo: "iPhone 15 Pro Max 256gb Titanio Natural Lacrado"
- PREÇO: Pesquise concorrentes com search_items. Preço competitivo = mais vendas.
- FOTOS: Mínimo 3 fotos. Fundo branco. Primeira foto é a mais importante.
- DESCRIÇÃO: Organize com tópicos. Inclua especificações técnicas, garantia, e diferenciais.
- CONDIÇÃO: new (novo) ou used (usado) — impacta visibilidade e confiança.
- TIPO DE ANÚNCIO:
  - free: grátis, sem exposição
  - gold_special: melhor custo-benefício (11% comissão, boa exposição)
  - gold_pro: máxima exposição (16% comissão, full com frete grátis)
- ESTOQUE: Mantenha available_quantity sempre atualizado para evitar reclamações.
- FRETE GRÁTIS: Anúncios com Mercado Envios Full vendem até 5x mais.

ERROS COMUNS A EVITAR:
- Título com CAPS LOCK excessivo (Mercado Livre pode pausar o anúncio).
- Preço muito abaixo do mercado (pode gerar suspensão por suspeita de fraude).
- Descrição com links externos ou dados de contato (proibido).
- Fotos com marcas d'água ou texto sobre a imagem.`,
        },
      },
    ],
  })
);

server.prompt(
  "order-manager",
  "Guia para gerenciar pedidos e envios no Mercado Livre — rastreio, mensagens e problemas",
  {
    order_status: z
      .string()
      .optional()
      .describe("Status do pedido: paid, shipped, delivered"),
    issue: z
      .string()
      .optional()
      .describe("Problema específico: atraso, extravio, devolução, reclamação"),
  },
  ({ order_status, issue }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso gerenciar pedidos no Mercado Livre${order_status ? ` com status "${order_status}"` : ""}${issue ? `. Problema: ${issue}` : ""}.

Passos:
1. Use get_orders para listar pedidos${order_status ? ` com status "${order_status}"` : ""}.
2. Use get_order para ver detalhes de um pedido específico (comprador, itens, pagamento).
3. Use get_shipment_tracking para rastrear o envio.
4. Use get_messages para ver conversas com o comprador.
5. Use send_message para comunicar-se com o comprador.

FLUXO DE PEDIDOS NO MERCADO LIVRE:
- paid → Pagamento confirmado. Prepare o envio.
- shipped → Enviado. Acompanhe o rastreio.
- delivered → Entregue. Aguarde avaliação do comprador.

PROBLEMAS COMUNS:
- **Atraso no envio**: Envie dentro do prazo (24-48h para Mercado Envios Full). Use get_shipment_tracking para monitorar.
- **Extravio**: Se o rastreio mostra "entregue" mas comprador não recebeu, oriente a abrir reclamação no ML.
- **Devolução**: Mercado Livre oferece 30 dias de devolução grátis. Aceite cordialmente.
- **Reclamação**: Responda RÁPIDO (impacta sua reputação). Use send_message para negociar.

DICAS PARA MANTER BOA REPUTAÇÃO:
- Responda mensagens em até 1 hora (ideal) ou 24 horas (máximo).
- Envie no prazo — atrasos derrubam sua reputação rapidamente.
- Nunca peça ao comprador para cancelar a compra.
- Mantenha estoque atualizado para evitar vendas sem produto.`,
        },
      },
    ],
  })
);

server.prompt(
  "question-responder",
  "Guia para responder perguntas de compradores no Mercado Livre de forma profissional e eficiente",
  {
    context: z
      .string()
      .optional()
      .describe("Contexto adicional: tipo de produto, política da loja, etc."),
  },
  ({ context }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso responder perguntas de compradores no Mercado Livre${context ? `. Contexto: ${context}` : ""}.

Passos:
1. Use get_questions com status "unanswered" para ver perguntas pendentes.
2. Use get_item para entender o produto sobre o qual estão perguntando.
3. Use answer_question para responder cada pergunta.

BOAS PRÁTICAS PARA RESPOSTAS:
- Responda RÁPIDO: Perguntas respondidas em até 1 hora convertem 3x mais.
- Seja CLARO e OBJETIVO: Responda diretamente o que foi perguntado.
- Seja CORDIAL: "Olá! Obrigado pela pergunta." + resposta + "Qualquer dúvida estou à disposição!"
- NUNCA inclua: telefone, email, links externos, ou peça para contato fora do ML.
- NUNCA seja rude: Mesmo perguntas "bobas" são oportunidades de venda.
- Use FORMATAÇÃO: O Mercado Livre aceita texto simples, então use - para listas.

TEMPLATES DE RESPOSTA:
- **Disponibilidade**: "Olá! Sim, temos em estoque. Pode comprar com tranquilidade!"
- **Prazo de envio**: "Olá! Enviamos em até 24h após a confirmação do pagamento."
- **Garantia**: "Olá! Este produto possui garantia de [X] meses/dias."
- **Cor/Tamanho**: "Olá! Temos disponível nas cores: [listar]. Para escolher, basta informar na compra."
- **Desconto**: "Olá! No momento o melhor preço é o anunciado. Comprando pode gerar frete grátis!"
- **Nota fiscal**: "Olá! Sim, enviamos nota fiscal junto com o produto."

PERGUNTAS PROBLEMÁTICAS:
- Pedidos de desconto: Responda gentilmente que o preço já é competitivo.
- Reclamações em perguntas: Peça para o comprador abrir uma reclamação formal pelo pedido.
- Spam: Ignore ou responda "Obrigado pelo interesse. Veja os detalhes no anúncio!"`,
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
  console.error("BridgeAPI Mercado Livre MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
