# BridgeAPI — Especificacao Tecnica Completa dos MCP Servers

> Documento de referencia para refinamento de cada conector MCP baseado na documentacao oficial de cada plataforma.

---

## 1. WhatsApp Business Cloud API

**Docs**: https://developers.facebook.com/docs/whatsapp/cloud-api
**Base URL**: `https://graph.facebook.com/v21.0`
**Auth**: Bearer token (System User Token)

### Tools Atuais (16) — JA IMPLEMENTADOS COM QUALIDADE
O mcp-whatsapp ja tem implementacao detalhada. Verificar e adicionar:

### Tools a Adicionar
| Tool | Endpoint | Descricao |
|------|----------|-----------|
| `send_reaction` | POST /{phone}/messages | Enviar reacao (emoji) a uma mensagem |
| `send_sticker` | POST /{phone}/messages | Enviar sticker (webp) |
| `get_media_url` | GET /{media_id} | Obter URL de download de media (valida 5min) |
| `delete_media` | DELETE /{media_id} | Deletar media enviada |
| `get_qr_code` | GET /{phone}/message_qrdls | Obter QR codes de entrada |
| `create_qr_code` | POST /{phone}/message_qrdls | Criar QR code para iniciar conversa |
| `register_phone` | POST /{phone}/register | Registrar numero de telefone |
| `deregister_phone` | POST /{phone}/deregister | Desregistrar numero |
| `get_commerce_settings` | GET /{phone}/whatsapp_commerce_settings | Config de comercio |
| `update_commerce_settings` | POST /{phone}/whatsapp_commerce_settings | Atualizar config comercio |
| `create_flow` | POST /{waba}/flows | Criar WhatsApp Flow |
| `get_flows` | GET /{waba}/flows | Listar Flows |
| `send_flow_message` | POST /{phone}/messages | Enviar mensagem com Flow |
| `two_step_verification` | POST /{phone} | Configurar verificacao 2 passos |

### Regras de Negocio Criticas
- **Janela de 24h**: mensagens de texto/midia so funcionam dentro da janela
- **Templates**: obrigatorios fora da janela, sujeitos a aprovacao da Meta (24-48h)
- **Template Pacing**: campanhas de marketing comecam com ~1.000 envios e escalam
- **Rate Limits**: 80 mensagens/segundo por numero; 250.000 conversas/mes no tier inicial
- **Quality Rating**: GREEN/YELLOW/RED — afeta limites de envio
- **Pricing BR 2024**: Marketing R$0,30/msg, Utility R$0,08/msg, Service gratis (24h)

---

## 2. Hotmart API

**Docs**: https://developers.hotmart.com
**Base URL**: `https://developers.hotmart.com/payments/api/v1`
**Auth**: OAuth2 client_credentials → `https://api-sec-vlc.hotmart.com/security/oauth/token`

### Tools Completos (expandidos)
| Tool | Endpoint | Descricao |
|------|----------|-----------|
| `get_sales_history` | GET /sales/history | Historico de vendas com filtros |
| `get_sale_summary` | GET /sales/summary | Resumo de venda por transaction |
| `get_sale_participants` | GET /sales/users | Participantes (afiliado, produtor, comprador) |
| `get_sale_commissions` | GET /sales/commissions | Comissoes por venda |
| `get_sale_price_details` | GET /sales/price/details | Detalhes de preco (parcelas, desconto) |
| `get_subscriptions` | GET /subscriptions | Listar assinaturas com filtros |
| `get_subscription` | GET /subscriptions/{code} | Detalhes de assinatura |
| `cancel_subscription` | POST /subscriptions/{code}/cancel | Cancelar assinatura |
| `reactivate_subscription` | POST /subscriptions/{code}/reactivate | Reativar |
| `change_due_day` | POST /subscriptions/{code}/change-due-day | Mudar dia vencimento |
| `get_subscription_purchases` | GET /subscriptions/{code}/purchases | Compras da assinatura |
| `get_products` | GET /products | Listar produtos |
| `get_modules` | GET /club/{product}/modules | Modulos da area de membros |
| `get_pages` | GET /club/{product}/modules/{module}/pages | Paginas de um modulo |
| `get_student_progress` | GET /club/{product}/users | Progresso do aluno |
| `get_coupons` | GET /coupons | Listar cupons |
| `create_coupon` | POST /coupons | Criar cupom de desconto |
| `delete_coupon` | DELETE /coupons/{code} | Deletar cupom |

