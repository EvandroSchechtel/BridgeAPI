"use client";

import {
  MessageCircle, Flame, Package, ShoppingCart, QrCode, FileText,
  Instagram, Store, ShoppingBag, Music, Calendar, CalendarDays,
  Tag, Globe, Clapperboard, LayoutGrid,
  ChevronLeft, ChevronRight, Settings, Zap, Plus, Bell,
} from "lucide-react";
import { ElementType } from "react";

interface Platform {
  id: string;
  name: string;
  icon: ElementType;
  connected: boolean;
  active: boolean;
  color: string;
}

const platforms: Platform[] = [
  { id: "whatsapp", name: "WhatsApp", icon: MessageCircle, connected: true, active: true, color: "#25D366" },
  { id: "hotmart", name: "Hotmart", icon: Flame, connected: true, active: true, color: "#F59E0B" },
  { id: "mercadolivre", name: "Mercado Livre", icon: ShoppingCart, connected: true, active: true, color: "#3B82F6" },
  { id: "eduzz", name: "Eduzz", icon: Package, connected: true, active: true, color: "#8B5CF6" },
  { id: "pix", name: "Pix", icon: QrCode, connected: true, active: false, color: "#EC4899" },
  { id: "nfe", name: "Nota Fiscal", icon: FileText, connected: true, active: false, color: "#14B8A6" },
  { id: "instagram", name: "Instagram", icon: Instagram, connected: false, active: false, color: "#E1306C" },
  { id: "shopify", name: "Shopify", icon: Store, connected: false, active: false, color: "#96BF48" },
  { id: "nuvemshop", name: "Nuvemshop", icon: Globe, connected: false, active: false, color: "#6366F1" },
  { id: "loja-integrada", name: "Loja Integrada", icon: LayoutGrid, connected: false, active: false, color: "#F97316" },
  { id: "tiktok", name: "TikTok", icon: Music, connected: false, active: false, color: "#EE1D52" },
  { id: "tiktok-shop", name: "TikTok Shop", icon: Clapperboard, connected: false, active: false, color: "#EE1D52" },
  { id: "shopee", name: "Shopee", icon: ShoppingBag, connected: false, active: false, color: "#EE4D2D" },
  { id: "temu", name: "Temu", icon: Tag, connected: false, active: false, color: "#FB7701" },
  { id: "calendly", name: "Calendly", icon: Calendar, connected: false, active: false, color: "#006BFF" },
  { id: "google-calendar", name: "Google Calendar", icon: CalendarDays, connected: false, active: false, color: "#4285F4" },
];

export function PlatformSidebar({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const connected = platforms.filter((p) => p.connected);
  const available = platforms.filter((p) => !p.connected);

  return (
    <div
      className={`h-full bg-surface border-r border-border flex flex-col transition-all duration-300 ${
        expanded ? "w-56" : "w-16"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-4 border-b border-border">
        <div className="w-9 h-9 rounded-lg bg-green/15 flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-green" />
        </div>
        {expanded && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold leading-tight">
              <span className="text-green">Bridge</span>API
            </p>
            <p className="text-[10px] text-text-muted">Agente IA</p>
          </div>
        )}
      </div>

      {/* Connected platforms */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {expanded && (
          <p className="text-[10px] text-text-muted uppercase tracking-wider px-2 mb-2">
            Conectadas
          </p>
        )}
        {connected.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors group relative"
              title={p.name}
            >
              <div className="relative shrink-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${p.color}15` }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: p.color }} />
                </div>
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${
                    p.active ? "bg-green" : "bg-yellow"
                  }`}
                />
              </div>
              {expanded && (
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-text-muted">
                    {p.active ? "Ativo" : "Configurado"}
                  </p>
                </div>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div className="border-t border-border my-3" />

        {expanded && (
          <p className="text-[10px] text-text-muted uppercase tracking-wider px-2 mb-2">
            Disponíveis
          </p>
        )}
        {available.slice(0, expanded ? undefined : 4).map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors opacity-40 hover:opacity-70"
              title={`Conectar ${p.name}`}
            >
              <div className="w-9 h-9 rounded-lg bg-surface-hover flex items-center justify-center shrink-0">
                <Icon className="w-4.5 h-4.5 text-text-muted" />
              </div>
              {expanded && (
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-xs font-medium truncate text-text-muted">{p.name}</p>
                  <p className="text-[10px] text-text-muted">Clique para conectar</p>
                </div>
              )}
            </button>
          );
        })}

        {!expanded && available.length > 4 && (
          <button className="w-full flex items-center justify-center py-2 rounded-lg hover:bg-surface-hover transition-colors opacity-40">
            <Plus className="w-4 h-4 text-text-muted" />
          </button>
        )}
      </div>

      {/* Bottom actions */}
      <div className="border-t border-border p-2 space-y-1">
        <button className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors" title="Notificações">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 relative">
            <Bell className="w-4.5 h-4.5 text-text-muted" />
            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green" />
          </div>
          {expanded && <span className="text-xs text-text-muted">Notificações</span>}
        </button>
        <button className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors" title="Configurações">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
            <Settings className="w-4.5 h-4.5 text-text-muted" />
          </div>
          {expanded && <span className="text-xs text-text-muted">Configurações</span>}
        </button>

        {/* Expand/collapse */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          {expanded ? (
            <ChevronLeft className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          )}
        </button>
      </div>
    </div>
  );
}
