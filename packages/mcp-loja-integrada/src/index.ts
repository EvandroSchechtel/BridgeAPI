#!/usr/bin/env node
/**
 * @bridgeapi/mcp-loja-integrada — MCP Server for Loja Integrada API
 *
 * Connect any AI Agent to Loja Integrada via the Model Context Protocol.
 * Part of the BridgeAPI ecosystem: https://bridgeapi.com.br
 *
 * Phase 1: passthrough with structured logging (hooks are no-ops)
 * Phase 2: Execution Engine plugs into pre/post hooks
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  LojaIntegradaClient,
  preExecuteHook,
  postExecuteHook,
  type LojaIntegradaConfig,
  type HookContext,
  type ApiResponse,
} from "./loja-integrada-client.js";

// --- CONFIG ---

function loadConfig(): LojaIntegradaConfig {
  const apiKey = process.env.LOJA_INTEGRADA_API_KEY;
  const appKey = process.env.LOJA_INTEGRADA_APP_KEY;

  if (!apiKey) throw new Error("LOJA_INTEGRADA_API_KEY is required");
  if (!appKey) throw new Error("LOJA_INTEGRADA_APP_KEY is required");

  return { apiKey, appKey };
}

// --- TOOL WRAPPER WITH HOOKS ---

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: LojaIntegradaConfig,
  executor: () => Promise<ApiResponse<T>>
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
            reason: preResult.reason || "Blocked by execution policy",
            escalation_id: preResult.escalation_id,
          }),
        },
      ],
    };
  }

  const response = await executor();

  const postResult = await postExecuteHook(hookCtx, response);

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

// --- SERVER SETUP ---

const config = loadConfig();
const client = new LojaIntegradaClient(config);

const server = new McpServer(
  {
    name: "bridgeapi-loja-integrada",
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

// =====================================================================
// TOOLS (19 tools)
// =====================================================================

// --- PRODUCT TOOLS ---

server.tool(
  "get_products",
  "Lista produtos da Loja Integrada. Filtre por data de criacao/atualizacao. Retorna lista paginada com nome, preco, estoque e status.",
  {
    since_criado: z
      .string()
      .optional()
      .describe("Filtrar produtos criados apos esta data (ISO 8601, ex: 2026-01-01T00:00:00)"),
    since_atualizado: z
      .string()
      .optional()
      .describe("Filtrar produtos atualizados apos esta data (ISO 8601)"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Limite de resultados por pagina (padrao: 20)"),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe("Offset para paginacao"),
  },
  async ({ since_criado, since_atualizado, limit, offset }) =>
    executeWithHooks(
      "get_products",
      { since_criado, since_atualizado, limit, offset },
      config,
      () => client.getProducts({ since_criado, since_atualizado, limit, offset })
    )
);

server.tool(
  "get_product",
  "Obtem detalhes completos de um produto por ID. Retorna nome, descricao, preco, estoque, imagens, categorias e variacoes.",
  {
    id: z.number().describe("ID do produto na Loja Integrada"),
  },
  async ({ id }) =>
    executeWithHooks("get_product", { id }, config, () => client.getProduct(id))
);

server.tool(
  "create_product",
  "Cria um novo produto na Loja Integrada. Informe nome, preco, descricao, estoque e demais campos.",
  {
    data: z
      .record(z.string(), z.unknown())
      .describe("Dados do produto (nome, preco_cheio, preco_promocional, descricao_completa, peso, estoque, ativo, etc.)"),
  },
  async ({ data }) =>
    executeWithHooks("create_product", { data }, config, () =>
      client.createProduct(data)
    )
);

server.tool(
  "update_product",
  "Atualiza um produto existente por ID. Envie apenas os campos que deseja alterar.",
  {
    id: z.number().describe("ID do produto"),
    data: z
      .record(z.string(), z.unknown())
      .describe("Campos para atualizar (nome, preco_cheio, estoque, ativo, etc.)"),
  },
  async ({ id, data }) =>
    executeWithHooks("update_product", { id, data }, config, () =>
      client.updateProduct(id, data)
    )
);

server.tool(
  "delete_product",
  "Remove um produto da Loja Integrada por ID. CUIDADO: acao irreversivel.",
  {
    id: z.number().describe("ID do produto a ser removido"),
  },
  async ({ id }) =>
    executeWithHooks("delete_product", { id }, config, () =>
      client.deleteProduct(id)
    )
);

server.tool(
  "get_product_variations",
  "Lista as variacoes de um produto (tamanhos, cores, etc.). Retorna SKU, preco e estoque de cada variacao.",
  {
    product_id: z.number().describe("ID do produto pai"),
  },
  async ({ product_id }) =>
    executeWithHooks("get_product_variations", { product_id }, config, () =>
      client.getProductVariations(product_id)
    )
);

server.tool(
  "get_product_images",
  "Lista as imagens de um produto. Retorna URL, ordem e se e a imagem principal.",
  {
    product_id: z.number().describe("ID do produto"),
  },
  async ({ product_id }) =>
    executeWithHooks("get_product_images", { product_id }, config, () =>
      client.getProductImages(product_id)
    )
);

// --- ORDER TOOLS ---

server.tool(
  "get_orders",
  "Lista pedidos da Loja Integrada. Filtre por situacao e data. Retorna lista paginada com cliente, valor total e status.",
  {
    situacao_id: z
      .number()
      .optional()
      .describe("ID da situacao do pedido para filtrar (ex: 1=aguardando pagamento, 2=em separacao, 3=enviado)"),
    since_criado: z
      .string()
      .optional()
      .describe("Filtrar pedidos criados apos esta data (ISO 8601)"),
    since_atualizado: z
      .string()
      .optional()
      .describe("Filtrar pedidos atualizados apos esta data (ISO 8601)"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Limite de resultados por pagina (padrao: 20)"),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe("Offset para paginacao"),
  },
  async ({ situacao_id, since_criado, since_atualizado, limit, offset }) =>
    executeWithHooks(
      "get_orders",
      { situacao_id, since_criado, since_atualizado, limit, offset },
      config,
      () =>
        client.getOrders({ situacao_id, since_criado, since_atualizado, limit, offset })
    )
);

server.tool(
  "get_order",
  "Obtem detalhes completos de um pedido por ID. Retorna itens, cliente, endereco de entrega, pagamento e historico de status.",
  {
    id: z.number().describe("ID do pedido na Loja Integrada"),
  },
  async ({ id }) =>
    executeWithHooks("get_order", { id }, config, () => client.getOrder(id))
);

server.tool(
  "update_order_status",
  "Atualiza a situacao/status de um pedido. Use para marcar como enviado, entregue, cancelado, etc.",
  {
    id: z.number().describe("ID do pedido"),
    status_id: z
      .string()
      .describe("ID da nova situacao (ex: '3' para enviado, '4' para entregue, '5' para cancelado)"),
  },
  async ({ id, status_id }) =>
    executeWithHooks("update_order_status", { id, status_id }, config, () =>
      client.updateOrderStatus(id, status_id)
    )
);

// --- CUSTOMER TOOLS ---

server.tool(
  "get_customers",
  "Lista clientes cadastrados na Loja Integrada. Retorna nome, email, telefone e data de cadastro.",
  {
    since_criado: z
      .string()
      .optional()
      .describe("Filtrar clientes criados apos esta data (ISO 8601)"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Limite de resultados por pagina (padrao: 20)"),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe("Offset para paginacao"),
  },
  async ({ since_criado, limit, offset }) =>
    executeWithHooks(
      "get_customers",
      { since_criado, limit, offset },
      config,
      () => client.getCustomers({ since_criado, limit, offset })
    )
);

server.tool(
  "get_customer",
  "Obtem detalhes completos de um cliente por ID. Retorna nome, CPF/CNPJ, email, telefone, enderecos e historico.",
  {
    id: z.number().describe("ID do cliente na Loja Integrada"),
  },
  async ({ id }) =>
    executeWithHooks("get_customer", { id }, config, () => client.getCustomer(id))
);

// --- CATEGORY TOOLS ---

server.tool(
  "get_categories",
  "Lista categorias de produtos da loja. Retorna nome, slug, categoria pai e se esta ativa.",
  {
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Limite de resultados por pagina (padrao: 20)"),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe("Offset para paginacao"),
  },
  async ({ limit, offset }) =>
    executeWithHooks("get_categories", { limit, offset }, config, () =>
      client.getCategories({ limit, offset })
    )
);

server.tool(
  "get_category",
  "Obtem detalhes de uma categoria por ID. Retorna nome, descricao, slug, categoria pai e produtos vinculados.",
  {
    id: z.number().describe("ID da categoria"),
  },
  async ({ id }) =>
    executeWithHooks("get_category", { id }, config, () => client.getCategory(id))
);

server.tool(
  "create_category",
  "Cria uma nova categoria de produtos. Informe nome, slug e categoria pai (se houver).",
  {
    data: z
      .record(z.string(), z.unknown())
      .describe("Dados da categoria (nome, slug, descricao, categoria_pai, ativo, etc.)"),
  },
  async ({ data }) =>
    executeWithHooks("create_category", { data }, config, () =>
      client.createCategory(data)
    )
);

// --- BRAND TOOLS ---

server.tool(
  "get_brands",
  "Lista as marcas cadastradas na loja. Retorna nome, slug e quantidade de produtos.",
  {
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Limite de resultados por pagina (padrao: 20)"),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe("Offset para paginacao"),
  },
  async ({ limit, offset }) =>
    executeWithHooks("get_brands", { limit, offset }, config, () =>
      client.getBrands({ limit, offset })
    )
);

server.tool(
  "create_brand",
  "Cria uma nova marca na loja. Informe o nome e slug.",
  {
    data: z
      .record(z.string(), z.unknown())
      .describe("Dados da marca (nome, slug, ativo, etc.)"),
  },
  async ({ data }) =>
    executeWithHooks("create_brand", { data }, config, () =>
      client.createBrand(data)
    )
);

// --- SHIPPING TOOLS ---

server.tool(
  "get_shipping_methods",
  "Lista as formas de envio configuradas na loja (Correios, transportadoras, retirada, etc.).",
  {},
  async () =>
    executeWithHooks("get_shipping_methods", {}, config, () =>
      client.getShippingMethods()
    )
);

// --- STORE TOOLS ---

server.tool(
  "get_store",
  "Obtem informacoes gerais da loja: nome, URL, CNPJ, telefone, email, endereco e configuracoes.",
  {},
  async () =>
    executeWithHooks("get_store", {}, config, () => client.getStore())
);

// =====================================================================
// RESOURCES (read-only context for agents)
// =====================================================================

server.resource("products", "lojaintegrada://products", async () => {
  const result = await client.getProducts({ limit: 50 });
  return {
    contents: [
      {
        uri: "lojaintegrada://products",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("orders", "lojaintegrada://orders", async () => {
  const result = await client.getOrders({ limit: 50 });
  return {
    contents: [
      {
        uri: "lojaintegrada://orders",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

server.resource("store", "lojaintegrada://store", async () => {
  const result = await client.getStore();
  return {
    contents: [
      {
        uri: "lojaintegrada://store",
        mimeType: "application/json",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

// =====================================================================
// PROMPTS (reusable templates - PT-BR)
// =====================================================================

server.prompt(
  "catalogo",
  "Guia para gerenciar o catalogo de produtos da Loja Integrada — criar, atualizar, organizar categorias e marcas",
  {
    acao: z
      .string()
      .describe("Acao desejada: listar, criar, atualizar, remover, organizar_categorias"),
    produto_info: z
      .string()
      .optional()
      .describe("Nome ou ID do produto (se aplicavel)"),
  },
  ({ acao, produto_info }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso gerenciar o catalogo da Loja Integrada. Acao: "${acao}"${produto_info ? `. Produto: ${produto_info}` : ""}.

Passos:
1. Use get_products para listar os produtos existentes (filtre por data se necessario).
2. Para detalhes de um produto especifico, use get_product com o ID.
3. Execute a acao solicitada:
   - **listar**: use get_products com paginacao (limit/offset)
   - **criar**: use create_product com os dados completos (nome, preco_cheio, descricao_completa, peso, estoque)
   - **atualizar**: use update_product com o ID e os campos a alterar
   - **remover**: use delete_product com o ID (CUIDADO: irreversivel)
   - **organizar_categorias**: use get_categories para ver categorias e create_category para criar novas

DICAS:
- Use get_product_variations para ver tamanhos/cores disponiveis.
- Use get_product_images para verificar fotos do produto.
- Ao criar produtos, campos obrigatorios: nome, preco_cheio, peso.
- Categorias e marcas devem ser criadas antes de vincular aos produtos.
- Use get_brands e create_brand para gerenciar marcas.`,
        },
      },
    ],
  })
);

server.prompt(
  "rastreio-pedidos",
  "Guia para rastrear e gerenciar pedidos da Loja Integrada — consultar status, atualizar situacao, acompanhar entregas",
  {
    pedido_info: z
      .string()
      .optional()
      .describe("ID do pedido ou filtro desejado (ex: 'pedidos de hoje', 'pedido 12345')"),
    acao: z
      .string()
      .optional()
      .describe("Acao: consultar, atualizar_status, listar_recentes"),
  },
  ({ pedido_info, acao }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso gerenciar pedidos na Loja Integrada${pedido_info ? `. Info: ${pedido_info}` : ""}${acao ? `. Acao: ${acao}` : ""}.

Passos:
1. Use get_orders para listar pedidos (filtre por situacao_id ou data).
2. Para detalhes de um pedido especifico, use get_order com o ID.
3. Para atualizar status, use update_order_status com o ID e o novo status_id.

SITUACOES COMUNS:
- 1: Aguardando pagamento
- 2: Em separacao
- 3: Enviado
- 4: Entregue
- 5: Cancelado

DICAS:
- Use since_criado ou since_atualizado para filtrar por periodo.
- Use get_customer para obter dados completos do cliente de um pedido.
- Use get_shipping_methods para ver as formas de envio disponiveis.
- Sempre confirme com o usuario antes de cancelar ou alterar status de pedidos.`,
        },
      },
    ],
  })
);

server.prompt(
  "configuracao-loja",
  "Guia para consultar e entender as configuracoes da loja — dados cadastrais, formas de envio, categorias e marcas",
  {},
  () => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso entender as configuracoes da Loja Integrada.

Passos:
1. Use get_store para obter dados gerais da loja (nome, URL, CNPJ, contato).
2. Use get_categories para ver a arvore de categorias de produtos.
3. Use get_brands para listar as marcas cadastradas.
4. Use get_shipping_methods para ver as formas de envio configuradas.

ANALISE SUGERIDA:
- Verifique se os dados cadastrais da loja estao completos e corretos.
- Analise se as categorias estao bem organizadas (nao muito profundas, nomes claros).
- Verifique se as marcas principais dos produtos estao cadastradas.
- Confira se as formas de envio cobrem as principais regioes de entrega.
- Compare o numero de produtos ativos vs inativos usando get_products.`,
        },
      },
    ],
  })
);

// =====================================================================
// START SERVER
// =====================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BridgeAPI Loja Integrada MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