### Regras de Negocio
- **Webhook events**: PURCHASE_COMPLETE, PURCHASE_CANCELED, PURCHASE_REFUNDED, PURCHASE_CHARGEBACK, PURCHASE_EXPIRED, SUBSCRIPTION_CANCELLATION, SWITCH_PLAN
- **Comissoes**: Produtor + Afiliado + Co-produtor — cada um com percentual
- **Assinaturas**: podem ter periodos: MONTHLY, QUARTERLY, SEMIANNUALLY, YEARLY
- **Area de membros**: progresso trackado por modulo/pagina

---

## 3. Mercado Livre API

**Docs**: https://developers.mercadolivre.com.br
**Base URL**: `https://api.mercadolibre.com`
**Auth**: OAuth2 com refresh token

### Tools Completos (expandidos)
| Tool | Endpoint | Descricao |
|------|----------|-----------|
| `search_items` | GET /sites/MLB/search | Buscar items no marketplace |
| `get_item` | GET /items/{id} | Detalhes do item |
| `create_item` | POST /items | Criar anuncio |
| `update_item` | PUT /items/{id} | Atualizar anuncio |
| `pause_item` | PUT /items/{id} (status:paused) | Pausar anuncio |
| `activate_item` | PUT /items/{id} (status:active) | Reativar |
| `delete_item` | PUT /items/{id} (status:closed) | Encerrar anuncio |
| `get_item_description` | GET /items/{id}/description | Descricao do item |
| `update_item_description` | PUT /items/{id}/description | Atualizar descricao |
| `get_item_variations` | GET /items/{id}/variations | Variacoes (tamanho, cor) |
| `add_item_variation` | POST /items/{id}/variations | Adicionar variacao |
| `get_item_pictures` | GET /items/{id}/pictures | Fotos do item |
| `get_item_visits` | GET /items/{id}/visits/time_window | Visitas por periodo |
| `get_orders` | GET /orders/search | Pedidos do vendedor |
| `get_order` | GET /orders/{id} | Detalhes do pedido |
| `get_order_notes` | GET /orders/{id}/notes | Notas do pedido |
| `create_order_note` | POST /orders/{id}/notes | Adicionar nota |
| `get_shipment` | GET /shipments/{id} | Detalhes do envio |
| `get_shipment_label` | GET /shipments/{id}/label | Etiqueta de envio (PDF) |
| `get_shipment_tracking` | GET /shipments/{id}/tracking | Rastreamento |
| `get_questions` | GET /questions/search | Perguntas recebidas |
| `answer_question` | POST /answers | Responder pergunta |
| `delete_question` | DELETE /questions/{id} | Deletar pergunta |
| `get_messages` | GET /messages/{order_id} | Mensagens pos-venda |
| `send_message` | POST /messages/packs/{pack_id}/sellers/{seller_id} | Enviar mensagem |
| `get_me` | GET /users/me | Meu perfil |
| `get_user_reputation` | GET /users/{id}/reputation | Reputacao do vendedor |
| `get_categories` | GET /sites/MLB/categories | Categorias do MLB |
| `get_category_attributes` | GET /categories/{id}/attributes | Atributos da categoria |
| `get_trends` | GET /trends/MLB | Tendencias de busca |
| `get_seller_promotions` | GET /seller-promotions/items/{id} | Promocoes do item |
| `create_promotion` | POST /seller-promotions/items/{id} | Criar promocao |
| `get_billing` | GET /users/{id}/billing | Faturamento |
| `get_claims` | GET /claims/search | Reclamacoes/disputas |

