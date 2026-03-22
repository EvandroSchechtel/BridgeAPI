# @bridgeapi/mcp-hotmart

**MCP Server para Hotmart API** — Conecte qualquer AI Agent ao Hotmart via Model Context Protocol.

> Parte do ecossistema [BridgeAPI](https://bridgeapi.com.br): conectores MCP para plataformas brasileiras.

## O que faz

Este MCP server expoe a API da Hotmart como tools padronizados do Model Context Protocol. Isso permite que qualquer AI Agent (Claude, ChatGPT, LangChain, CrewAI, etc.) consulte vendas, gerencie assinaturas, crie cupons, acompanhe alunos e muito mais — tudo via MCP.

### Tools disponiveis

| Tool | Descricao |
|------|-----------|
| `get_sales_history` | Historico de vendas com filtros por produto, email, data e status |
| `get_sale_summary` | Resumo detalhado de uma venda por transaction code |
| `get_sale_participants` | Participantes de uma venda (produtor, afiliado, comprador) |
| `get_commissions` | Historico de comissoes com filtros por produto e periodo |
| `get_subscriptions` | Lista assinaturas com filtros por produto, email e status |
| `get_subscription` | Detalhes de uma assinatura por subscriber code |
| `cancel_subscription` | Cancela uma assinatura ativa |
| `reactivate_subscription` | Reativa uma assinatura cancelada |
| `change_subscription_due_day` | Altera o dia de vencimento da assinatura (1-28) |
| `get_products` | Lista todos os produtos da conta Hotmart |
| `get_modules` | Lista modulos/aulas de um produto Club (area de membros) |
| `get_student_progress` | Progresso de um aluno em um produto Club |
| `get_coupons` | Lista cupons de desconto por produto |
| `create_coupon` | Cria novo cupom de desconto (percentual ou fixo) |

### Resources (contexto read-only)

| Resource | URI |
|----------|-----|
| Vendas recentes | `hotmart://sales` |
| Assinaturas ativas | `hotmart://subscriptions` |
| Produtos cadastrados | `hotmart://products` |

### Prompts (guias reutilizaveis)

| Prompt | Uso |
|--------|-----|
| `subscription-manager` | Guia para gerenciar assinaturas (cancelar, reativar, alterar vencimento) |
| `sales-analyzer` | Guia para analisar vendas e comissoes |
| `coupon-creator` | Guia para criar cupons promocionais |

## Instalacao

```bash
npm install @bridgeapi/mcp-hotmart
```

## Configuracao

### Variaveis de ambiente obrigatorias

```bash
export HOTMART_CLIENT_ID="your-client-id"
export HOTMART_CLIENT_SECRET="your-client-secret"
export HOTMART_BASIC_TOKEN="your-basic-token"
# Opcional:
export HOTMART_ENVIRONMENT="production"  # ou "sandbox"
```

> **Como obter:** Acesse [Hotmart Developer Portal](https://developers.hotmart.com/) > Applications > Crie uma nova aplicacao.

### Uso com Claude Desktop

Adicione ao seu `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hotmart": {
      "command": "npx",
      "args": ["@bridgeapi/mcp-hotmart"],
      "env": {
        "HOTMART_CLIENT_ID": "your-client-id",
        "HOTMART_CLIENT_SECRET": "your-client-secret",
        "HOTMART_BASIC_TOKEN": "your-basic-token"
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
    "hotmart": {
      "command": "npx",
      "args": ["@bridgeapi/mcp-hotmart"],
      "env": {
        "HOTMART_CLIENT_ID": "your-client-id",
        "HOTMART_CLIENT_SECRET": "your-client-secret",
        "HOTMART_BASIC_TOKEN": "your-basic-token"
      }
    }
  }
}
```

## Exemplos de uso

Apos configurar, voce pode falar diretamente com o Claude:

### Consultar vendas
> "Mostre as vendas do meu produto nos ultimos 30 dias."

### Gerenciar assinatura
> "Cancele a assinatura do cliente joao@email.com e envie email de cancelamento."

### Analisar comissoes
> "Qual o total de comissoes que recebi este mes como afiliado?"

### Acompanhar alunos
> "Qual o progresso do aluno maria@email.com no curso de Marketing Digital?"

### Criar cupom
> "Crie um cupom BLACKFRIDAY com 30% de desconto para o produto X, valido ate 30/11."

## Desenvolvimento

```bash
# Clone e instale
git clone https://github.com/EvandroSchechtel/mcp-hotmart.git
cd mcp-hotmart
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
|  @bridgeapi/mcp-hotmart      |
|  +------------------------+  |
|  | pre_execute hook  <----|--|-- Phase 2: Execution Engine
|  | (Phase 1: no-op + log) |  |
|  +---------+--------------+  |
|            v                 |
|  +------------------------+  |
|  | Hotmart REST API       |  |
|  | (OAuth2 + REST v1)     |  |
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

- [x] v0.1 — Tools core de vendas, assinaturas, produtos, cupons e club
- [ ] v0.2 — Webhook receiver para notificacoes de vendas em tempo real
- [ ] v0.3 — Streamable HTTP transport (para uso remoto via Gateway)
- [ ] v1.0 — Pronto para producao com rate limiting e error recovery

## Ecossistema BridgeAPI

| Conector | Status |
|----------|--------|
| WhatsApp Business API | v0.1 |
| **Hotmart** | **v0.1** |
| Eduzz | Em desenvolvimento |
| Pix / Pagamentos | Planejado |
| NFe / Notas Fiscais | Planejado |
| Guru | Planejado |

## Licenca

MIT — use livremente.

## Links

- [BridgeAPI](https://bridgeapi.com.br) — Plataforma gerenciada
- [MCP Specification](https://modelcontextprotocol.io/) — Protocolo oficial
- [Hotmart API Docs](https://developers.hotmart.com/docs/en/) — Documentacao da Hotmart
