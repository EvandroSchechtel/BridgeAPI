# @bridgeapi/mcp-temu

**MCP Server para Temu API** — Conecte qualquer AI Agent ao Temu via Model Context Protocol.

> Parte do ecossistema [BridgeAPI](https://bridgeapi.com.br): conectores MCP para plataformas brasileiras.

## Tools disponiveis (16)

| Tool | Descricao |
|------|-----------|
| `list_items` | Listar itens/produtos |
| `get_item` | Obter item por ID |
| `create_item` | Criar novo item |
| `update_item` | Atualizar item |
| `delete_item` | Deletar item |
| `list_orders` | Listar pedidos |
| `get_order` | Obter pedido por ID |
| `update_order` | Atualizar pedido |
| `list_customers` | Listar clientes |
| `get_customer` | Obter cliente por ID |
| `get_analytics` | Obter metricas |
| `get_profile` | Obter perfil da conta |
| `search` | Buscar na plataforma |
| `get_categories` | Listar categorias |
| `send_message` | Enviar mensagem |
| `get_webhooks` | Listar webhooks |

## Resources

| Resource | URI |
|----------|-----|
| Itens | `temu://items` |
| Pedidos | `temu://orders` |
| Perfil | `temu://profile` |

## Prompts

| Prompt | Descricao |
|--------|-----------|
| `item-manager` | Guia para gerenciar itens |
| `order-handler` | Guia para gerenciar pedidos |
| `analytics-reporter` | Guia para relatorios |

## Instalacao

```bash
npm install @bridgeapi/mcp-temu
```

## Uso com Claude Desktop

```json
{
  "mcpServers": {
    "temu": {
      "command": "npx",
      "args": ["@bridgeapi/mcp-temu"],
      "env": {}
    }
  }
}
```

## Desenvolvimento

```bash
git clone https://github.com/EvandroSchechtel/mcp-temu.git
cd mcp-temu
npm install
npm run build
npm run inspect
```

## Arquitetura

```
Agent (Claude/ChatGPT/LangChain)
    |
    v (MCP Protocol)
+------------------------------+
|  @bridgeapi/mcp-temu           |
|  [pre_execute hook]  <-- Phase 2: Execution Engine
|  [Temu API]            |
|  [post_execute hook] <-- Phase 2: Response validation
+------------------------------+
```

## Ecossistema BridgeAPI

| Conector | Status |
|----------|--------|
| WhatsApp | v0.1 |
| Mercado Livre | v0.1 |
| Hotmart | v0.1 |
| Eduzz | v0.1 |
| Temu | v0.1 |

## Licenca

MIT — [BridgeAPI](https://bridgeapi.com.br) / ESC Automacoes Digitais Ltda