### Regras de Negocio
- **Mercado Envios Full**: estoque no fulfillment center do ML
- **Mercado Envios Coleta**: ML coleta no vendedor
- **Reputacao**: Afeta visibilidade — Verde/Amarelo/Vermelho
- **Tipos de listagem**: gold_special (destaque), gold_pro, gold, silver, bronze, free
- **Categorias**: atributos obrigatorios variam por categoria
- **Rate limits**: 10.000 requests/hora por app

---

## 4. Pix API (Banco Central)

**Docs**: https://github.com/bacen/pix-api
**Base URL**: varia por PSP (Efi, BB, Itau, Sicredi)
**Auth**: OAuth2 client_credentials com certificado mTLS

### Tools Completos
| Tool | Endpoint | Descricao |
|------|----------|-----------|
| `create_charge` | PUT /v2/cob/{txid} | Criar cobranca com txid |
| `create_immediate_charge` | POST /v2/cob | Criar cobranca imediata (txid auto) |
| `get_charge` | GET /v2/cob/{txid} | Consultar cobranca |
| `list_charges` | GET /v2/cob | Listar cobrancas por periodo |
| `update_charge` | PATCH /v2/cob/{txid} | Atualizar cobranca |
| `create_due_charge` | PUT /v2/cobv/{txid} | Cobranca com vencimento |
| `get_due_charge` | GET /v2/cobv/{txid} | Consultar cobranca com vencimento |
| `list_due_charges` | GET /v2/cobv | Listar cobrancas com vencimento |
| `create_batch_charges` | PUT /v2/lotecobv/{id} | Lote de cobrancas |
| `get_payment` | GET /v2/pix/{e2eid} | Consultar pagamento recebido |
| `list_payments` | GET /v2/pix | Listar pagamentos recebidos |
| `refund_payment` | PUT /v2/pix/{e2eid}/devolucao/{id} | Solicitar devolucao |
| `get_refund` | GET /v2/pix/{e2eid}/devolucao/{id} | Consultar devolucao |
| `generate_qr_code` | GET /v2/loc/{id}/qrcode | Gerar QR Code |
| `create_location` | POST /v2/loc | Criar location (payload) |
| `list_locations` | GET /v2/loc | Listar locations |
| `configure_webhook` | PUT /v2/webhook/{chave} | Configurar webhook |
| `get_webhook` | GET /v2/webhook/{chave} | Consultar webhook |
| `delete_webhook` | DELETE /v2/webhook/{chave} | Deletar webhook |
| `list_webhooks` | GET /v2/webhook | Listar webhooks |
| `send_pix` | POST /v2/gn/pix/send | Enviar Pix (Efi) |
| `get_balance` | GET /v2/gn/balance | Consultar saldo |

### Regras de Negocio
- **mTLS obrigatorio**: webhook recebe via mTLS (certificado ICP-Brasil)
- **Devolucao**: ate 90 dias apos pagamento original
- **txid**: 26-35 caracteres alfanumericos
- **e2eid**: End-to-End ID unico do pagamento
- **Cobranca com vencimento (cobv)**: permite juros, multa, desconto, abatimento
- **Lote**: ate 1.000 cobrancas por lote

---

## 5. NFe / NFSe / NFCe

**Docs**: https://focusnfe.com.br (ou https://enotas.com.br)
**Base URL**: varia por provider
**Auth**: Token ou API key

