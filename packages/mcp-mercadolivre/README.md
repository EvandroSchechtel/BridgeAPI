# @bridgeapi/mcp-mercadolivre

**MCP Server para Mercado Livre API** — Conecte qualquer Agente de IA ao Mercado Livre via Model Context Protocol.

Parte do ecossistema **[BridgeAPI](https://bridgeapi.com.br)** — conectando agentes de IA a plataformas brasileiras.

---

## Funcionalidades

### 20 Tools (Ferramentas)

| Tool | Descrição |
|------|-----------|
| `search_items` | Buscar produtos no Mercado Livre por query, categoria ou ordenação |
| `get_item` | Obter detalhes completos de um produto pelo ID |
| `create_item` | Criar um novo anúncio no Mercado Livre |
| `update_item` | Atualizar preço, estoque, status ou título de um anúncio |
| `pause_item` | Pausar um anúncio ativo |
| `activate_item` | Reativar um anúncio pausado |
| `delete_item` | Excluir (encerrar) um anúncio permanentemente |
| `get_item_description` | Obter a descrição em texto de um produto |
| `update_item_description` | Atualizar a descrição de um produto |
| `get_orders` | Listar pedidos (filtrar por status: paid, shipped, delivered) |
| `get_order` | Obter detalhes completos de um pedido |
| `get_questions` | Listar perguntas recebidas (filtrar por item ou status) |
| `answer_question` | Responder uma pergunta de comprador |
| `get_messages` | Obter mensagens de um pedido |
| `send_message` | Enviar mensagem para comprador de um pedido |
| `get_me` | Obter informações da sua conta Mercado Livre |
| `get_categories` | Listar categorias do site (MLB, MLA, MLM) |
| `get_category_attributes` | Obter atributos obrigatórios de uma categoria |
| `get_shipment_tracking` | Rastrear envio de um pedido |
| `get_item_visits` | Obter estatísticas de visitas de um produto |

### 3 Resources (Recursos)

| Resource | URI | Descrição |
|----------|-----|-----------|
| orders | `meli://orders` | Últimos 50 pedidos do vendedor |
| items | `meli://items` | Anúncios ativos do vendedor |
| me | `meli://me` | Informações da conta do vendedor |

### 3 Prompts (Templates)

| Prompt | Descrição |
|--------|-----------|
| `listing-creator` | Guia para criar anúncios otimizados no Mercado Livre |
| `order-manager` | Guia para gerenciar pedidos e envios |
| `question-responder` | Guia para responder perguntas de compradores |

---

## Instalacao

### Passo 1: Obtenha credenciais no Mercado Livre

1. Acesse [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br/)
2. Crie uma aplicacao
3. Obtenha: `APP_ID`, `CLIENT_SECRET`, `ACCESS_TOKEN`, `REFRESH_TOKEN`

### Passo 2: Configure o Claude Desktop

Edite o arquivo de configuracao do Claude Desktop:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bridgeapi-mercadolivre": {
      "command": "npx",
      "args": ["-y", "@bridgeapi/mcp-mercadolivre"],
      "env": {
        "MELI_APP_ID": "seu-app-id",
        "MELI_CLIENT_SECRET": "seu-client-secret",
        "MELI_ACCESS_TOKEN": "seu-access-token",
        "MELI_REFRESH_TOKEN": "seu-refresh-token"
      }
    }
  }
}
```

### Configuracao para Cursor IDE

```json
{
  "mcpServers": {
    "bridgeapi-mercadolivre": {
      "command": "npx",
      "args": ["-y", "@bridgeapi/mcp-mercadolivre"],
      "env": {
        "MELI_APP_ID": "seu-app-id",
        "MELI_CLIENT_SECRET": "seu-client-secret",
        "MELI_ACCESS_TOKEN": "seu-access-token",
        "MELI_REFRESH_TOKEN": "seu-refresh-token"
      }
    }
  }
}
```

---

## Variaveis de Ambiente

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `MELI_APP_ID` | Sim | App ID da aplicacao no Mercado Livre |
| `MELI_CLIENT_SECRET` | Sim | Client Secret da aplicacao |
| `MELI_ACCESS_TOKEN` | Sim | Token de acesso OAuth2 |
| `MELI_REFRESH_TOKEN` | Sim | Token de refresh OAuth2 |
| `MELI_SITE_ID` | Nao | Site do Mercado Livre (default: MLB) |

### Sites disponiveis

| Site ID | Pais |
|---------|------|
| MLB | Brasil |
| MLA | Argentina |
| MLM | Mexico |
| MLC | Chile |
| MLU | Uruguai |
| MCO | Colombia |

---

## Exemplos de Uso

### Buscar produtos
```
"Busque notebooks gamer no Mercado Livre ordenados por preco"
→ search_items(query: "notebook gamer", sort: "price_asc")
```

### Criar anuncio
```
"Crie um anuncio para iPhone 15 Pro 256GB, novo, por R$ 6.499,90"
→ Use o prompt 'listing-creator' para guiar a criacao completa
```

### Responder perguntas
```
"Responda todas as perguntas pendentes dos meus anuncios"
→ Use o prompt 'question-responder' para respostas profissionais
```

### Gerenciar pedidos
```
"Mostre os pedidos pagos que preciso enviar"
→ get_orders(status: "paid")
```

### Rastrear envio
```
"Qual o status do envio do pedido 123456789?"
→ get_order(order_id: "123456789") + get_shipment_tracking(shipment_id: "...")
```

### Analisar desempenho
```
"Quantas visitas meu anuncio MLB1234567890 teve esta semana?"
→ get_item_visits(item_id: "MLB1234567890", date_from: "2026-03-15", date_to: "2026-03-22")
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    AI Agent (Claude, etc.)           │
└────────────────────────┬────────────────────────────┘
                         │ MCP Protocol (stdio)
