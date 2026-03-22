#!/usr/bin/env node
/**
 * @bridgeapi/mcp-nuvemshop — MCP Server for Nuvemshop API
 *
 * Connect any AI Agent to Nuvemshop via the Model Context Protocol.
 * Part of the BridgeAPI ecosystem: https://bridgeapi.com.br
 *
 * Phase 1: passthrough with structured logging (hooks are no-ops)
 * Phase 2: Execution Engine plugs into pre/post hooks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  NuvemshopClient,
  preExecuteHook,
  postExecuteHook,
  type NuvemshopConfig,
  type HookContext,
  type ApiResponse,
} from "./nuvemshop-client.js";

// ─── CONFIG ──────────────────────────────────────────────────

function loadConfig(): NuvemshopConfig {
  const accessToken = process.env.NUVEMSHOP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("NUVEMSHOP_ACCESS_TOKEN is required");

  const userId = process.env.NUVEMSHOP_USER_ID;
  if (!userId) throw new Error("NUVEMSHOP_USER_ID is required");

  return { accessToken, userId };
}

// ─── TOOL WRAPPER WITH HOOKS ─────────────────────────────────
// Every tool call goes through this wrapper.
// Phase 1: hooks are no-ops that log.
// Phase 2: hooks evaluate confidence and may block/escalate.

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: NuvemshopConfig,
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
const nuvemshop = new NuvemshopClient(config);

const server = new McpServer(
  {
    name: "bridgeapi-nuvemshop",
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
// TOOLS (22 total)
// ═══════════════════════════════════════════════════════════════

// ─── PRODUCT TOOLS (5) ──────────────────────────────────────

server.tool(
  "get_products",
  "Listar produtos da loja Nuvemshop. Filtre por data de criacao, publicacao, frete gratis. Retorna lista paginada de produtos com nome, preco, estoque e variantes.",
  {
    page: z.number().optional().describe("Numero da pagina (default: 1)"),
    per_page: z.number().optional().describe("Itens por pagina (default: 30, max: 200)"),
    since_id: z.number().optional().describe("Retornar apenas produtos com ID maior que este"),
    created_at_min: z.string().optional().describe("Data minima de criacao (ISO 8601, ex: 2026-01-01T00:00:00-03:00)"),
    created_at_max: z.string().optional().describe("Data maxima de criacao (ISO 8601)"),
    updated_at_min: z.string().optional().describe("Data minima de atualizacao (ISO 8601)"),
    updated_at_max: z.string().optional().describe("Data maxima de atualizacao (ISO 8601)"),
    published: z.boolean().optional().describe("Filtrar por publicado (true) ou rascunho (false)"),
    free_shipping: z.boolean().optional().describe("Filtrar por frete gratis"),
  },
  async (params) =>
    executeWithHooks("get_products", params as Record<string, unknown>, config, () =>
      nuvemshop.getProducts(params)
    )
);

server.tool(
  "get_product",
  "Obter detalhes de um produto especifico pelo ID. Retorna nome, descricao, precos, variantes, imagens, categorias e estoque.",
  {
    product_id: z.number().describe("ID do produto na Nuvemshop"),
  },
  async ({ product_id }) =>
    executeWithHooks("get_product", { product_id }, config, () =>
      nuvemshop.getProduct(product_id)
    )
);

server.tool(
  "create_product",
  "Criar um novo produto na Nuvemshop. Envie nome, descricao, preco, variantes, imagens e categorias.",
  {
    data: z.record(z.string(), z.unknown()).describe("Dados do produto. Campos principais: name (objeto i18n, ex: {pt: 'Nome'}), description (objeto i18n), variants (array com price, stock), images (array com src)"),
  },
  async ({ data }) =>
    executeWithHooks("create_product", { data }, config, () =>
      nuvemshop.createProduct(data)
    )
);

server.tool(
  "update_product",
  "Atualizar um produto existente. Envie apenas os campos que deseja alterar: nome, descricao, preco, estoque, status de publicacao.",
  {
    product_id: z.number().describe("ID do produto a atualizar"),
    data: z.record(z.string(), z.unknown()).describe("Campos a atualizar (ex: {name: {pt: 'Novo Nome'}, published: true})"),
  },
  async ({ product_id, data }) =>
    executeWithHooks("update_product", { product_id, data }, config, () =>
      nuvemshop.updateProduct(product_id, data)
    )
);

server.tool(
  "delete_product",
  "Excluir permanentemente um produto da Nuvemshop. ATENCAO: esta acao nao pode ser desfeita. Remove o produto, variantes e imagens.",
  {
    product_id: z.number().describe("ID do produto a excluir"),
  },
  async ({ product_id }) =>
    executeWithHooks("delete_product", { product_id }, config, () =>
      nuvemshop.deleteProduct(product_id)
    )
);

// ─── PRODUCT VARIANT TOOLS (2) ──────────────────────────────

server.tool(
  "get_product_variants",
  "Listar todas as variantes de um produto. Retorna SKU, preco, estoque, peso e dimensoes de cada variante.",
  {
    product_id: z.number().describe("ID do produto para listar variantes"),
  },
  async ({ product_id }) =>
    executeWithHooks("get_product_variants", { product_id }, config, () =>
      nuvemshop.getProductVariants(product_id)
    )
);

server.tool(
  "create_product_variant",
  "Criar uma nova variante para um produto. Defina preco, estoque, SKU e valores de atributos (ex: cor, tamanho).",
  {
    product_id: z.number().describe("ID do produto pai"),
    data: z.record(z.string(), z.unknown()).describe("Dados da variante: price, stock_management, stock, sku, values (array de atributos), weight, width, height, depth"),
  },
  async ({ product_id, data }) =>
    executeWithHooks("create_product_variant", { product_id, data }, config, () =>
      nuvemshop.createProductVariant(product_id, data)
    )
);

// ─── ORDER TOOLS (5) ────────────────────────────────────────

server.tool(
  "get_orders",
  "Listar pedidos da loja. Filtre por status, data, status de pagamento ou envio. Retorna lista paginada com detalhes de cada pedido.",
  {
    page: z.number().optional().describe("Numero da pagina"),
    per_page: z.number().optional().describe("Itens por pagina (max: 200)"),
    since_id: z.number().optional().describe("Retornar apenas pedidos com ID maior que este"),
    status: z.string().optional().describe("Status do pedido: open, closed, cancelled"),
    created_at_min: z.string().optional().describe("Data minima de criacao (ISO 8601)"),
    created_at_max: z.string().optional().describe("Data maxima de criacao (ISO 8601)"),
    updated_at_min: z.string().optional().describe("Data minima de atualizacao (ISO 8601)"),
    updated_at_max: z.string().optional().describe("Data maxima de atualizacao (ISO 8601)"),
    payment_status: z.string().optional().describe("Status de pagamento: pending, authorized, paid, voided, refunded"),
    shipping_status: z.string().optional().describe("Status de envio: unpacked, shipped, unshipped, delivered"),
    q: z.string().optional().describe("Busca textual por nome do cliente, email ou numero do pedido"),
  },
  async (params) =>
    executeWithHooks("get_orders", params as Record<string, unknown>, config, () =>
      nuvemshop.getOrders(params)
    )
);

server.tool(
  "get_order",
  "Obter detalhes completos de um pedido especifico. Retorna itens, cliente, enderecos, pagamento, envio e notas.",
  {
    order_id: z.number().describe("ID do pedido na Nuvemshop"),
  },
  async ({ order_id }) =>
    executeWithHooks("get_order", { order_id }, config, () =>
      nuvemshop.getOrder(order_id)
    )
);

server.tool(
  "update_order",
  "Atualizar informacoes de um pedido. Permite alterar nota do lojista, status de envio, codigo de rastreio, etc.",
  {
    order_id: z.number().describe("ID do pedido a atualizar"),
    data: z.record(z.string(), z.unknown()).describe("Campos a atualizar (ex: {owner_note: 'Nota interna', shipping_tracking_number: 'BR123456789'})"),
  },
  async ({ order_id, data }) =>
    executeWithHooks("update_order", { order_id, data }, config, () =>
      nuvemshop.updateOrder(order_id, data)
    )
);

server.tool(
  "close_order",
  "Fechar (arquivar) um pedido. Use apos o pedido ser entregue e finalizado. Muda o status para 'closed'.",
  {
    order_id: z.number().describe("ID do pedido a fechar"),
  },
  async ({ order_id }) =>
    executeWithHooks("close_order", { order_id }, config, () =>
      nuvemshop.closeOrder(order_id)
    )
);

server.tool(
  "cancel_order",
  "Cancelar um pedido. ATENCAO: esta acao pode ser irreversivel. Opcionalmente informe o motivo do cancelamento e se deve reestocar os itens.",
  {
    order_id: z.number().describe("ID do pedido a cancelar"),
    data: z.record(z.string(), z.unknown()).optional().describe("Dados opcionais: {reason: 'motivo', restock: true} para reestocar itens automaticamente"),
  },
  async ({ order_id, data }) =>
    executeWithHooks("cancel_order", { order_id, data }, config, () =>
      nuvemshop.cancelOrder(order_id, data)
    )
);

// ─── CUSTOMER TOOLS (3) ─────────────────────────────────────

server.tool(
  "get_customers",
  "Listar clientes da loja. Filtre por data de criacao ou busque por nome/email. Retorna lista paginada com dados de contato e historico.",
  {
    page: z.number().optional().describe("Numero da pagina"),
    per_page: z.number().optional().describe("Itens por pagina (max: 200)"),
    since_id: z.number().optional().describe("Retornar apenas clientes com ID maior que este"),
    created_at_min: z.string().optional().describe("Data minima de criacao (ISO 8601)"),
    created_at_max: z.string().optional().describe("Data maxima de criacao (ISO 8601)"),
    updated_at_min: z.string().optional().describe("Data minima de atualizacao (ISO 8601)"),
    updated_at_max: z.string().optional().describe("Data maxima de atualizacao (ISO 8601)"),
    q: z.string().optional().describe("Busca por nome, email ou telefone do cliente"),
  },
  async (params) =>
    executeWithHooks("get_customers", params as Record<string, unknown>, config, () =>
      nuvemshop.getCustomers(params)
    )
);

server.tool(
  "get_customer",
  "Obter detalhes de um cliente especifico. Retorna nome, email, telefone, enderecos, total de pedidos e valor total gasto.",
  {
    customer_id: z.number().describe("ID do cliente na Nuvemshop"),
  },
  async ({ customer_id }) =>
    executeWithHooks("get_customer", { customer_id }, config, () =>
      nuvemshop.getCustomer(customer_id)
    )
);

server.tool(
  "create_customer",
  "Criar um novo cliente na Nuvemshop. Informe nome, email, telefone e opcionalmente enderecos.",
  {
    data: z.record(z.string(), z.unknown()).describe("Dados do cliente: name, email, phone, identification (CPF/CNPJ), addresses (array)"),
  },
  async ({ data }) =>
    executeWithHooks("create_customer", { data }, config, () =>
      nuvemshop.createCustomer(data)
    )
);

// ─── CATEGORY TOOLS (2) ─────────────────────────────────────

server.tool(
  "get_categories",
  "Listar categorias de produtos da loja. Retorna arvore de categorias com nome, descricao, subcategorias e contagem de produtos.",
  {
    page: z.number().optional().describe("Numero da pagina"),
    per_page: z.number().optional().describe("Itens por pagina (max: 200)"),
    since_id: z.number().optional().describe("Retornar apenas categorias com ID maior que este"),
    created_at_min: z.string().optional().describe("Data minima de criacao (ISO 8601)"),
    created_at_max: z.string().optional().describe("Data maxima de criacao (ISO 8601)"),
    updated_at_min: z.string().optional().describe("Data minima de atualizacao (ISO 8601)"),
    updated_at_max: z.string().optional().describe("Data maxima de atualizacao (ISO 8601)"),
  },
  async (params) =>
    executeWithHooks("get_categories", params as Record<string, unknown>, config, () =>
      nuvemshop.getCategories(params)
    )
);

server.tool(
  "create_category",
  "Criar uma nova categoria de produtos. Defina nome (multi-idioma), descricao e categoria pai para subcategorias.",
  {
    data: z.record(z.string(), z.unknown()).describe("Dados da categoria: name (objeto i18n, ex: {pt: 'Roupas'}), description (objeto i18n), parent (ID da categoria pai para subcategoria)"),
  },
  async ({ data }) =>
    executeWithHooks("create_category", { data }, config, () =>
      nuvemshop.createCategory(data)
    )
);

// ─── COUPON TOOLS (3) ───────────────────────────────────────

server.tool(
  "get_coupons",
  "Listar cupons de desconto da loja. Retorna codigo, tipo de desconto, valor, validade e limites de uso.",
  {
    page: z.number().optional().describe("Numero da pagina"),
    per_page: z.number().optional().describe("Itens por pagina (max: 200)"),
    since_id: z.number().optional().describe("Retornar apenas cupons com ID maior que este"),
    created_at_min: z.string().optional().describe("Data minima de criacao (ISO 8601)"),
    created_at_max: z.string().optional().describe("Data maxima de criacao (ISO 8601)"),
  },
  async (params) =>
    executeWithHooks("get_coupons", params as Record<string, unknown>, config, () =>
      nuvemshop.getCoupons(params)
    )
);

server.tool(
  "create_coupon",
  "Criar um novo cupom de desconto. Defina codigo, tipo (percentual ou fixo), valor, datas de validade, limite de uso e categorias/produtos aplicaveis.",
  {
    data: z.record(z.string(), z.unknown()).describe("Dados do cupom: code (string unica), type ('percentage' ou 'absolute'), value (numero), start_date, end_date, min_price, max_uses, includes/excludes (categorias/produtos)"),
  },
  async ({ data }) =>
    executeWithHooks("create_coupon", { data }, config, () =>
      nuvemshop.createCoupon(data)
    )
);

server.tool(
  "delete_coupon",
  "Excluir um cupom de desconto permanentemente. ATENCAO: esta acao nao pode ser desfeita.",
  {
    coupon_id: z.number().describe("ID do cupom a excluir"),
  },
  async ({ coupon_id }) =>
    executeWithHooks("delete_coupon", { coupon_id }, config, () =>
      nuvemshop.deleteCoupon(coupon_id)
    )
);

// ─── STORE TOOLS (2) ────────────────────────────────────────

server.tool(
  "get_store",
  "Obter informacoes da loja Nuvemshop. Retorna nome, dominio, email, telefone, endereco, moeda, idiomas, plano e configuracoes gerais.",
  {},
  async () =>
    executeWithHooks("get_store", {}, config, () =>
      nuvemshop.getStore()
    )
);

server.tool(
  "update_store",
  "Atualizar informacoes da loja. Permite alterar nome, descricao, email de contato, telefone, endereco e configuracoes.",
  {
    data: z.record(z.string(), z.unknown()).describe("Campos a atualizar: name (objeto i18n), description (objeto i18n), email, phone, address, business_name, etc."),
  },
  async ({ data }) =>
    executeWithHooks("update_store", { data }, config, () =>
      nuvemshop.updateStore(data)
    )
);

// ═══════════════════════════════════════════════════════════════
// RESOURCES (read-only context for agents)
// ═══════════════════════════════════════════════════════════════

server.resource("products", "nuvemshop://products", async () => {
  const result = await nuvemshop.getProducts({ per_page: 50 });
  return {
    contents: [
      {
        uri: "nuvemshop://products",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("orders", "nuvemshop://orders", async () => {
  const result = await nuvemshop.getOrders({ per_page: 50 });
  return {
    contents: [
      {
        uri: "nuvemshop://orders",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("store", "nuvemshop://store", async () => {
  const result = await nuvemshop.getStore();
  return {
    contents: [
      {
        uri: "nuvemshop://store",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

// ═══════════════════════════════════════════════════════════════
// PROMPTS (reusable templates for common tasks — PT-BR)
// ═══════════════════════════════════════════════════════════════

server.prompt(
  "gerenciador-produtos",
  "Guia completo para gerenciar produtos na Nuvemshop — criar, editar, organizar variantes e categorias",
  {
    action: z
      .string()
      .describe(
        "Acao desejada: criar, editar, listar, excluir, criar_variante, organizar_categorias"
      ),
    product_info: z
      .string()
      .optional()
      .describe(
        "Nome ou ID do produto (se aplicavel)"
      ),
  },
  ({ action, product_info }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso gerenciar produtos na Nuvemshop. Acao: "${action}"${product_info ? `. Produto: ${product_info}` : ""}.

Passos:
1. Se preciso encontrar um produto, use get_products com filtros ou busque por ID com get_product.
2. Execute a acao solicitada:
   - **criar**: use create_product com name (objeto i18n: {pt: 'Nome'}), description, variants (com price e stock) e images (com src).
   - **editar**: use get_product para ver dados atuais, depois update_product apenas com campos alterados.
   - **listar**: use get_products com paginacao (per_page ate 200).
   - **excluir**: use delete_product (IRREVERSIVEL — confirme com o usuario antes!).
   - **criar_variante**: use get_product_variants para ver existentes, depois create_product_variant com price, stock, sku e values.
   - **organizar_categorias**: use get_categories para ver arvore atual, depois create_category ou atualize produtos.

DICAS NUVEMSHOP:
- Nomes e descricoes sao objetos multi-idioma: {pt: 'Portugues', es: 'Espanol', en: 'English'}.
- Variantes definem combinacoes de atributos (Cor, Tamanho). Cada variante tem seu proprio preco e estoque.
- Imagens: envie URLs publicas no campo src. A Nuvemshop faz upload automatico.
- Categorias podem ser aninhadas (subcategorias) usando o campo parent.
- published: false cria o produto como rascunho (nao visivel na loja).`,
        },
      },
    ],
  })
);

server.prompt(
  "processador-pedidos",
  "Guia para processar e gerenciar pedidos na Nuvemshop — consultar, atualizar, fechar e cancelar",
  {
    action: z
      .string()
      .describe(
        "Acao desejada: consultar, atualizar_rastreio, fechar, cancelar, listar_pendentes"
      ),
    order_info: z
      .string()
      .optional()
      .describe(
        "Numero ou ID do pedido (se aplicavel)"
      ),
  },
  ({ action, order_info }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso gerenciar pedidos na Nuvemshop. Acao: "${action}"${order_info ? `. Pedido: ${order_info}` : ""}.

Passos:
1. Use get_orders com filtros para localizar pedidos ou get_order com o ID para detalhes completos.
2. Execute a acao solicitada:
   - **consultar**: use get_order para ver itens, cliente, pagamento e envio.
   - **atualizar_rastreio**: use update_order com {shipping_tracking_number: 'CODIGO', shipping_tracking_url: 'URL'}.
   - **fechar**: use close_order para arquivar pedidos entregues (status -> closed).
   - **cancelar**: use cancel_order com motivo e opcao de reestoque. CONFIRME COM O USUARIO ANTES!
   - **listar_pendentes**: use get_orders com status=open e payment_status=pending.

FILTROS UTEIS:
- status: open (abertos), closed (fechados), cancelled (cancelados).
- payment_status: pending, authorized, paid, voided, refunded.
- shipping_status: unpacked (nao embalado), shipped (enviado), unshipped (nao enviado), delivered (entregue).
- q: busca por nome do cliente, email ou numero do pedido.

FLUXO TIPICO DE PEDIDO:
1. Pedido criado (open + pending) -> Pagamento aprovado (paid) -> Embalado (unpacked->shipped) -> Entregue (delivered) -> Fechado (closed).

IMPORTANTE:
- Cancelar pedidos pagos pode exigir reembolso manual no gateway de pagamento.
- Sempre confirme cancelamentos com o usuario antes de executar.`,
        },
      },
    ],
  })
);

server.prompt(
  "otimizador-loja",
  "Guia para otimizar e configurar a loja Nuvemshop — dados da loja, cupons e estrategias de venda",
  {
    focus: z
      .string()
      .describe(
        "Foco da otimizacao: configuracoes, cupons, analise_clientes, catalogo"
      ),
  },
  ({ focus }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso otimizar minha loja Nuvemshop. Foco: "${focus}".

ACOES POR FOCO:

**configuracoes**:
1. Use get_store para ver configuracoes atuais (nome, email, dominio, moeda, idiomas).
2. Use update_store para ajustar informacoes de contato, descricao, endereco, etc.

**cupons**:
1. Use get_coupons para ver cupons existentes e avaliar quais estao ativos.
2. Use create_coupon para criar novos cupons:
   - type 'percentage' para desconto percentual (ex: 10 para 10% off).
   - type 'absolute' para desconto fixo em valor.
   - Defina start_date e end_date para controle de validade.
   - Defina max_uses para limitar o impacto financeiro.
   - Use includes/excludes para restringir a categorias ou produtos especificos.
3. Use delete_coupon para remover cupons expirados ou nao desejados.

**analise_clientes**:
1. Use get_customers para listar clientes com paginacao.
2. Use get_customer para ver historico detalhado de um cliente especifico.
3. Analise total de pedidos e valor gasto para identificar clientes VIP.

**catalogo**:
1. Use get_products para avaliar o catalogo (publicados, rascunhos, estoque zerado).
2. Use get_categories para ver organizacao atual.
3. Identifique produtos sem categoria, sem imagem ou com estoque critico.
4. Sugira reorganizacao de categorias e melhorias nas descricoes.

ESTRATEGIAS RECOMENDADAS:
- Cupom de primeira compra: 10-15% off, sem limite de uso.
- Cupom de frete gratis: type absolute com valor do frete medio, condicao de min_price.
- Limpeza de catalogo: identifique produtos com estoque 0 ou sem vendas nos ultimos 90 dias.`,
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
  console.error("BridgeAPI Nuvemshop MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
