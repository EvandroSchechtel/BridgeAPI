# BridgeAPI Dashboard

**Web UI para gerenciar conectores MCP, API keys, analytics e logs.**

> Parte do ecossistema [BridgeAPI](https://bridgeapi.com.br): conectores MCP para plataformas brasileiras.

## Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS v4 (dark theme)
- shadcn/ui components (planejado)
- Prisma v7 (schema compartilhado com Gateway)

## Paginas

| Pagina | Descricao |
|--------|-----------|
| `/connectors` | Gerenciar conectores (WhatsApp, Hotmart, etc.) |
| `/logs` | Logs de tool calls com filtros |
| `/api-keys` | Gerenciar API keys |
| `/webhooks` | Configurar webhooks de notificacao |
| `/analytics` | Metricas de uso, graficos |
| `/settings` | Configuracoes da conta |

## Inicio Rapido

```bash
git clone https://github.com/EvandroSchechtel/bridgeapi-dashboard.git
cd bridgeapi-dashboard
npm install
cp .env.example .env
npm run dev
```

## Tema

Dark theme com as cores do BridgeAPI:
- Background: `#0B0B0F`
- Surface: `#16161E`
- Accent: `#25D366` (verde WhatsApp/BridgeAPI)

## Licenca

MIT — [BridgeAPI](https://bridgeapi.com.br) / ESC Automacoes Digitais Ltda
