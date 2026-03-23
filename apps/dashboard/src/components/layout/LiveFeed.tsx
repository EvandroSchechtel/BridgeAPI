"use client";

import { useState, useEffect } from "react";
import {
  Zap, CheckCircle2, XCircle, Clock, AlertTriangle,
  MessageCircle, Flame, ShoppingCart, Package, QrCode, FileText,
  ArrowRight, Pause, Play, Filter,
} from "lucide-react";
import { ElementType } from "react";

interface FeedEvent {
  id: string;
  timestamp: Date;
  type: "action" | "trigger" | "error" | "approval";
  platform: string;
  platformIcon: ElementType;
  platformColor: string;
  title: string;
  description: string;
  status: "success" | "error" | "pending" | "running";
  automation?: string;
  details?: Record<string, string>;
}

const initialEvents: FeedEvent[] = [
  {
    id: "1", timestamp: new Date(Date.now() - 30000), type: "trigger", platform: "Hotmart",
    platformIcon: Flame, platformColor: "#F59E0B",
    title: "Venda detectada", description: "Curso Master Pro — R$497,00",
    status: "success", automation: "Venda → WhatsApp + NFe",
    details: { "Comprador": "João Silva", "Email": "joao@email.com", "Produto": "Curso Master Pro" },
  },
  {
    id: "2", timestamp: new Date(Date.now() - 28000), type: "action", platform: "WhatsApp",
    platformIcon: MessageCircle, platformColor: "#25D366",
    title: "Mensagem enviada", description: "Template 'boas_vindas' → +5541999990001",
    status: "success", automation: "Venda → WhatsApp + NFe",
    details: { "Para": "+5541999990001", "Template": "boas_vindas", "Latência": "234ms" },
  },
  {
    id: "3", timestamp: new Date(Date.now() - 25000), type: "action", platform: "NFe",
    platformIcon: FileText, platformColor: "#14B8A6",
    title: "Nota fiscal emitida", description: "NFe #1234 — R$497,00 — SEFAZ autorizada",
    status: "success", automation: "Venda → WhatsApp + NFe",
    details: { "Número": "1234", "Chave": "3526031234...890", "Status": "Autorizada" },
  },
  {
    id: "4", timestamp: new Date(Date.now() - 180000), type: "trigger", platform: "Mercado Livre",
    platformIcon: ShoppingCart, platformColor: "#3B82F6",
    title: "Novo pedido", description: "iPhone 15 Pro Max — R$7.499,00",
    status: "success", automation: "Pedido ML → Expedição",
    details: { "Pedido": "MLB2048576321", "Comprador": "COMPRADOR_ML", "Frete": "Mercado Envios" },
  },
  {
    id: "5", timestamp: new Date(Date.now() - 175000), type: "action", platform: "WhatsApp",
    platformIcon: MessageCircle, platformColor: "#25D366",
    title: "Confirmação enviada", description: "Pedido confirmado → comprador ML",
    status: "success", automation: "Pedido ML → Expedição",
  },
  {
    id: "6", timestamp: new Date(Date.now() - 600000), type: "error", platform: "WhatsApp",
    platformIcon: MessageCircle, platformColor: "#25D366",
    title: "Falha no envio", description: "Template 'promo_natal' não aprovado pela Meta",
    status: "error", automation: "Campanha Marketing",
    details: { "Erro": "Template not found (132000)", "Ação": "Aguardando aprovação da Meta" },
  },
  {
    id: "7", timestamp: new Date(Date.now() - 900000), type: "approval", platform: "Pix",
    platformIcon: QrCode, platformColor: "#EC4899",
    title: "Aprovação necessária", description: "Reembolso de R$297,00 — aguardando sua confirmação",
    status: "pending", automation: "Reembolso automático",
    details: { "Valor": "R$297,00", "Cliente": "Maria Santos", "Motivo": "Solicitação do cliente" },
  },
  {
    id: "8", timestamp: new Date(Date.now() - 1800000), type: "trigger", platform: "Eduzz",
    platformIcon: Package, platformColor: "#8B5CF6",
    title: "Assinatura cancelada", description: "Mentoria Pro — Ana Oliveira",
    status: "success", automation: "Cancelamento → Retenção",
    details: { "Assinante": "Ana Oliveira", "Motivo": "Muito caro", "Tempo": "3 meses" },
  },
  {
    id: "9", timestamp: new Date(Date.now() - 1795000), type: "action", platform: "WhatsApp",
    platformIcon: MessageCircle, platformColor: "#25D366",
    title: "Retenção enviada", description: "Cupom 20% OFF enviado para Ana Oliveira",
    status: "success", automation: "Cancelamento → Retenção",
  },
];

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h atrás`;
}

export function LiveFeed() {
  const [events, setEvents] = useState(initialEvents);
  const [paused, setPaused] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Update timestamps every 10s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const statusConfig = {
    success: { icon: CheckCircle2, color: "text-green", bg: "bg-green/10", label: "Concluído" },
    error: { icon: XCircle, color: "text-red", bg: "bg-red/10", label: "Erro" },
    pending: { icon: Clock, color: "text-yellow", bg: "bg-yellow/10", label: "Aguardando" },
    running: { icon: Zap, color: "text-blue", bg: "bg-blue/10", label: "Executando" },
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold">Live Feed</h1>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green" />
            </span>
            <span className="text-[11px] text-green font-medium">Ao vivo</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused(!paused)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              paused
                ? "border-yellow/30 bg-yellow/10 text-yellow"
                : "border-border text-text-muted hover:bg-surface-hover"
            }`}
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {paused ? "Pausado" : "Pausar"}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="shrink-0 flex items-center gap-6 px-6 py-2.5 border-b border-border/50 bg-surface/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green" />
          <span className="text-[11px] text-text-muted">Hoje:</span>
          <span className="text-[11px] font-semibold">47 ações</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3 h-3 text-green" />
          <span className="text-[11px] text-text-muted">43 sucesso</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="w-3 h-3 text-red" />
          <span className="text-[11px] text-text-muted">3 erros</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-yellow" />
          <span className="text-[11px] text-text-muted">1 pendente</span>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {events.map((event, index) => {
          const st = statusConfig[event.status];
          const StatusIcon = st.icon;
          const PlatformIcon = event.platformIcon;
          const isExpanded = expandedId === event.id;

          // Check if this event starts a new automation group
          const prevEvent = index > 0 ? events[index - 1] : null;
          const isNewGroup = !prevEvent || prevEvent.automation !== event.automation;

          return (
            <div key={event.id}>
              {/* Automation group header */}
              {isNewGroup && event.automation && (
                <div className="flex items-center gap-2 mt-4 mb-2 first:mt-0">
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="text-[10px] text-text-muted uppercase tracking-wider px-2">
                    {event.automation}
                  </span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
              )}

              {/* Event card */}
              <div
                className={`rounded-xl border transition-all cursor-pointer ${
                  event.status === "error"
                    ? "bg-red/5 border-red/20 hover:border-red/40"
                    : event.status === "pending"
                    ? "bg-yellow/5 border-yellow/20 hover:border-yellow/40"
                    : "bg-surface border-border/50 hover:border-border"
                }`}
                onClick={() => setExpandedId(isExpanded ? null : event.id)}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Platform icon */}
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${event.platformColor}15` }}
                  >
                    <PlatformIcon className="w-4.5 h-4.5" style={{ color: event.platformColor }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{event.title}</span>
                      {event.type === "trigger" && (
                        <ArrowRight className="w-3 h-3 text-text-muted" />
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted truncate">{event.description}</p>
                  </div>

                  {/* Status + time */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[11px] ${st.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[10px] text-text-muted w-16 text-right">
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && event.details && (
                  <div className="px-4 pb-3 pt-1 border-t border-border/30">
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {Object.entries(event.details).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-[10px] text-text-muted">{key}</p>
                          <p className="text-xs font-mono">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Action buttons for pending events */}
                    {event.status === "pending" && (
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/30">
                        <button className="px-4 py-1.5 rounded-lg bg-green text-bg text-xs font-medium hover:bg-green-hover transition-colors">
                          Aprovar
                        </button>
                        <button className="px-4 py-1.5 rounded-lg border border-red/30 text-red text-xs font-medium hover:bg-red/10 transition-colors">
                          Recusar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
