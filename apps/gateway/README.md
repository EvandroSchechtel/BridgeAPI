# BridgeAPI Gateway

**API Gateway com middleware pipeline para conectores MCP** — Autenticacao, rate limiting, logging estruturado e hooks pre/post execucao.

> Parte do ecossistema [BridgeAPI](https://bridgeapi.com.br): conectores MCP para plataformas brasileiras.

## Arquitetura

```
Agent (Claude/ChatGPT/LangChain)
    |
    v (HTTP POST /v1/execute)
+--------------------------------------------------+
|  BridgeAPI Gateway                                |
|                                                   |
|  1. [authenticate]  — valida API key, carrega     |
|                       config do cliente           |
|  2. [rate_limit]    — sliding window por plano    |
|  3. [validate]      — valida params do tool call  |
|  4. [pre_execute]   — HOOK (Phase 1: no-op + log) |
|  5. [execute]       — chama API da plataforma     |
|  6. [post_execute]  — HOOK (Phase 1: no-op + log) |
|  7. [log_and_meter] — grava no banco, billing     |
|                                                   |
+--------------------------------------------------+
    |
    v
  WhatsApp / Hotmart / Eduzz / Pix / NFe / Guru
```

## Stack

- **Hono** — framework web leve, middleware-native, TypeScript-first
- **Prisma** — ORM com type-safety e migrations
- **PostgreSQL** — banco principal (7 tabelas, 2 reservadas para Phase 2)
- **Redis** — rate limiting com sliding window (in-memory fallback)

## Inicio Rapido

```bash
# Clone
git clone https://github.com/EvandroSchechtel/bridgeapi-gateway.git
cd bridgeapi-gateway

# Instale dependencias
npm install

# Configure
cp .env.example .env
# Edite .env com suas credenciais

# Rode migrations
npm run db:push

# Inicie
npm run dev
```

## API

### Health Check

```bash
GET /health
```

### Executar Tool Call

```bash
POST /v1/execute
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "connector_type": "whatsapp",
  "connector_id": "conn-123",
  "tool_name": "send_text_message",
  "params": {
    "to": "5541999999999",
    "body": "Ola!"
  }
}
```

### Response Envelope

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "latency_ms": 123,
    "confidence_score": null,
    "execution_mode": "auto",
    "flags": []
  }
}
```

## Database Schema

| Tabela | Fase 1 | Fase 2 |
|--------|--------|--------|
| `clients` | Ativo | Ativo |
| `api_keys` | Ativo | Ativo |
| `connectors` | Ativo | Ativo |
| `tool_calls` | Ativo (logging) | Ativo (ML input) |
| `webhook_events` | Ativo | Ativo |
| `daily_metrics` | Ativo (analytics) | Ativo (anomaly input) |
| `execution_rules` | Criada, vazia | Ativo |
| `escalations` | Criada, vazia | Ativo |

## Rate Limits por Plano

| Plano | Calls/hora |
|-------|-----------|
| Free | 100 |
| Starter | 1.000 |
| Pro | 10.000 |
| Enterprise | 100.000 |

## Licenca

MIT — [BridgeAPI](https://bridgeapi.com.br) / ESC Automacoes Digitais Ltda