### Tools Completos
| Tool | Endpoint | Descricao |
|------|----------|-----------|
| `create_nfe` | POST /nfe | Emitir NFe (produto) |
| `get_nfe` | GET /nfe/{ref} | Consultar NFe |
| `list_nfe` | GET /nfe | Listar NFe emitidas |
| `cancel_nfe` | DELETE /nfe/{ref} | Cancelar NFe (justificativa obrigatoria, min 15 chars) |
| `correct_nfe` | POST /nfe/{ref}/carta_correcao | Carta de correcao |
| `resend_nfe_email` | POST /nfe/{ref}/email | Reenviar email da NFe |
| `create_nfse` | POST /nfse | Emitir NFSe (servico) |
| `get_nfse` | GET /nfse/{ref} | Consultar NFSe |
| `list_nfse` | GET /nfse | Listar NFSe |
| `cancel_nfse` | DELETE /nfse/{ref} | Cancelar NFSe |
| `create_nfce` | POST /nfce | Emitir NFCe (consumidor) |
| `get_nfce` | GET /nfce/{ref} | Consultar NFCe |
| `cancel_nfce` | DELETE /nfce/{ref} | Cancelar NFCe |
| `download_danfe` | GET /nfe/{ref}.pdf | Download DANFE (PDF) |
| `download_xml` | GET /nfe/{ref}.xml | Download XML |
| `download_nfse_pdf` | GET /nfse/{ref}.pdf | Download NFSe PDF |
| `get_sefaz_status` | GET /nfe/status_sefaz | Status da SEFAZ |
| `get_company` | GET /empresa/{cnpj} | Dados da empresa |
| `update_company` | PUT /empresa/{cnpj} | Atualizar empresa |
| `create_company` | POST /empresa | Cadastrar empresa |

### Regras de Negocio
- **NFe**: nota fiscal de produto — CFOP, NCM, ICMS, IPI, PIS, COFINS
- **NFSe**: nota fiscal de servico — codigo de servico municipal, ISS
- **NFCe**: nota fiscal de consumidor (cupom fiscal eletronico)
- **Cancelamento**: ate 24h apos emissao, justificativa min 15 chars
- **Carta de correcao**: max 20 por NFe, nao corrige valores/impostos
- **NFSe Nacional**: obrigatoria a partir de 01/01/2026

---

## 6. Instagram Direct API

**Docs**: https://developers.facebook.com/docs/instagram-platform
**Base URL**: `https://graph.instagram.com/v21.0`
**Auth**: Bearer token (Page Access Token)

### Tools Completos
| Tool | Endpoint | Descricao |
|------|----------|-----------|
| `send_text_message` | POST /me/messages | Enviar texto via DM |
| `send_image` | POST /me/messages | Enviar imagem |
| `send_video` | POST /me/messages | Enviar video |
| `send_audio` | POST /me/messages | Enviar audio |
| `send_sticker` | POST /me/messages | Enviar sticker |
| `send_quick_replies` | POST /me/messages | Enviar com respostas rapidas |
| `send_generic_template` | POST /me/messages | Template com cards |
| `send_product_template` | POST /me/messages | Template de produto |
| `set_icebreakers` | POST /me/messenger_profile | Configurar icebreakers |
| `set_persistent_menu` | POST /me/messenger_profile | Menu persistente |
| `get_conversations` | GET /me/conversations | Listar conversas |
| `get_messages` | GET /{conversation_id}/messages | Mensagens de uma conversa |
| `get_profile` | GET /me | Perfil da conta |
| `get_media` | GET /{media_id} | Detalhes de um post |
| `list_media` | GET /me/media | Listar posts |
| `get_insights` | GET /me/insights | Insights da conta |
| `get_media_insights` | GET /{media_id}/insights | Insights de um post |
| `get_story_insights` | GET /{story_id}/insights | Insights de story |
| `create_comment` | POST /{media_id}/comments | Comentar em post |
| `get_comments` | GET /{media_id}/comments | Listar comentarios |
| `reply_to_comment` | POST /{comment_id}/replies | Responder comentario |
| `hide_comment` | POST /{comment_id} (is_hidden:true) | Esconder comentario |
| `send_reaction` | POST /me/messages (reaction) | Enviar reacao |
| `mark_seen` | POST /me/messages (mark_seen) | Marcar como visto |

### Regras de Negocio
- **Iniciativa**: so pode enviar DM se o usuario enviou primeiro (human-initiated)
- **Janela de 24h**: apos 24h sem interacao, nao pode enviar mais
- **Rate limits**: 200 DMs/hora (reduzido de 5.000 em Out/2024)
- **Human Agent tag**: permite enviar fora da janela para suporte
- **Icebreakers**: max 4 perguntas pre-definidas

