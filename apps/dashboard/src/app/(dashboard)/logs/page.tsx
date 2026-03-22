"use client";

import { useState } from "react";
import {
  Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, Eye,
} from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  connector: string;
  toolName: string;
  status: "success" | "error" | "timeout";
  latencyMs: number;
  params: string;
  clientId: string;
}

const mockLogs: LogEntry[] = [
  { id: "1", timestamp: "2026-03-22 14:23:01", connector: "whatsapp", toolName: "send_text_message", status: "success", latencyMs: 234, params: '{"to":"5541..."}', clientId: "cli_001" },
  { id: "2", timestamp: "2026-03-22 14:22:58", connector: "hotmart", toolName: "get_sales_history", status: "success", latencyMs: 891, params: '{"period":"7d"}', clientId: "cli_001" },
  { id: "3", timestamp: "2026-03-22 14:22:45", connector: "mercadolivre", toolName: "search_items", status: "success", latencyMs: 342, params: '{"query":"iphone"}', clientId: "cli_002" },
  { id: "4", timestamp: "2026-03-22 14:22:30", connector: "whatsapp", toolName: "send_template_message", status: "error", latencyMs: 5023, params: '{"to":"5511..."}', clientId: "cli_001" },
  { id: "5", timestamp: "2026-03-22 14:22:12", connector: "pix", toolName: "create_charge", status: "success", latencyMs: 456, params: '{"valor":"49.90"}', clientId: "cli_003" },
  { id: "6", timestamp: "2026-03-22 14:21:55", connector: "eduzz", toolName: "get_sales", status: "success", latencyMs: 678, params: '{"page":1}', clientId: "cli_001" },
  { id: "7", timestamp: "2026-03-22 14:21:40", connector: "nfe", toolName: "create_nfe", status: "success", latencyMs: 1234, params: '{"valor":"150"}', clientId: "cli_002" },
  { id: "8", timestamp: "2026-03-22 14:21:22", connector: "shopify", toolName: "get_orders", status: "timeout", latencyMs: 30000, params: '{"status":"open"}', clientId: "cli_004" },
];

const statusIcons = {
  success: { icon: CheckCircle2, color: "text-green", label: "Sucesso" },
  error: { icon: XCircle, color: "text-red", label: "Erro" },
  timeout: { icon: Clock, color: "text-yellow", label: "Timeout" },
};

export default function LogsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const filtered = mockLogs.filter((log) => {
    if (search && !log.toolName.includes(search) && !log.connector.includes(search)) return false;
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    return true;
  });

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
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg pl-10 pr-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-green focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-text-muted" />
          {["all", "success", "error", "timeout"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
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

        <div className="flex items-center gap-2 ml-auto">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface-hover border border-border transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
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
                <th className="px-4 py-3 text-xs font-medium text-text-muted">Timestamp</th>
                <th className="px-4 py-3 text-xs font-medium text-text-muted">Conector</th>
                <th className="px-4 py-3 text-xs font-medium text-text-muted">Tool</th>
                <th className="px-4 py-3 text-xs font-medium text-text-muted">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-text-muted">Latencia</th>
                <th className="px-4 py-3 text-xs font-medium text-text-muted"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const st = statusIcons[log.status];
                const StatusIcon = st.icon;
                return (
                  <tr
                    key={log.id}
                    className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                    data-log-id={log.id}
                    aria-label={`Log ${log.toolName} — ${st.label}`}
                  >
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
                        {log.latencyMs}ms
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="p-1 rounded hover:bg-surface-hover">
                        <Eye className="w-3.5 h-3.5 text-text-muted" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-text-muted">{filtered.length} registros</p>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded hover:bg-surface-hover"><ChevronLeft className="w-4 h-4 text-text-muted" /></button>
            <span className="px-3 py-1 rounded bg-green/15 text-green text-xs font-medium">1</span>
            <button className="p-1.5 rounded hover:bg-surface-hover"><ChevronRight className="w-4 h-4 text-text-muted" /></button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setSelectedLog(null)}>
          <div className="bg-surface border border-border rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Detalhes do Log</h3>
              <button onClick={() => setSelectedLog(null)} className="text-text-muted hover:text-text">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Tool:</span><span className="font-mono">{selectedLog.toolName}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Conector:</span><span>{selectedLog.connector}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Status:</span><span className={statusIcons[selectedLog.status].color}>{statusIcons[selectedLog.status].label}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Latencia:</span><span className="font-mono">{selectedLog.latencyMs}ms</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Client:</span><span className="font-mono">{selectedLog.clientId}</span></div>
              <div>
                <p className="text-text-muted mb-1">Params:</p>
                <pre className="bg-bg rounded-lg p-3 text-xs font-mono overflow-auto">{selectedLog.params}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
