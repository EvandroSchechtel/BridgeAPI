# @bridgeapi/mcp-eduzz

**MCP Server para Eduzz API** — Conecte qualquer AI Agent a Eduzz via Model Context Protocol.

> Parte do ecossistema [BridgeAPI](https://bridgeapi.com.br): conectores MCP para plataformas brasileiras.

## O que faz

Este MCP server expoe a Eduzz API como tools padronizados do Model Context Protocol. Isso permite que qualquer AI Agent (Claude, ChatGPT, LangChain, CrewAI, etc.) consulte vendas, gerencie produtos, processe reembolsos, administre afiliados e muito mais — tudo via MCP.

### Tools disponiveis

| Tool | Descricao |
|------|-----------|
| `get_sales` | Lista vendas com filtros por data, status e produto |
| `get_sale_details` | Detalhes completos de uma venda especifica |
| `request_refund` | Solicita reembolso de uma venda |
| `get_products` | Lista todos os produtos (infoprodutos, cursos, ebooks) |
| `get_product_details` | Detalhes completos de um produto |
| `get_subscriptions` | Lista assinaturas com filtros |
| `cancel_subscription` | Cancela uma assinatura ativa |
| `get_contracts` | Lista contratos |
| `get_my_affiliates` | Lista afiliados dos seus produtos |
| `get_affiliate_products` | Lista produtos que voce e afiliado |
| `get_financial_statement` | Extrato financeiro por periodo |
| `get_balance` | Saldo disponivel e a receber |
| `get_coupons` | Lista cupons de desconto |
| `create_coupon` | Cria novo cupom de desconto |

### Resources (contexto read-only)

| Resource | URI |
|----------|-----|
| Vendas recentes | `eduzz://sales` |
| Produtos | `eduzz://products` |
| Financeiro (saldo) | `eduzz://financial` |

### Prompts (guias reutilizaveis)

| Prompt | Uso |
|--------|-----|
| `refund-handler` | Guia para processar solicitacoes de reembolso |
| `sales-report` | Guia para gerar relatorios de vendas |
| `affiliate-manager` | Guia para gerenciar programa de afiliados |

## Instalacao

```bash
npm install @bridgeapi/mcp-eduzz
```

## Configuracao

### Variaveis de ambiente obrigatorias

```bash
export EDUZZ_API_KEY="your-api-key"
export EDUZZ_PUBLIC_KEY="your-public-key"
export EDUZZ_EMAIL="your-eduzz-email"
# Opcional:
export EDUZZ_API_VERSION="1.0"  # default
```

> **Como obter:** Acesse o [Eduzz Developer Portal](https://developers.eduzz.com/) e gere suas API Keys.

### Uso com Claude Desktop

Adicione ao seu `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "eduzz": {
      "command": "npx",
      "args": ["@bridgeapi/mcp-eduzz"],
      "env": {
        "EDUZZ_API_KEY": "your-api-key",
        "EDUZZ_PUBLIC_KEY": "your-public-key",
        "EDUZZ_EMAIL": "your-eduzz-email"
      }
    }
  }
}
```

### Uso com Cursor

Adicione ao seu `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "eduzz": {
      "command": "npx",
      "args": ["@bridgeapi/mcp-eduzz"],
      "env": {
        "EDUZZ_API_KEY": "your-api-key",
        "EDUZZ_PUBLIC_KEY": "your-public-key",
        "EDUZZ_EMAIL": "your-eduzz-email"
      }
    }
  }
}
```

## Exemplos de uso

Apos configurar, voce pode falar diretamente com o Claude:

### Consultar vendas
> "Quais foram minhas vendas dos ultimos 7 dias na Eduzz?"

### Detalhes de venda
> "Me mostre os detalhes da venda #123456."

### Processar reembolso
> "Preciso reembolsar a venda #123456. O cliente pediu dentro do prazo de garantia."

### Listar produtos
> "Quais produtos tenho cadastrados na Eduzz?"

### Ver saldo
> "Qual meu saldo disponivel na Eduzz?"

### Gerenciar afiliados
> "Quem sao meus top afiliados do produto 'Curso de Marketing Digital'?"

### Criar cupom
> "Crie um cupom PROMO50 com 50% de desconto para o produto #789, valido ate 31/12/2026."

### Relatorio financeiro
> "Gere um relatorio financeiro do mes de marco de 2026."

## Desenvolvimento

```bash
# Clone e instale
git clone https://github.com/EvandroSchechtel/mcp-eduzz.git
cd mcp-eduzz
npm install

# Build
npm run build

# Testar com MCP Inspector
npm run inspect

# Dev mode (watch)
npm run dev
```

## Arquitetura

```
Agent (Claude/ChatGPT/LangChain)
    |
    v (MCP Protocol - JSON-RPC 2.0)
+------------------------------+
|  @bridgeapi/mcp-eduzz        |
|  +------------------------+  |
|  | pre_execute hook  <----|--|-- Phase 2: Execution Engine
|  | (Phase 1: no-op + log) |  |
|  +---------+--------------+  |
|            v                 |
|  +------------------------+  |
|  | Eduzz REST API         |  |
|  | (api2.eduzz.com)       |  |
|  +---------+--------------+  |
|            v                 |
|  +------------------------+  |
|  | post_execute hook <----|--|-- Phase 2: Response validation
|  | (Phase 1: no-op + log) |  |
|  +------------------------+  |
+------------------------------+
```

> Os hooks `pre_execute` e `post_execute` estao prontos para receber a Execution Engine na Fase 2 do BridgeAPI, mas na v0.1 sao no-ops que apenas logam o contexto.

## Roadmap

- [x] v0.1 — Tools core de vendas, produtos, assinaturas, financeiro, afiliados, cupons
- [ ] v0.2 — Webhook receiver para notificacoes de vendas em tempo real
- [ ] v0.3 — Streamable HTTP transport (para uso remoto via Gateway)
- [ ] v1.0 — Pronto para producao com rate limiting e error recovery

## Ecossistema BridgeAPI

| Conector | Status |
|----------|--------|
| WhatsApp Business API | v0.1 |
| Hotmart | v0.1 |
| **Eduzz** | **v0.1** |
| Pix / Pagamentos | Planejado |
| NFe / Notas Fiscais | Planejado |
| Guru | Planejado |

## Licenca

MIT — use livremente.

## Links

- [BridgeAPI](https://bridgeapi.com.br) — Plataforma gerenciada
- [MCP Specification](https://modelcontextprotocol.io/) — Protocolo oficial
- [Eduzz](https://www.eduzz.com/) — Plataforma de produtos digitais