┌────────────────────────┴────────────────────────────┐
│           @bridgeapi/mcp-mercadolivre               │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  20 Tools   │  │  3 Resources │  │ 3 Prompts │  │
│  └──────┬──────┘  └──────────────┘  └───────────┘  │
│         │                                           │
│  ┌──────┴──────────────────────────────────┐        │
│  │        executeWithHooks() wrapper       │        │
│  │  ┌─────────────┐  ┌──────────────────┐  │        │
│  │  │ preExecute  │  │  postExecute     │  │        │
│  │  │ Hook        │  │  Hook            │  │        │
│  │  │ (Phase 1:   │  │  (Phase 1:       │  │        │
│  │  │  allow all) │  │   accept all)    │  │        │
│  │  └─────────────┘  └──────────────────┘  │        │
│  └──────┬──────────────────────────────────┘        │
│         │                                           │
│  ┌──────┴──────────────────────────────────┐        │
│  │       MercadoLivreClient                │        │
│  │  - OAuth2 token refresh automatico      │        │
│  │  - Latency tracking                     │        │
│  │  - Error handling                       │        │
│  └──────┬──────────────────────────────────┘        │
└─────────┼───────────────────────────────────────────┘
          │ HTTPS
┌─────────┴───────────────────────────────────────────┐
│           api.mercadolibre.com                       │
│  Items · Orders · Questions · Messages · Shipping   │
└─────────────────────────────────────────────────────┘
```

### Hooks (Preparado para Phase 2)

O sistema de hooks permite que o **Execution Engine** (Phase 2) intercepte cada chamada:

- **preExecuteHook**: Avalia se a acao deve ser permitida (confidence score, regras de seguranca)
- **postExecuteHook**: Valida a resposta antes de retornar ao agente (flags, alertas)

Na Phase 1 (atual), ambos os hooks sao no-ops que sempre permitem/aceitam.

---

## Desenvolvimento

```bash
# Clonar o repositorio
git clone https://github.com/EvandroSchechtel/mcp-mercadolivre.git
cd mcp-mercadolivre

# Instalar dependencias
npm install

# Build
npm run build

# Desenvolvimento com watch
npm run dev

# Testar com MCP Inspector
npm run inspect
```

---

## Roadmap

- [x] Phase 1: MCP Server com 20 tools, 3 resources, 3 prompts
- [ ] Phase 2: Execution Engine com confidence scoring
- [ ] Phase 3: Dashboard de monitoramento
- [ ] Multi-seller: Gerenciar multiplas contas
- [ ] Webhooks: Notificacoes em tempo real do ML
- [ ] Analytics: Relatorios de performance

---

## Ecossistema BridgeAPI

| Pacote | Plataforma | Status |
|--------|------------|--------|
| `@bridgeapi/mcp-mercadolivre` | Mercado Livre | v0.1.0 |
| `@bridgeapi/mcp-whatsapp` | WhatsApp (Z-API) | v0.1.0 |
| `@bridgeapi/mcp-hotmart` | Hotmart | v0.1.0 |
| `@bridgeapi/mcp-eduzz` | Eduzz | v0.1.0 |
| `@bridgeapi/gateway` | API Gateway | Em desenvolvimento |

---

## Licenca

MIT - Veja [LICENSE](./LICENSE) para detalhes.

**BridgeAPI** / ESC Automacoes Digitais Ltda
