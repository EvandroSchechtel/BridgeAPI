# @bridgeapi/mcp-tiktok-shop

MCP Server para a API do **TikTok Shop** — conecte qualquer Agente de IA ao TikTok Shop via [Model Context Protocol](https://modelcontextprotocol.io).

Parte do ecossistema **BridgeAPI**: conectando plataformas brasileiras e globais a agentes inteligentes.

---

## Funcionalidades

| Categoria | Tools | Descricao |
|-----------|-------|-----------|
| **Produtos** | `get_products`, `get_product`, `create_product`, `update_product`, `deactivate_product`, `activate_product` | CRUD completo de produtos, ativacao/desativacao em lote |
| **Pedidos** | `get_orders`, `get_order`, `ship_order`, `get_order_packages` | Listagem, detalhes, envio e rastreamento de pedidos |
| **Categorias** | `get_categories`, `get_category_attributes` | Arvore de categorias e atributos obrigatorios |
| **Loja** | `get_shop_info`, `get_seller_performance` | Informacoes da loja e metricas de performance |
| **Estoque** | `get_warehouse`, `update_inventory` | Armazens e atualizacao de estoque por SKU |
| **Devolucoes** | `get_return_orders`, `approve_return` | Listagem e aprovacao/rejeicao de devolucoes |

### Resources (contexto read-only para agentes)

| URI | Descricao |
|-----|-----------|
| `tiktokshop://products` | Lista de produtos da loja |
| `tiktokshop://orders` | Pedidos recentes |
| `tiktokshop://shop` | Informacoes da loja |

### Prompts (templates reutilizaveis)

| Prompt | Descricao |
|--------|-----------|
| `product-lister` | Guia para listar e gerenciar produtos |
| `order-shipper` | Guia para processar e enviar pedidos |
| `inventory-manager` | Guia para gerenciar estoque |

---

## Instalacao

### Via npx (recomendado)

```bash
npx @bridgeapi/mcp-tiktok-shop
```

### Via npm global

```bash
npm install -g @bridgeapi/mcp-tiktok-shop
bridgeapi-tiktok-shop
```

### Build local

```bash
git clone https://github.com/EvandroSchechtel/mcp-tiktok-shop.git
cd mcp-tiktok-shop
npm install
npm run build
```

---

## Configuracao

### Variaveis de ambiente

```bash
# Obtenha em: TikTok Shop Partner Center → App Management
TIKTOK_SHOP_APP_KEY=sua_app_key
TIKTOK_SHOP_APP_SECRET=seu_app_secret
TIKTOK_SHOP_ACCESS_TOKEN=seu_access_token
TIKTOK_SHOP_SHOP_ID=seu_shop_id
```

### Claude Desktop

Adicione ao `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tiktok-shop": {
      "command": "npx",
      "args": ["@bridgeapi/mcp-tiktok-shop"],
      "env": {
        "TIKTOK_SHOP_APP_KEY": "SUA_APP_KEY",
        "TIKTOK_SHOP_APP_SECRET": "SEU_APP_SECRET",
        "TIKTOK_SHOP_ACCESS_TOKEN": "SEU_ACCESS_TOKEN",
        "TIKTOK_SHOP_SHOP_ID": "SEU_SHOP_ID"
      }
    }
  }
}
```

---

## Exemplos de uso

### Listar produtos ativos

```
Use a tool get_products com search_status=4 para ver todos os produtos ativos.
```

### Processar pedidos pendentes

```
Liste pedidos com get_orders e order_status=111 (aguardando envio).
Para cada pedido, use ship_order com o tracking_number da transportadora.
```

### Atualizar estoque

```
1. Use get_warehouse para ver os armazens disponíveis.
2. Use get_product para ver as SKUs do produto.
3. Use update_inventory com product_id, sku_id, warehouse_id e a nova quantidade.
```

### Gerenciar devolucoes

```
Liste devoluções pendentes com get_return_orders e status=1.
Aprove ou rejeite com approve_return, incluindo o motivo quando rejeitar.
```

---

## Arquitetura

```
src/
  index.ts              # MCP Server — tools, resources, prompts
  tiktok-shop-client.ts # API Client com HMAC-SHA256 e hooks
```

### Hook Architecture (Phase 2 ready)

Cada chamada de tool passa por `preExecuteHook` e `postExecuteHook`:

- **Phase 1 (atual)**: hooks sao no-ops que sempre permitem execucao
- **Phase 2**: Execution Engine avalia confianca e pode bloquear/escalar

```
Agent → Tool Call → preExecuteHook → API Request → postExecuteHook → Response
```

### Autenticacao

A API do TikTok Shop usa **HMAC-SHA256** para assinar cada request:

1. Parametros ordenados alfabeticamente
2. Concatenacao: `app_secret + path + params + app_secret`
3. Assinatura HMAC-SHA256 com app_secret como chave

---

## Ecossistema BridgeAPI

| Servidor | Plataforma | Status |
|----------|-----------|--------|
| [@bridgeapi/mcp-hotmart](https://github.com/EvandroSchechtel/mcp-hotmart) | Hotmart (infoprodutos) | Publicado |
| [@bridgeapi/mcp-eduzz](https://github.com/EvandroSchechtel/mcp-eduzz) | Eduzz (infoprodutos) | Publicado |
| [@bridgeapi/mcp-mercadolivre](https://github.com/EvandroSchechtel/mcp-mercadolivre) | Mercado Livre (marketplace) | Publicado |
| **@bridgeapi/mcp-tiktok-shop** | **TikTok Shop (e-commerce)** | **Publicado** |

---

## Debug

Use o MCP Inspector para testar:

```bash
npm run inspect
```

---

## Licenca

MIT - veja [LICENSE](LICENSE)

---

Desenvolvido por [BridgeAPI](https://bridgeapi.com.br) / [ESC Automacoes Digitais](https://escautomacoes.com.br)
