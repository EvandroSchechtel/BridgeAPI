"use client";

import { useState, useMemo } from "react";
import {
  Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Radio,
  AlertTriangle, FileJson, FileSpreadsheet,
} from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  connector: string;
  toolName: string;
  status: "success" | "error" | "timeout";
  latencyMs: number;
  params: string;
  response: string;
  errorMessage?: string;
  clientId: string;
}

const mockLogs: LogEntry[] = [
  { id: "1", timestamp: "2026-03-22 14:23:01", connector: "whatsapp", toolName: "send_text_message", status: "success", latencyMs: 234, params: '{"to": "+5541999990001", "body": "Olá! Seu pedido foi confirmado.", "preview_url": false}', response: '{"message_id": "wamid.HBgN...", "contacts": [{"wa_id": "5541999990001"}]}', clientId: "cli_001" },
  { id: "2", timestamp: "2026-03-22 14:22:58", connector: "hotmart", toolName: "get_sales_history", status: "success", latencyMs: 891, params: '{"start_date": 1710892800000, "end_date": 1711497600000, "max_results": 50}', response: '{"items": [{"transaction": "HP1234567890", "product": {"name": "Curso Master"}, "buyer": {"email": "joao@email.com"}, "purchase": {"price": {"value": 497.0}}}], "page_info": {"total_results": 23}}', clientId: "cli_001" },
  { id: "3", timestamp: "2026-03-22 14:22:45", connector: "mercadolivre", toolName: "search_items", status: "success", latencyMs: 342, params: '{"query": "iphone 15 pro max", "category": "MLB1055", "sort": "price_asc", "limit": 20}', response: '{"results": [{"id": "MLB3456789012", "title": "iPhone 15 Pro Max 256GB", "price": 7499.0, "condition": "new"}], "paging": {"total": 1847, "offset": 0}}', clientId: "cli_002" },
  { id: "4", timestamp: "2026-03-22 14:22:30", connector: "whatsapp", toolName: "send_template_message", status: "error", latencyMs: 5023, params: '{"to": "+5511999887766", "template_name": "order_confirmation", "language": "pt_BR", "components": [{"type": "body", "parameters": [{"type": "text", "text": "Pedido #4521"}]}]}', response: '{"error": {"message": "Template not found or not approved", "type": "OAuthException", "code": 132000}}', errorMessage: "Template 'order_confirmation' não encontrado ou não aprovado. Verifique o status no Meta Business Manager.", clientId: "cli_001" },
  { id: "5", timestamp: "2026-03-22 14:22:12", connector: "pix", toolName: "create_charge", status: "success", latencyMs: 456, params: '{"txid": "cobv_2026032200001", "calendario": {"expiracao": 3600}, "devedor": {"cpf": "12345678900", "nome": "Maria Silva"}, "valor": {"original": "49.90"}, "chave": "pix@empresa.com.br"}', response: '{"txid": "cobv_2026032200001", "status": "ATIVA", "location": "pix.example.com/qr/v2/cobv/...", "pixCopiaECola": "00020126..."}', clientId: "cli_003" },
  { id: "6", timestamp: "2026-03-22 14:21:55", connector: "eduzz", toolName: "get_sales", status: "success", latencyMs: 678, params: '{"page": 1, "start_date": "2026-03-15", "end_date": "2026-03-22"}', response: '{"data": [{"sale_id": 98765, "product_name": "Mentoria Pro", "student_email": "aluno@mail.com", "sale_amount": 297.0, "sale_status": "paid"}], "paginator": {"total_pages": 3}}', clientId: "cli_001" },
  { id: "7", timestamp: "2026-03-22 14:21:40", connector: "nfe", toolName: "create_nfe", status: "success", latencyMs: 1234, params: '{"natureza_operacao": "Venda de mercadoria", "destinatario": {"cpf": "98765432100", "nome": "Carlos Santos"}, "itens": [{"descricao": "Produto X", "quantidade": 1, "valor_unitario": 150.00}]}', response: '{"id": "nfe_00001", "numero": 1234, "serie": 1, "chave_acesso": "35260312345678000195550010001234561234567890", "status": "autorizada", "xml_url": "https://api.enotas.com.br/xml/..."}', clientId: "cli_002" },
  { id: "8", timestamp: "2026-03-22 14:21:22", connector: "shopify", toolName: "get_orders", status: "timeout", latencyMs: 30000, params: '{"status": "open", "limit": 50, "created_at_min": "2026-03-01T00:00:00Z"}', response: '{}', errorMessage: "Timeout: A requisição excedeu o limite de 30s. O servidor Shopify pode estar sobrecarregado. Tente novamente com filtros mais específicos ou reduza o limit.", clientId: "cli_004" },
  { id: "9", timestamp: "2026-03-22 14:20:15", connector: "calendly", toolName: "get_scheduled_events", status: "success", latencyMs: 312, params: '{"count": 10, "status": "active", "min_start_time": "2026-03-22T00:00:00Z"}', response: '{"collection": [{"uri": "https://api.calendly.com/scheduled_events/abc123", "name": "Reunião de Onboarding", "start_time": "2026-03-22T15:00:00Z"}], "pagination": {"count": 5}}', clientId: "cli_001" },
  { id: "10", timestamp: "2026-03-22 14:19:48", connector: "mercadolivre", toolName: "get_order", status: "success", latencyMs: 287, params: '{"order_id": "MLB2048576321"}', response: '{"id": "MLB2048576321", "status": "paid", "buyer": {"nickname": "COMPRADOR123"}, "items": [{"title": "Fone Bluetooth", "quantity": 1, "unit_price": 89.90}], "shipping": {"id": 43218765}}', clientId: "cli_002" },
  { id: "11", timestamp: "2026-03-22 14:19:30", connector: "whatsapp", toolName: "send_media_message", status: "success", latencyMs: 1567, params: '{"to": "+5541999990002", "media_type": "image", "media_url": "https://cdn.example.com/promo.jpg", "caption": "Confira nossa promoção!"}', response: '{"message_id": "wamid.HBgN...2", "contacts": [{"wa_id": "5541999990002"}]}', clientId: "cli_001" },
  { id: "12", timestamp: "2026-03-22 14:18:55", connector: "hotmart", toolName: "get_subscriptions", status: "success", latencyMs: 723, params: '{"product_id": 123456, "status": "ACTIVE", "max_results": 20}', response: '{"items": [{"subscriber_code": "SUB001", "status": "ACTIVE", "plan": {"name": "Premium"}, "next_charge_date": 1711929600000}], "page_info": {"total_results": 156}}', clientId: "cli_001" },
  { id: "13", timestamp: "2026-03-22 14:18:20", connector: "pix", toolName: "get_charge", status: "error", latencyMs: 890, params: '{"txid": "cobv_invalid_id"}', response: '{"error": {"type": "https://pix.bcb.gov.br/api/v2/error/CobNaoEncontrada", "title": "Cobrança não encontrada", "status": 404, "detail": "Nenhuma cobrança com txid cobv_invalid_id"}}', errorMessage: "Cobrança com txid 'cobv_invalid_id' não encontrada. Verifique se o txid está correto.", clientId: "cli_003" },
  { id: "14", timestamp: "2026-03-22 14:17:45", connector: "nfe", toolName: "cancel_nfe", status: "success", latencyMs: 2100, params: '{"nfe_id": "nfe_00098", "justificativa": "Erro de digitação no valor do produto"}', response: '{"id": "nfe_00098", "status": "cancelada", "protocolo_cancelamento": "135260300001234", "data_cancelamento": "2026-03-22T14:17:45Z"}', clientId: "cli_002" },
  { id: "15", timestamp: "2026-03-22 14:17:10", connector: "eduzz", toolName: "get_sale_details", status: "success", latencyMs: 445, params: '{"sale_id": 98760}', response: '{"sale_id": 98760, "product_name": "Ebook Finanças", "student_name": "Ana Oliveira", "sale_amount": 47.0, "sale_status": "paid", "payment_method": "credit_card"}', clientId: "cli_001" },
  { id: "16", timestamp: "2026-03-22 14:16:30", connector: "shopify", toolName: "create_product", status: "success", latencyMs: 1890, params: '{"title": "Camiseta BridgeAPI", "body_html": "<p>Camiseta oficial</p>", "vendor": "BridgeAPI Store", "product_type": "Clothing", "variants": [{"price": "79.90", "sku": "BRIDGE-001"}]}', response: '{"product": {"id": 9876543210, "title": "Camiseta BridgeAPI", "handle": "camiseta-bridgeapi", "status": "draft", "variants": [{"id": 44445555, "price": "79.90"}]}}', clientId: "cli_004" },
  { id: "17", timestamp: "2026-03-22 14:15:50", connector: "whatsapp", toolName: "mark_message_read", status: "success", latencyMs: 98, params: '{"message_id": "wamid.HBgN...prev"}', response: '{"success": true}', clientId: "cli_001" },
  { id: "18", timestamp: "2026-03-22 14:15:22", connector: "mercadolivre", toolName: "answer_question", status: "error", latencyMs: 1200, params: '{"question_id": 999888777, "text": "Sim, temos em estoque!"}', response: '{"error": "forbidden", "message": "The caller is not authorized to perform this action", "status": 403}', errorMessage: "Permissão negada. O token de acesso não tem escopo 'write' para responder perguntas. Reautentique com escopo completo.", clientId: "cli_002" },
  { id: "19", timestamp: "2026-03-22 14:14:40", connector: "calendly", toolName: "cancel_event", status: "success", latencyMs: 534, params: '{"event_uuid": "abc123def456", "reason": "Cliente reagendou"}', response: '{"resource": {"uri": "https://api.calendly.com/scheduled_events/abc123def456", "status": "canceled", "cancellation": {"reason": "Cliente reagendou"}}}', clientId: "cli_001" },
  { id: "20", timestamp: "2026-03-22 14:14:05", connector: "hotmart", toolName: "cancel_subscription", status: "success", latencyMs: 967, params: '{"subscriber_code": "SUB089", "send_email": true}', response: '{"status": "CANCELLED_BY_SELLER", "cancellation_date": 1711119845000}', clientId: "cli_001" },
];

