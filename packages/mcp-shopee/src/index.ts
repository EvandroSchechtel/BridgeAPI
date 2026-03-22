#!/usr/bin/env node
/**
 * @bridgeapi/mcp-shopee — MCP Server for Shopee Open Platform API
 *
 * Connect any AI Agent to Shopee via the Model Context Protocol.
 * Part of the BridgeAPI ecosystem: https://bridgeapi.com.br
 *
 * Phase 1: passthrough with structured logging (hooks are no-ops)
 * Phase 2: Execution Engine plugs into pre/post hooks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  ShopeeClient,
  preExecuteHook,
  postExecuteHook,
  type ShopeeConfig,
  type HookContext,
  type ApiResponse,
} from "./shopee-client.js";

// ─── CONFIG ──────────────────────────────────────────────────

function loadConfig(): ShopeeConfig {
  const partnerId = process.env.SHOPEE_PARTNER_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  const shopId = process.env.SHOPEE_SHOP_ID;
  const accessToken = process.env.SHOPEE_ACCESS_TOKEN;
  const refreshToken = process.env.SHOPEE_REFRESH_TOKEN;

  if (!partnerId) throw new Error("SHOPEE_PARTNER_ID is required");
  if (!partnerKey) throw new Error("SHOPEE_PARTNER_KEY is required");
  if (!shopId) throw new Error("SHOPEE_SHOP_ID is required");
  if (!accessToken) throw new Error("SHOPEE_ACCESS_TOKEN is required");
  if (!refreshToken) throw new Error("SHOPEE_REFRESH_TOKEN is required");

  return {
    partnerId: Number(partnerId),
    partnerKey,
    shopId: Number(shopId),
    accessToken,
    refreshToken,
  };
}

// ─── TOOL WRAPPER WITH HOOKS ────────────────────────────────

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: ShopeeConfig,
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
const shopee = new ShopeeClient(config);

const server = new McpServer(
  { name: "bridgeapi-shopee", version: "0.1.0" },
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

// ─── 1. PRODUCT: list_products ──────────────────────────────

server.tool(
  "list_products",
  "Lista os produtos da loja na Shopee. Retorna IDs, status, e paginacao. Utilize get_product para detalhes completos.",
  {
    offset: z.number().optional().default(0).describe("Offset de paginacao (default: 0)"),
    page_size: z
      .number()
      .optional()
      .default(20)
      .describe("Itens por pagina (default: 20, max: 100)"),
    item_status: z
      .string()
      .optional()
      .default("NORMAL")
      .describe("Status do item: NORMAL, BANNED, DELETED, UNLIST"),
  },
  async ({ offset, page_size, item_status }) =>
    executeWithHooks("list_products", { offset, page_size, item_status }, config, () =>
      shopee.listProducts({ offset, page_size, item_status })
    )
);

// ─── 2. PRODUCT: get_product ────────────────────────────────

server.tool(
  "get_product",
  "Obtem informacoes detalhadas de um ou mais produtos Shopee pelo item_id. Retorna titulo, preco, estoque, imagens, atributos.",
  {
    item_ids: z
      .array(z.number())
      .describe("Lista de item_ids (max 50). Ex: [1001, 1002]"),
  },
  async ({ item_ids }) =>
    executeWithHooks("get_product", { item_ids }, config, () =>
      shopee.getProduct(item_ids)
    )
);

// ─── 3. PRODUCT: add_product ────────────────────────────────

server.tool(
  "add_product",
  "Cria um novo produto na Shopee. Requer original_price, description, item_name, category_id, images, logistics, e stock_info.",
  {
    product: z
      .record(z.string(), z.unknown())
      .describe(
        "Dados completos do produto conforme Shopee Add Item API (item_name, description, original_price, category_id, image.image_id_list, logistic_info, stock_info, etc.)"
      ),
  },
  async ({ product }) =>
    executeWithHooks("add_product", { product }, config, () =>
      shopee.addProduct(product)
    )
);

// ─── 4. PRODUCT: update_product ─────────────────────────────

server.tool(
  "update_product",
  "Atualiza campos de um produto existente na Shopee (titulo, descricao, imagens, etc). Nao inclui preco e estoque (use tools dedicadas).",
  {
    item_id: z.number().describe("ID do produto a atualizar"),
    updates: z
      .record(z.string(), z.unknown())
      .describe("Campos para atualizar (item_name, description, image, attribute_list, etc.)"),
  },
  async ({ item_id, updates }) =>
    executeWithHooks("update_product", { item_id, updates }, config, () =>
      shopee.updateProduct(item_id, updates)
    )
);

// ─── 5. PRODUCT: update_stock ───────────────────────────────

server.tool(
  "update_stock",
  "Atualiza o estoque de um produto na Shopee. Permite atualizar modelos individuais (variacoes) ou o item principal.",
  {
    item_id: z.number().describe("ID do produto"),
    stock_list: z
      .array(
        z.object({
          model_id: z.number().optional().describe("ID do modelo/variacao (omitir para item sem variacao)"),
          normal_stock: z.number().describe("Novo estoque"),
        })
      )
      .describe("Lista de estoques a atualizar"),
  },
  async ({ item_id, stock_list }) =>
    executeWithHooks("update_stock", { item_id, stock_list }, config, () =>
      shopee.updateStock(item_id, stock_list)
    )
);

// ─── 6. PRODUCT: update_price ───────────────────────────────

server.tool(
  "update_price",
  "Atualiza o preco de um produto na Shopee. Permite atualizar modelos individuais (variacoes) ou o item principal.",
  {
    item_id: z.number().describe("ID do produto"),
    price_list: z
      .array(
        z.object({
          model_id: z.number().optional().describe("ID do modelo/variacao"),
          original_price: z.number().describe("Novo preco original"),
        })
      )
      .describe("Lista de precos a atualizar"),
  },
  async ({ item_id, price_list }) =>
    executeWithHooks("update_price", { item_id, price_list }, config, () =>
      shopee.updatePrice(item_id, price_list)
    )
);

// ─── 7. ORDER: get_orders ───────────────────────────────────

server.tool(
  "get_orders",
  "Lista pedidos da loja Shopee com filtros de periodo e status. Retorna order_sn para consulta detalhada.",
  {
    time_range_field: z
      .string()
      .optional()
      .default("create_time")
      .describe("Campo de data: create_time ou update_time"),
    time_from: z
      .number()
      .optional()
      .describe("Timestamp Unix de inicio (segundos). Exemplo: 1711065600"),
    time_to: z
      .number()
      .optional()
      .describe("Timestamp Unix de fim (segundos)"),
    page_size: z
      .number()
      .optional()
      .default(20)
      .describe("Pedidos por pagina (default: 20, max: 100)"),
    cursor: z
      .string()
      .optional()
      .describe("Cursor de paginacao da resposta anterior"),
    order_status: z
      .string()
      .optional()
      .describe("Status: UNPAID, READY_TO_SHIP, PROCESSED, SHIPPED, COMPLETED, IN_CANCEL, CANCELLED"),
  },
  async ({ time_range_field, time_from, time_to, page_size, cursor, order_status }) =>
    executeWithHooks(
      "get_orders",
      { time_range_field, time_from, time_to, page_size, cursor, order_status },
      config,
      () =>
        shopee.getOrders({
          time_range_field,
          time_from,
          time_to,
          page_size,
          cursor,
          order_status,
        })
    )
);

// ─── 8. ORDER: get_order ────────────────────────────────────

server.tool(
  "get_order",
  "Obtem detalhes completos de um ou mais pedidos Shopee (comprador, itens, valor, endereco, frete).",
  {
    order_sn_list: z
      .array(z.string())
      .describe("Lista de order_sn (max 50). Ex: ['2203221ABC123']"),
  },
  async ({ order_sn_list }) =>
    executeWithHooks("get_order", { order_sn_list }, config, () =>
      shopee.getOrder(order_sn_list)
    )
);

// ─── 9. SHIPPING: get_shipping_parameter ────────────────────

server.tool(
  "get_shipping_parameter",
  "Obtem os parametros de envio necessarios antes de despachar um pedido. Use antes de ship_order.",
  {
    order_sn: z.string().describe("Numero do pedido (order_sn)"),
  },
  async ({ order_sn }) =>
    executeWithHooks("get_shipping_parameter", { order_sn }, config, () =>
      shopee.getShippingParameter(order_sn)
    )
);

// ─── 10. SHIPPING: ship_order ───────────────────────────────

server.tool(
  "ship_order",
  "Despacha um pedido na Shopee. Requer os parametros obtidos via get_shipping_parameter (pickup, dropoff, etc.).",
  {
    order_sn: z.string().describe("Numero do pedido (order_sn)"),
    shipping_params: z
      .record(z.string(), z.unknown())
      .describe("Parametros de envio (pickup, dropoff, non_integrated)"),
  },
  async ({ order_sn, shipping_params }) =>
    executeWithHooks("ship_order", { order_sn, shipping_params }, config, () =>
      shopee.shipOrder(order_sn, shipping_params)
    )
);

// ─── 11. SHIPPING: get_logistics ────────────────────────────

server.tool(
  "get_logistics",
  "Lista os canais logisticos disponiveis para a loja Shopee (transportadoras, modalidades).",
  {},
  async () =>
    executeWithHooks("get_logistics", {}, config, () => shopee.getLogistics())
);

// ─── 12. CATEGORY: get_categories ───────────────────────────

server.tool(
  "get_categories",
  "Lista a arvore de categorias da Shopee. Essencial para encontrar o category_id ao criar produtos.",
  {
    language: z
      .string()
      .optional()
      .default("pt")
      .describe("Idioma: pt, en, es, id, etc. (default: pt)"),
  },
  async ({ language }) =>
    executeWithHooks("get_categories", { language }, config, () =>
      shopee.getCategories(language)
    )
);

// ─── 13. CATEGORY: get_category_attributes ──────────────────

server.tool(
  "get_category_attributes",
  "Lista atributos obrigatorios e opcionais de uma categoria. Indispensavel antes de criar produtos.",
  {
    category_id: z.number().describe("ID da categoria"),
    language: z
      .string()
      .optional()
      .default("pt")
      .describe("Idioma dos nomes de atributos"),
  },
  async ({ category_id, language }) =>
    executeWithHooks("get_category_attributes", { category_id, language }, config, () =>
      shopee.getCategoryAttributes(category_id, language)
    )
);

// ─── 14. SHOP: get_shop_info ────────────────────────────────

server.tool(
  "get_shop_info",
  "Obtem informacoes do perfil da loja Shopee (nome, descricao, logo, avaliacao, etc.).",
  {},
  async () =>
    executeWithHooks("get_shop_info", {}, config, () => shopee.getShopInfo())
);

// ─── 15. SHOP: get_shop_performance ─────────────────────────

server.tool(
  "get_shop_performance",
  "Obtem metricas de performance da loja (penalidades, taxa de cancelamento, atrasos de envio, violacoes).",
  {},
  async () =>
    executeWithHooks("get_shop_performance", {}, config, () =>
      shopee.getShopPerformance()
    )
);

// ─── 16. RETURN: get_return_orders ──────────────────────────

server.tool(
  "get_return_orders",
  "Lista pedidos de devolucao/reembolso da loja. Filtre por periodo de criacao.",
  {
    page_no: z.number().optional().default(1).describe("Pagina (default: 1)"),
    page_size: z
      .number()
      .optional()
      .default(20)
      .describe("Itens por pagina (default: 20)"),
    create_time_from: z
      .number()
      .optional()
      .describe("Timestamp Unix de inicio (segundos)"),
    create_time_to: z
      .number()
      .optional()
      .describe("Timestamp Unix de fim (segundos)"),
  },
  async ({ page_no, page_size, create_time_from, create_time_to }) =>
    executeWithHooks(
      "get_return_orders",
      { page_no, page_size, create_time_from, create_time_to },
      config,
      () =>
        shopee.getReturnOrders({
          page_no,
          page_size,
          create_time_from,
          create_time_to,
        })
    )
);

// ─── 17. RETURN: confirm_return ─────────────────────────────

server.tool(
  "confirm_return",
  "Aceita ou rejeita uma solicitacao de devolucao na Shopee.",
  {
    return_sn: z.string().describe("Numero da devolucao (return_sn)"),
    decision: z
      .enum(["ACCEPT", "REJECT"])
      .describe("Decisao: ACCEPT ou REJECT"),
  },
  async ({ return_sn, decision }) =>
    executeWithHooks("confirm_return", { return_sn, decision }, config, () =>
      shopee.confirmReturn(return_sn, decision)
    )
);

// ─── 18. CHAT: get_conversations ────────────────────────────

server.tool(
  "get_conversations",
  "Lista as conversas de chat com compradores na Shopee. Retorna conversation_id para enviar mensagens.",
  {
    direction: z
      .string()
      .optional()
      .default("latest")
      .describe("Ordenacao: latest ou oldest"),
    type: z
      .string()
      .optional()
      .default("all")
      .describe("Tipo: all, pinned, unread"),
    page_size: z
      .number()
      .optional()
      .default(20)
      .describe("Conversas por pagina"),
    offset: z.number().optional().describe("Offset de paginacao"),
  },
  async ({ direction, type, page_size, offset }) =>
    executeWithHooks(
      "get_conversations",
      { direction, type, page_size, offset },
      config,
      () => shopee.getConversations({ direction, type, page_size, offset })
    )
);

// ─── 19. CHAT: send_message ─────────────────────────────────

server.tool(
  "send_message",
  "Envia uma mensagem de texto para um comprador na Shopee via chat.",
  {
    conversation_id: z.string().describe("ID da conversa (to_id)"),
    content: z.string().describe("Texto da mensagem a enviar"),
  },
  async ({ conversation_id, content }) =>
    executeWithHooks(
      "send_message",
      { conversation_id, content },
      config,
      () => shopee.sendMessage(conversation_id, content)
    )
);

// ─── 20. PAYMENT: get_payment_info ──────────────────────────

server.tool(
  "get_payment_info",
  "Obtem detalhes de pagamento/escrow de um pedido Shopee (valores, taxas, repasse).",
  {
    order_sn: z.string().describe("Numero do pedido (order_sn)"),
  },
  async ({ order_sn }) =>
    executeWithHooks("get_payment_info", { order_sn }, config, () =>
      shopee.getPaymentInfo(order_sn)
    )
);

// ═══════════════════════════════════════════════════════════════
// RESOURCES (read-only context for agents)
// ═══════════════════════════════════════════════════════════════

server.resource("products", "shopee://products", async () => {
  const result = await shopee.listProducts({ page_size: 50, item_status: "NORMAL" });
  return {
    contents: [
      {
        uri: "shopee://products",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("orders", "shopee://orders", async () => {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
  const result = await shopee.getOrders({
    time_from: thirtyDaysAgo,
    time_to: now,
    page_size: 50,
  });
  return {
    contents: [
      {
        uri: "shopee://orders",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("shop", "shopee://shop", async () => {
  const result = await shopee.getShopInfo();
  return {
    contents: [
      {
        uri: "shopee://shop",
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
  "otimizador-anuncios",
  "Guia completo para criar e otimizar anuncios na Shopee — titulo, descricao, imagens, preco e atributos",
  {
    product_name: z.string().describe("Nome do produto a ser anunciado"),
    category: z.string().optional().describe("Categoria sugerida (opcional)"),
  },
  ({ product_name, category }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso criar ou otimizar um anuncio na Shopee para: "${product_name}"${category ? ` na categoria "${category}"` : ""}.

Passos:
1. Use get_categories para encontrar a categoria ideal (se nao fornecida).
2. Use get_category_attributes para saber os atributos obrigatorios.
3. Use list_products para ver se ja existe um anuncio similar na loja.
4. Use add_product para criar o anuncio OU update_product para otimizar um existente.
5. Use update_price e update_stock para ajustar preco e estoque.

BOAS PRATICAS PARA ANUNCIOS NA SHOPEE:
- TITULO: Inclua marca + modelo + caracteristica + diferencial. Max 120 chars.
  Exemplo: "Fone Bluetooth JBL Tune 510BT Original Lacrado Com Nota Fiscal"
- PRECO: Pesquise concorrentes. Shopee favorece precos competitivos no ranking.
- IMAGENS: Minimo 3 fotos. Primeira foto com fundo branco. Resolucao minima 500x500.
- DESCRICAO: Organize com topicos. Inclua especificacoes, garantia, prazo de envio.
- ATRIBUTOS: Preencha TODOS os atributos obrigatorios da categoria.
- VARIACOES: Use modelos para cor/tamanho — melhora a experiencia do comprador.
- FRETE GRATIS: Anuncios com frete gratis tem 3-5x mais conversao na Shopee.
- SHOPEE ADS: Considere investir em anuncios pagos para novos produtos.

ERROS COMUNS:
- Titulo com caracteres especiais ou emojis (Shopee pode rejeitar).
- Imagens com marca d'agua ou texto excessivo.
- Estoque zerado (produto sai do ar automaticamente).
- Nao preencher atributos obrigatorios (listagem rejeitada).`,
        },
      },
    ],
  })
);

server.prompt(
  "processador-envios",
  "Guia para processar envios e gerenciar pedidos na Shopee — despacho, rastreio, logistica e devolucoes",
  {
    order_status: z
      .string()
      .optional()
      .describe("Status do pedido: READY_TO_SHIP, SHIPPED, COMPLETED"),
    issue: z
      .string()
      .optional()
      .describe("Problema especifico: atraso, extravio, devolucao"),
  },
  ({ order_status, issue }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso processar envios na Shopee${order_status ? ` com status "${order_status}"` : ""}${issue ? `. Problema: ${issue}` : ""}.

Passos:
1. Use get_orders para listar pedidos${order_status ? ` com status "${order_status}"` : " pendentes (READY_TO_SHIP)"}.
2. Use get_order para ver detalhes (comprador, itens, endereco).
3. Use get_shipping_parameter para obter parametros de envio.
4. Use ship_order para despachar o pedido.
5. Use get_logistics para ver transportadoras disponiveis.

FLUXO DE PEDIDOS NA SHOPEE:
- UNPAID -> Aguardando pagamento.
- READY_TO_SHIP -> Pago! Prepare e despache em ate 2 dias.
- PROCESSED -> Em processamento pela transportadora.
- SHIPPED -> A caminho do comprador. Acompanhe rastreio.
- COMPLETED -> Entregue e confirmado. Pagamento liberado.
- IN_CANCEL -> Cancelamento em andamento.

PROBLEMAS COMUNS:
- **Atraso no envio**: Shopee penaliza atrasos. Despache em ate 48h.
- **Pedido nao pode ser despachado**: Verifique get_shipping_parameter para entender as opcoes.
- **Devolucao**: Use get_return_orders para listar. Use confirm_return para responder.
- **Extravio**: Oriente o comprador a solicitar reembolso pela plataforma.

METRICAS DE PERFORMANCE:
- Use get_shop_performance para monitorar penalidades.
- Taxa de atraso acima de 5% pode resultar em suspensao.
- Mantenha taxa de cancelamento abaixo de 2%.`,
        },
      },
    ],
  })
);

server.prompt(
  "atendente-chat",
  "Guia para atender compradores via chat na Shopee — respostas rapidas, templates e boas praticas",
  {
    context: z
      .string()
      .optional()
      .describe("Contexto: tipo de produto, politica da loja, etc."),
  },
  ({ context }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso atender compradores no chat da Shopee${context ? `. Contexto: ${context}` : ""}.

Passos:
1. Use get_conversations para listar conversas pendentes/nao lidas.
2. Use get_order para obter detalhes do pedido do comprador (se aplicavel).
3. Use send_message para responder ao comprador.
4. Use get_payment_info se houver duvidas sobre pagamento.

BOAS PRATICAS DE ATENDIMENTO SHOPEE:
- Responda em ate 12 horas. Taxa de resposta impacta ranking da loja.
- Seja cordial: "Ola! Obrigado por entrar em contato."
- Responda diretamente a pergunta. Seja objetivo.
- NUNCA compartilhe dados pessoais (telefone, email, CPF).
- NUNCA direcione para compra fora da Shopee.

TEMPLATES DE RESPOSTA:
- **Disponibilidade**: "Ola! Sim, temos esse produto em estoque. Pode comprar com seguranca!"
- **Prazo de envio**: "Ola! Apos a confirmacao do pagamento, enviamos em ate 2 dias uteis."
- **Rastreamento**: "Ola! Seu pedido ja foi enviado. O codigo de rastreio sera atualizado automaticamente."
- **Devolucao**: "Ola! Voce pode solicitar a devolucao diretamente pelo app da Shopee em Meus Pedidos."
- **Desconto**: "Ola! O preco atual ja esta com nosso melhor desconto. Fique de olho nas promocoes da Shopee!"
- **Nota fiscal**: "Ola! Sim, emitimos nota fiscal. Ela sera enviada junto com o produto."

SITUACOES CRITICAS:
- Reclamacao de produto com defeito: Oriente a abrir devolucao pela plataforma.
- Pedido atrasado: Verifique rastreio com get_order. Informe prazo atualizado.
- Comprador agressivo: Mantenha profissionalismo. Evite discussoes.`,
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
  console.error("BridgeAPI Shopee MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