---

## INTEGRACOES CROSS-PLATFORM

### Fluxo 1: Venda Hotmart → WhatsApp + NFSe
1. Webhook Hotmart: PURCHASE_COMPLETE
2. → `whatsapp.send_template_message` (boas-vindas ao comprador)
3. → `nfe.create_nfse` (emitir nota fiscal de servico)
4. → `whatsapp.send_media_message` (enviar PDF da nota por WhatsApp)

### Fluxo 2: Pedido Mercado Livre → NFe + WhatsApp
1. ML webhook: novo pedido
2. → `mercadolivre.get_order` (obter detalhes)
3. → `nfe.create_nfe` (emitir NFe produto)
4. → `mercadolivre.get_shipment_label` (obter etiqueta)
5. → `whatsapp.send_text_message` (notificar comprador: "Pedido enviado!")

### Fluxo 3: Pix Recebido → WhatsApp Confirmacao
1. Webhook Pix: pagamento recebido
2. → `pix.get_payment` (detalhes)
3. → `whatsapp.send_text_message` (confirmar pagamento)
4. → `nfe.create_nfse` (emitir nota se servico)

### Fluxo 4: Suporte Instagram → Calendly
1. DM no Instagram: cliente quer agendar
2. → `instagram.send_text_message` (enviar link Calendly)
3. → `calendly.get_user_availability` (verificar disponibilidade)
4. → Webhook Calendly: evento agendado
5. → `google_calendar.create_event` (criar no Google Calendar)
6. → `whatsapp.send_template_message` (confirmar agendamento)

### Fluxo 5: Multichannel E-commerce
1. Produto criado no Shopify
2. → `nuvemshop.create_product` (replicar)
3. → `mercadolivre.create_item` (replicar)
4. → `shopee.create_product` (replicar)
5. → `tiktok_shop.create_product` (replicar)
6. Quando vende em qualquer plataforma:
7. → Atualizar estoque em TODAS as plataformas
8. → `nfe.create_nfe` (emitir nota)
9. → `whatsapp.send_template_message` (notificar)

### Fluxo 6: Assinatura Cancelada → Retencao
1. Webhook Hotmart: SUBSCRIPTION_CANCELLATION
2. → `hotmart.get_subscription` (motivo do cancelamento)
3. → `whatsapp.send_interactive_message` (oferta de retencao com botoes)
4. → Se aceitar: `hotmart.reactivate_subscription` + `pix.create_charge` (desconto)
5. → Se recusar: `instagram.send_text_message` (pesquisa de satisfacao)

---

## DASHBOARD UX — TELAS PROPOSTAS PARA PHASE 2

### Tela: Workflow Builder (arrastar e conectar)
- Canvas visual onde o usuario conecta tools de diferentes plataformas
- Triggers: webhooks de qualquer plataforma
- Actions: tools de qualquer MCP
- Conditions: if/else baseado em dados
- Exemplo: "Quando Hotmart vender → WhatsApp boas-vindas → NFSe emitir"

### Tela: Inbox Unificado
- Todas as conversas de WhatsApp + Instagram em uma tela
- AI sugere respostas baseado no contexto
- Phase 2: AI responde automaticamente com confidence scoring

### Tela: Inventario Multichannel
- Estoque unificado entre Shopify, Nuvemshop, ML, Shopee, TikTok Shop, Temu
- Alerta quando estoque baixo em qualquer plataforma
- Sincronizacao automatica

### Tela: Financeiro Consolidado
- Vendas de Hotmart + Eduzz + ML + Shopify + Shopee em um lugar
- Pix recebidos vs notas fiscais emitidas
- Conciliacao automatica

### Tela: Piloto Automatico (Phase 2)
- "847 execucoes automaticas, 3 decisoes pendentes"
- Feed de acoes tomadas pela AI
- Botoes de aprovacao/rejeicao para acoes de baixa confianca
