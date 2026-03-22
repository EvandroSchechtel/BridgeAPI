# @bridgeapi/mcp-whatsapp

**MCP Server para WhatsApp Business Cloud API** — Conecte qualquer AI Agent ao WhatsApp via Model Context Protocol.

> Parte do ecossistema [BridgeAPI](https://bridgeapi.com.br): conectores MCP para plataformas brasileiras.

## O que faz

Este MCP server expõe a WhatsApp Business Cloud API como tools padronizados do Model Context Protocol. Isso permite que qualquer AI Agent (Claude, ChatGPT, LangChain, CrewAI, etc.) envie mensagens, gerencie templates, consulte analytics e muito mais — tudo via MCP.

### Tools disponíveis

| Tool | Descrição |
|------|-----------|
| `send_text_message` | Envia mensagem de texto (dentro da janela de 24h) |
| `send_template_message` | Envia template pré-aprovado (fora da janela de 24h) |
| `send_media_message` | Envia imagem, vídeo, áudio ou documento |
| `send_interactive_message` | Envia mensagem com botões ou lista |
| `send_location_message` | Envia localização |
| `send_contact_message` | Envia cartão de contato |
| `mark_message_read` | Marca mensagem como lida |
| `list_templates` | Lista templates com status de aprovação |
| `create_template` | Cria novo template para aprovação |
| `delete_template` | Deleta template |
| `get_phone_numbers` | Lista números com quality rating |
| `get_business_profile` | Retorna perfil do negócio |
| `update_business_profile` | Atualiza perfil |
| `get_analytics` | Métricas de mensagens por período |
| `upload_media` | Upload de mídia para envio |
| `get_media_url` | URL de download de mídia recebida |

### Resources (contexto read-only)

| Resource | URI |
|----------|-----|
| Templates ativos | `whatsapp://templates` |
| Perfil do negócio | `whatsapp://profile` |
| Números registrados | `whatsapp://phone-numbers` |

### Prompts (guias reutilizáveis)

| Prompt | Uso |
|--------|-----|
| `campaign-sender` | Guia para enviar campanha de marketing |
| `support-responder` | Guia para responder suporte |
| `template-creator` | Guia para criar templates seguindo regras da Meta |

## Instalação

```bash
npm install @bridgeapi/mcp-whatsapp
```

## Configuração

### Variáveis de ambiente obrigatórias

```bash
export WHATSAPP_ACCESS_TOKEN="your-system-user-token"
export WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
export WHATSAPP_BUSINESS_ACCOUNT_ID="your-waba-id"
# Opcional:
export WHATSAPP_API_VERSION="v21.0"  # default
```

> **Como obter:** Acesse [Meta Business Manager](https://business.facebook.com/) → WhatsApp → Configuração da API.

### Uso com Claude Desktop

Adicione ao seu `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "npx",
      "args": ["@bridgeapi/mcp-whatsapp"],
      "env": {
        "WHATSAPP_ACCESS_TOKEN": "your-token",
        "WHATSAPP_PHONE_NUMBER_ID": "your-phone-id",
        "WHATSAPP_BUSINESS_ACCOUNT_ID": "your-waba-id"
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
    "whatsapp": {
      "command": "npx",
      "args": ["@bridgeapi/mcp-whatsapp"],
      "env": {
        "WHATSAPP_ACCESS_TOKEN": "your-token",
        "WHATSAPP_PHONE_NUMBER_ID": "your-phone-id",
        "WHATSAPP_BUSINESS_ACCOUNT_ID": "your-waba-id"
      }
    }
  }
}
```

## Exemplos de uso

Após configurar, você pode falar diretamente com o Claude:

### Enviar mensagem
> "Envie uma mensagem para +5541999999999 dizendo: Seu pedido #1234 foi enviado!"

### Listar templates
> "Quais templates de WhatsApp estão aprovados?"

### Criar campanha
> "Preciso criar uma campanha de marketing para o produto 'Curso de IA'. Me ajude a criar o template e enviar."

### Ver analytics
> "Mostre as métricas de mensagens dos últimos 7 dias."

## Desenvolvimento

```bash
# Clone e instale
git clone https://github.com/bridgeapi-dev/mcp-whatsapp.git
cd mcp-whatsapp
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
    │
    ▼ (MCP Protocol - JSON-RPC 2.0)
┌──────────────────────────────┐
│  @bridgeapi/mcp-whatsapp     │
│  ┌────────────────────────┐  │
│  │ pre_execute hook  ◄────│──│── Phase 2: Execution Engine
│  │ (Phase 1: no-op + log) │  │
│  └────────┬───────────────┘  │
│           ▼                  │
│  ┌────────────────────────┐  │
│  │ WhatsApp Cloud API     │  │
│  │ (Meta Graph API v21.0) │  │
│  └────────┬───────────────┘  │
│           ▼                  │
│  ┌────────────────────────┐  │
│  │ post_execute hook ◄────│──│── Phase 2: Response validation
│  │ (Phase 1: no-op + log) │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

> Os hooks `pre_execute` e `post_execute` estão prontos para receber a Execution Engine na Fase 2 do BridgeAPI, mas na v0.1 são no-ops que apenas logam o contexto.

## Roadmap

- [x] v0.1 — Tools core de messaging, templates, analytics, media
- [ ] v0.2 — Webhook receiver para mensagens recebidas
- [ ] v0.3 — Streamable HTTP transport (para uso remoto via Gateway)
- [ ] v1.0 — Pronto para produção com rate limiting e error recovery

## Ecossistema BridgeAPI

| Conector | Status |
|----------|--------|
| **WhatsApp Business API** | ✅ v0.1 |
| Hotmart | 🔜 Em desenvolvimento |
| Eduzz | 🔜 Planejado |
| Pix / Pagamentos | 🔜 Planejado |
| NFe / Notas Fiscais | 🔜 Planejado |
| Guru | 🔜 Planejado |

## Licença

MIT — use livremente.

## Links

- [BridgeAPI](https://bridgeapi.com.br) — Plataforma gerenciada
- [MCP Specification](https://modelcontextprotocol.io/) — Protocolo oficial
- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api) — Documentação da Meta
