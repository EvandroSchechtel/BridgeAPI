"use client";

import { useState } from "react";
import {
  MessageCircle, Flame, Package, ShoppingCart, QrCode, FileText,
  Instagram, Store, ShoppingBag, LayoutGrid, Music, Clapperboard,
  Tag, Globe, Calendar, CalendarDays,
  Search, Filter, ArrowUpDown, ExternalLink, Settings2, Zap, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";

interface Connector {
  type: string;
  name: string;
  description: string;
  status: "active" | "configured" | "available" | "coming_soon";
  tools: number;
  icon: React.ElementType;
  category: "messaging" | "infoprodutos" | "ecommerce" | "payments" | "fiscal" | "scheduling";
  lastSync?: string;
  callsToday?: number;
  errorRate?: number;
}

const connectors: Connector[] = [
  { type: "whatsapp", name: "WhatsApp Business", description: "Mensagens, templates, analytics, media", status: "active", tools: 16, icon: MessageCircle, category: "messaging", lastSync: "2 min atras", callsToday: 1247, errorRate: 0.3 },
  { type: "instagram-direct", name: "Instagram Direct", description: "DMs, stories, media, insights", status: "available", tools: 16, icon: Instagram, category: "messaging" },
  { type: "hotmart", name: "Hotmart", description: "Vendas, assinaturas, cupons, area de membros", status: "active", tools: 14, icon: Flame, category: "infoprodutos", lastSync: "5 min atras", callsToday: 423, errorRate: 1.2 },
  { type: "eduzz", name: "Eduzz", description: "Vendas, produtos, financeiro, afiliados", status: "active", tools: 14, icon: Package, category: "infoprodutos", lastSync: "8 min atras", callsToday: 189, errorRate: 0.0 },
  { type: "mercadolivre", name: "Mercado Livre", description: "Items, pedidos, perguntas, envios", status: "active", tools: 20, icon: ShoppingCart, category: "ecommerce", lastSync: "1 min atras", callsToday: 3421, errorRate: 0.8 },
  { type: "shopify", name: "Shopify", description: "Produtos, pedidos, clientes, estoque", status: "available", tools: 16, icon: ShoppingBag, category: "ecommerce" },
  { type: "nuvemshop", name: "Nuvemshop", description: "Produtos, pedidos, clientes, cupons", status: "available", tools: 16, icon: Store, category: "ecommerce" },
  { type: "loja-integrada", name: "Loja Integrada", description: "Catalogo, pedidos, categorias, frete", status: "available", tools: 16, icon: LayoutGrid, category: "ecommerce" },
  { type: "tiktok", name: "TikTok", description: "Videos, comments, analytics, hashtags", status: "available", tools: 16, icon: Music, category: "messaging" },
  { type: "tiktok-shop", name: "TikTok Shop", description: "Produtos, pedidos, envios, estoque", status: "available", tools: 16, icon: Clapperboard, category: "ecommerce" },
  { type: "shopee", name: "Shopee", description: "Produtos, pedidos, chat, logistica", status: "available", tools: 16, icon: Tag, category: "ecommerce" },
  { type: "temu", name: "Temu", description: "Produtos, pedidos, estoque, financeiro", status: "available", tools: 16, icon: Globe, category: "ecommerce" },
  { type: "pix", name: "Pix", description: "Cobrancas, pagamentos, QR Code, webhooks", status: "available", tools: 16, icon: QrCode, category: "payments" },
  { type: "nfe", name: "Nota Fiscal", description: "NFe, NFSe, NFCe, PDF/XML", status: "available", tools: 16, icon: FileText, category: "fiscal" },
  { type: "calendly", name: "Calendly", description: "Eventos, disponibilidade, webhooks", status: "available", tools: 16, icon: Calendar, category: "scheduling" },
  { type: "google-calendar", name: "Google Calendar", description: "Eventos, calendarios, free/busy", status: "available", tools: 16, icon: CalendarDays, category: "scheduling" },
];

const categoryLabels: Record<string, string> = {
  messaging: "Messaging",
  infoprodutos: "Infoprodutos",
  ecommerce: "E-commerce",
  payments: "Pagamentos",
  fiscal: "Fiscal",
  scheduling: "Agenda",
};

const statusConfig = {
  active: { label: "Ativo", color: "bg-green/15 text-green border-green/20", icon: CheckCircle2 },
  configured: { label: "Configurado", color: "bg-blue/15 text-blue border-blue/20", icon: Settings2 },
  available: { label: "Disponivel", color: "bg-text-muted/15 text-text-muted border-border", icon: Zap },
  coming_soon: { label: "Em breve", color: "bg-yellow/15 text-yellow border-yellow/20", icon: Clock },
};

export default function ConnectorsPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = connectors.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  const activeCount = connectors.filter((c) => c.status === "active").length;
  const totalTools = connectors.reduce((sum, c) => sum + c.tools, 0);
  const totalCalls = connectors.reduce((sum, c) => sum + (c.callsToday || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          { label: "Conectores ativos", value: activeCount.toString(), sub: `de ${connectors.length} disponiveis` },
          { label: "Tools totais", value: totalTools.toString(), sub: "disponiveis no ecossistema" },
          { label: "Calls hoje", value: totalCalls.toLocaleString("pt-BR"), sub: "tool calls executadas" },
          { label: "Uptime", value: "99.8%", sub: "ultimos 30 dias" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-text-muted text-xs">{kpi.label}</p>
            <p className="text-2xl font-bold mt-1">{kpi.value}</p>
            <p className="text-text-muted text-[11px] mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar conector..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg pl-10 pr-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-green focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-text-muted" />
          {["all", ...Object.keys(categoryLabels)].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? "bg-green/15 text-green border border-green/20"
                  : "text-text-muted hover:text-text hover:bg-surface-hover border border-transparent"
              }`}
            >
              {cat === "all" ? "Todos" : categoryLabels[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Connector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((c) => {
          const status = statusConfig[c.status];
          const StatusIcon = status.icon;
          const Icon = c.icon;

          return (
            <div
              key={c.type}
              className={`group relative bg-surface border rounded-xl p-5 transition-all duration-200 cursor-pointer ${
                c.status === "active"
                  ? "border-green/20 hover:border-green/40 hover:shadow-lg hover:shadow-green/5"
                  : "border-border hover:border-text-muted/30 hover:shadow-lg hover:shadow-white/5"
              }`}
              data-connector={c.type}
              data-status={c.status}
              aria-label={`Conector ${c.name} — ${status.label}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    c.status === "active" ? "bg-green/10" : "bg-surface-hover"
                  }`}>
                    <Icon className={`w-5 h-5 ${c.status === "active" ? "text-green" : "text-text-muted"}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{c.name}</h3>
                    <p className="text-text-muted text-xs mt-0.5">{c.tools} tools</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border ${status.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </span>
              </div>

              {/* Description */}
              <p className="text-text-muted text-xs leading-relaxed mb-4">{c.description}</p>

              {/* Metrics (active only) */}
              {c.status === "active" && (
                <div className="flex items-center gap-4 pt-3 border-t border-border">
                  <div>
                    <p className="text-[10px] text-text-muted">Calls hoje</p>
                    <p className="text-sm font-semibold">{c.callsToday?.toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted">Erro</p>
                    <p className={`text-sm font-semibold ${(c.errorRate || 0) > 1 ? "text-yellow" : "text-green"}`}>
                      {c.errorRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted">Sync</p>
                    <p className="text-xs text-text-muted">{c.lastSync}</p>
                  </div>
                  <button className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-surface-hover">
                    <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
                  </button>
                </div>
              )}

              {/* Configure button (available only) */}
              {c.status === "available" && (
                <button className="w-full mt-2 py-2 rounded-lg border border-border text-xs text-text-muted hover:text-text hover:border-green/30 hover:bg-green/5 transition-colors">
                  Configurar conector
                </button>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">Nenhum conector encontrado</p>
        </div>
      )}
    </div>
  );
}
