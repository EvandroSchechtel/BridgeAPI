# BridgeAPI

**Ecossistema de conectores MCP para plataformas brasileiras.**
Conecte qualquer AI Agent ao WhatsApp, Hotmart, Mercado Livre, Shopify, Pix, NFe e mais — via Model Context Protocol.

> "Primeiro ser util. Depois ser inteligente. Depois ser indispensavel."

## Arquitetura

```
AI Agent (Claude, ChatGPT, LangChain, CrewAI)
    |
    v  MCP Protocol (JSON-RPC 2.0 / stdio)
+--------------------------------------------------+
|              BridgeAPI Ecosystem                  |
|                                                   |
|  packages/          16 MCP Servers                |
|  ├── mcp-whatsapp       WhatsApp Business API     |
|  ├── mcp-hotmart        Hotmart                   |
|  ├── mcp-eduzz          Eduzz                     |
|  ├── mcp-mercadolivre   Mercado Livre             |
|  ├── mcp-pix            Pix (Banco Central)       |
|  ├── mcp-nfe            Nota Fiscal Eletronica    |
|  ├── mcp-instagram-direct  Instagram Direct       |
|  ├── mcp-nuvemshop      Nuvemshop                 |
|  ├── mcp-shopify        Shopify                   |
|  ├── mcp-loja-integrada Loja Integrada            |
|  ├── mcp-tiktok         TikTok                    |
|  ├── mcp-tiktok-shop    TikTok Shop               |
|  ├── mcp-shopee         Shopee                    |
|  ├── mcp-temu           Temu                      |
|  ├── mcp-calendly       Calendly                  |
|  └── mcp-google-calendar Google Calendar          |
|                                                   |
|  apps/              Infraestrutura                |
|  ├── gateway        API Gateway (Hono + Prisma)   |
|  └── dashboard      Web Dashboard (Next.js 16)    |
+--------------------------------------------------+
    |
    v
  WhatsApp / Hotmart / ML / Shopify / Pix / NFe ...
```

## Conectores MCP

| Pacote | Plataforma | Tools | Status |
|--------|-----------|-------|--------|
| `@bridgeapi/mcp-whatsapp` | WhatsApp Business API | 16 | v0.1.0 |
| `@bridgeapi/mcp-hotmart` | Hotmart | 14 | v0.1.0 |
| `@bridgeapi/mcp-eduzz` | Eduzz | 14 | v0.1.0 |
| `@bridgeapi/mcp-mercadolivre` | Mercado Livre | 20 | v0.1.0 |
| `@bridgeapi/mcp-pix` | Pix (Banco Central) | 16 | v0.1.0 |
| `@bridgeapi/mcp-nfe` | Nota Fiscal Eletronica | 16 | v0.1.0 |
| `@bridgeapi/mcp-instagram-direct` | Instagram Direct | 16 | v0.1.0 |
| `@bridgeapi/mcp-nuvemshop` | Nuvemshop | 16 | v0.1.0 |
| `@bridgeapi/mcp-shopify` | Shopify | 16 | v0.1.0 |
| `@bridgeapi/mcp-loja-integrada` | Loja Integrada | 16 | v0.1.0 |
| `@bridgeapi/mcp-tiktok` | TikTok | 16 | v0.1.0 |
| `@bridgeapi/mcp-tiktok-shop` | TikTok Shop | 16 | v0.1.0 |
| `@bridgeapi/mcp-shopee` | Shopee | 16 | v0.1.0 |
| `@bridgeapi/mcp-temu` | Temu | 16 | v0.1.0 |
| `@bridgeapi/mcp-calendly` | Calendly | 16 | v0.1.0 |
| `@bridgeapi/mcp-google-calendar` | Google Calendar | 16 | v0.1.0 |

## Infraestrutura

| App | Descricao | Stack |
|-----|-----------|-------|
| **Gateway** | API Gateway com middleware pipeline | Hono + Prisma + PostgreSQL |
| **Dashboard** | Web UI para gerenciar conectores | Next.js 16 + Tailwind v4 |

## Inicio Rapido

### Usar um conector standalone

```bash
# Instalar
npm install @bridgeapi/mcp-whatsapp

# Configurar no Claude Desktop (claude_desktop_config.json)
{
  "mcpServers": {
    "whatsapp": {
      "command": "npx",
      "args": ["@bridgeapi/mcp-whatsapp"],
      "env": {
        "WHATSAPP_ACCESS_TOKEN": "seu-token",
        "WHATSAPP_PHONE_NUMBER_ID": "seu-phone-id",
        "WHATSAPP_BUSINESS_ACCOUNT_ID": "seu-waba-id"
      }
    }
  }
}
```

### Desenvolvimento (monorepo)

```bash
# Clone
git clone https://github.com/EvandroSchechtel/BridgeAPI.git
cd BridgeAPI

# Instalar todas as dependencias
npm install

# Build de todos os packages
npm run build

# Dev mode de um package especifico
cd packages/mcp-whatsapp
npm run dev
```

## Estrutura do Monorepo

```
BridgeAPI/
├── packages/                  # 16 MCP Servers
│   ├── mcp-whatsapp/
│   │   ├── src/
│   │   │   ├── index.ts       # MCP Server (tools, resources, prompts)
│   │   │   └── *-client.ts    # API client + pre/post hooks
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── mcp-hotmart/
│   ├── mcp-eduzz/
│   └── ... (14 mais)
├── apps/                      # Infraestrutura
│   ├── gateway/               # API Gateway (Hono)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── middleware/    # auth, rate-limit
│   │   │   ├── hooks/        # pre/post execute
│   │   │   └── routes/       # health, execute
│   │   └── prisma/           # Database schema (7 tabelas)
│   └── dashboard/             # Web Dashboard (Next.js)
│       └── src/app/
├── package.json               # Workspaces root
├── LICENSE
└── README.md
```

## Roadmap

### Fase 1: Infra de Conexao (Mes 1-6)
- [x] MCP Servers para 16 plataformas
- [x] Gateway com middleware pipeline (auth, rate limit, hooks)
- [x] Dashboard com dark theme
- [ ] Publicar no npm
- [ ] Webhook receiver para mensagens recebidas
- [ ] Streamable HTTP transport

### Fase 2: Execution Engine (Mes 7-12)
- [ ] Motor de regras de confianca nos pre/post hooks
- [ ] Confidence scoring por tool call
- [ ] Escalonamento para humano quando confianca baixa
- [ ] Deteccao de anomalias
- [ ] Dashboard v2: visao "piloto automatico"

## Hooks Pre/Post Execute

Todos os MCP servers incluem hooks que sao no-ops na Fase 1 mas estao prontos para a Fase 2:

```typescript
// Phase 1: sempre permite
async function preExecuteHook(ctx: HookContext): Promise<PreHookResult> {
  return { allow: true };
}

// Phase 2: Execution Engine avalia confianca
async function preExecuteHook(ctx: HookContext): Promise<PreHookResult> {
  const score = await evaluateConfidence(ctx);
  if (score < threshold) {
    return { allow: false, reason: "Low confidence", escalation_id: "..." };
  }
  return { allow: true };
}
```

## Licenca

MIT — [BridgeAPI](https://bridgeapi.com.br) / ESC Automacoes Digitais Ltda

## Links

- [MCP Specification](https://modelcontextprotocol.io/)
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Hotmart API](https://developers.hotmart.com/)
- [Mercado Livre API](https://developers.mercadolivre.com.br/)