const connectorsList = ["whatsapp", "hotmart", "mercadolivre", "pix", "nfe", "eduzz", "shopify", "calendly"];

const statusIcons = {
  success: { icon: CheckCircle2, color: "text-green", label: "Sucesso", bg: "bg-green/10" },
  error: { icon: XCircle, color: "text-red", label: "Erro", bg: "bg-red/10" },
  timeout: { icon: Clock, color: "text-yellow", label: "Timeout", bg: "bg-yellow/10" },
};

const ITEMS_PER_PAGE = 10;

export default function LogsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [connectorFilter, setConnectorFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => mockLogs.filter((log) => {
    if (search && !log.toolName.toLowerCase().includes(search.toLowerCase()) && !log.connector.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (connectorFilter !== "all" && log.connector !== connectorFilter) return false;
    return true;
  }), [search, statusFilter, connectorFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const exportData = (format: "csv" | "json") => {
    const data = format === "json"
      ? JSON.stringify(filtered, null, 2)
      : ["timestamp,connector,tool,status,latency_ms", ...filtered.map(l => `${l.timestamp},${l.connector},${l.toolName},${l.status},${l.latencyMs}`)].join("\n");
    const blob = new Blob([data], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bridgeapi-logs.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar tool ou conector..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-surface border border-border rounded-lg pl-10 pr-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-green focus:outline-none"
          />
        </div>

        <select
          value={connectorFilter}
          onChange={(e) => { setConnectorFilter(e.target.value); setPage(1); }}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text focus:border-green focus:outline-none"
        >
          <option value="all">Todos conectores</option>
          {connectorsList.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-text-muted" />
          {["all", "success", "error", "timeout"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-green/15 text-green border border-green/20"
                  : "text-text-muted hover:text-text hover:bg-surface-hover border border-transparent"
              }`}
            >
              {s === "all" ? "Todos" : statusIcons[s as keyof typeof statusIcons].label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text focus:border-green focus:outline-none" />
          <span className="text-text-muted text-xs">até</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text focus:border-green focus:outline-none" />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green"></span>
            </span>
            <span className="text-xs text-green font-medium">Ao vivo</span>
          </div>

          {/* Auto refresh */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              autoRefresh
                ? "bg-green/15 text-green border-green/20"
                : "text-text-muted hover:text-text hover:bg-surface-hover border-border"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? "animate-pulse" : ""}`} />
            {autoRefresh ? "Auto ON" : "Auto OFF"}
          </button>

          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface-hover border border-border transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 overflow-hidden">
                <button onClick={() => exportData("csv")} className="flex items-center gap-2 px-4 py-2.5 text-xs text-text hover:bg-surface-hover w-full">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar CSV
                </button>
                <button onClick={() => exportData("json")} className="flex items-center gap-2 px-4 py-2.5 text-xs text-text hover:bg-surface-hover w-full border-t border-border">
                  <FileJson className="w-3.5 h-3.5" /> Exportar JSON
                </button>
              </div>
            )}
          </div>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface-hover border border-border transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-text-muted w-8"></th>
                <th className="px-4 py-3 text-xs font-medium text-text-muted">Timestamp</th>
                <th className="px-4 py-3 text-xs font-medium text-text-muted">Conector</th>
                <th className="px-4 py-3 text-xs font-medium text-text-muted">Tool</th>
                <th className="px-4 py-3 text-xs font-medium text-text-muted">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-text-muted">Latencia</th>
                <th className="px-4 py-3 text-xs font-medium text-text-muted">Client</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((log) => {
                const st = statusIcons[log.status];
                const StatusIcon = st.icon;
                const isExpanded = expandedId === log.id;
                return (
                  <>
                    <tr
                      key={log.id}
                      className={`border-b border-border/50 hover:bg-surface-hover/50 transition-colors cursor-pointer ${isExpanded ? "bg-surface-hover/30" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      <td className="px-4 py-3">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-green" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted font-mono">{log.timestamp}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-surface-hover font-medium">{log.connector}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{log.toolName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs ${st.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-mono ${log.latencyMs > 5000 ? "text-red" : log.latencyMs > 1000 ? "text-yellow" : "text-text-muted"}`}>
                          {log.latencyMs >= 1000 ? `${(log.latencyMs / 1000).toFixed(1)}s` : `${log.latencyMs}ms`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted font-mono">{log.clientId}</td>
                    </tr>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <tr key={`${log.id}-detail`}>
                        <td colSpan={7} className="px-4 py-0">
                          <div className="py-4 space-y-3 border-b border-green/20">
                            {/* Request */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium text-green">REQUEST</span>
                                <span className="text-xs text-text-muted font-mono">{log.connector}.{log.toolName}()</span>
                              </div>
                              <pre className="bg-bg rounded-lg p-3 text-xs font-mono text-green/80 overflow-auto max-h-40">
{JSON.stringify(JSON.parse(log.params), null, 2)}
                              </pre>
                            </div>

                            {/* Response */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs font-medium ${log.status === "success" ? "text-blue" : "text-red"}`}>RESPONSE</span>
                                <span className={`text-xs font-mono ${log.latencyMs > 5000 ? "text-red" : log.latencyMs > 1000 ? "text-yellow" : "text-text-muted"}`}>
                                  {log.latencyMs}ms
                                </span>
                              </div>
                              <pre className={`bg-bg rounded-lg p-3 text-xs font-mono overflow-auto max-h-40 ${log.status === "success" ? "text-blue/80" : "text-red/80"}`}>
{log.response !== "{}" ? JSON.stringify(JSON.parse(log.response), null, 2) : "// Sem resposta (timeout)"}
                              </pre>
                            </div>

                            {/* Error detail */}
                            {log.errorMessage && (
                              <div className={`rounded-lg p-3 ${log.status === "error" ? "bg-red/5 border border-red/20" : "bg-yellow/5 border border-yellow/20"}`}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <AlertTriangle className={`w-3.5 h-3.5 ${log.status === "error" ? "text-red" : "text-yellow"}`} />
                                  <span className={`text-xs font-medium ${log.status === "error" ? "text-red" : "text-yellow"}`}>
                                    {log.status === "error" ? "Erro" : "Timeout"}
                                  </span>
                                </div>
                                <p className="text-xs text-text-muted leading-relaxed">{log.errorMessage}</p>
                                <button className="mt-2 text-xs text-green hover:underline">Reprocessar esta chamada →</button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-text-muted">
            Mostrando {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length} registros
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 text-text-muted" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  page === p ? "bg-green/15 text-green" : "text-text-muted hover:bg-surface-hover"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
