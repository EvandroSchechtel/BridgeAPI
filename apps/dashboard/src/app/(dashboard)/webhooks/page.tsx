"use client";

import { useState } from "react";
import { Plus, Webhook, CheckCircle2, XCircle, Trash2, TestTube, Globe, Bell } from "lucide-react";

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  status: "active" | "inactive";
  lastDelivery: string;
  deliveryRate: number;
  createdAt: string;
}

const mockWebhooks: WebhookConfig[] = [
  { id: "1", url: "https://api.meuapp.com/webhooks/bridgeapi", events: ["error", "rate_limit"], status: "active", lastDelivery: "3 min atras", deliveryRate: 99.2, createdAt: "2026-03-10" },
  { id: "2", url: "https://hooks.slack.com/services/T00/B00/xxx", events: ["error"], status: "active", lastDelivery: "1 hora atras", deliveryRate: 100, createdAt: "2026-03-15" },
];

const eventTypes = [
  { key: "error", label: "Erro de execucao", desc: "Quando um tool call falha" },
  { key: "rate_limit", label: "Rate limit", desc: "Quando rate limit e atingido" },
  { key: "escalation", label: "Escalonamento", desc: "Phase 2: quando acao precisa decisao humana" },
  { key: "anomaly", label: "Anomalia", desc: "Phase 2: quando padrao atipico e detectado" },
];

export default function WebhooksPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-text-muted text-sm">Receba notificacoes em tempo real de eventos do Gateway.</p>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-green px-4 py-2.5 text-sm font-semibold text-bg hover:bg-green-hover transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Webhook
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface border border-green/20 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm">Criar webhook</h3>
          <div>
            <label className="block text-xs text-text-muted mb-1.5">URL do endpoint</label>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-text-muted" />
              <input
                type="url"
                placeholder="https://api.seuapp.com/webhooks/bridgeapi"
                className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-green focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-2">Eventos</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {eventTypes.map((ev) => (
                <label
                  key={ev.key}
                  className="flex items-start gap-3 p-3 bg-bg border border-border rounded-lg cursor-pointer hover:border-green/20 transition-colors"
                >
                  <input type="checkbox" className="mt-0.5 accent-green" defaultChecked={ev.key === "error"} />
                  <div>
                    <p className="text-xs font-medium">{ev.label}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{ev.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text rounded-lg hover:bg-surface-hover transition-colors">
              Cancelar
            </button>
            <button className="px-4 py-2 text-sm font-semibold bg-green text-bg rounded-lg hover:bg-green-hover transition-colors">
              Criar webhook
            </button>
          </div>
        </div>
      )}

      {/* Webhooks list */}
      <div className="space-y-3">
        {mockWebhooks.map((wh) => (
          <div key={wh.id} className="bg-surface border border-border rounded-xl p-5 hover:border-green/20 transition-colors" data-webhook-id={wh.id}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green/10 flex items-center justify-center">
                  <Webhook className="w-5 h-5 text-green" />
                </div>
                <div>
                  <p className="font-mono text-xs">{wh.url}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {wh.events.map((ev) => (
                      <span key={ev} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-muted">{ev}</span>
                    ))}
                  </div>
                </div>
              </div>
              <span className={`text-[11px] px-2 py-1 rounded-md font-medium ${
                wh.status === "active" ? "bg-green/15 text-green" : "bg-text-muted/15 text-text-muted"
              }`}>
                {wh.status === "active" ? "Ativo" : "Inativo"}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-6 text-xs text-text-muted">
              <span>Ultima entrega: {wh.lastDelivery}</span>
              <span>Taxa: {wh.deliveryRate}%</span>
              <span>Criado: {wh.createdAt}</span>
              <div className="flex items-center gap-1 ml-auto">
                <button className="p-1.5 rounded hover:bg-surface-hover" aria-label="Testar"><TestTube className="w-3.5 h-3.5" /></button>
                <button className="p-1.5 rounded hover:bg-red/10" aria-label="Deletar"><Trash2 className="w-3.5 h-3.5 text-red" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Phase 2 preview */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <Bell className="w-5 h-5 text-yellow" />
          <h3 className="text-sm font-semibold">Phase 2 — Escalonamento</h3>
        </div>
        <p className="text-text-muted text-xs leading-relaxed">
          Na Fase 2, webhooks poderao receber eventos de escalonamento quando a Execution Engine detectar
          acoes que precisam de decisao humana. O mesmo canal, mesmo formato, novo tipo de evento.
        </p>
      </div>
    </div>
  );
}
