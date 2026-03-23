"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageCircle, Flame, Package, ShoppingCart, QrCode, FileText,
  Instagram, Store, ShoppingBag, Music, Calendar, CalendarDays,
  Tag, Globe, Clapperboard, LayoutGrid,
  ChevronLeft, ChevronRight, Settings, Zap, Plus, Bell,
  Home, PlugZap, BarChart3, ScrollText, KeyRound, Webhook,
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

const navItems = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/connectors", label: "Conectores", icon: PlugZap },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/webhooks", label: "Webhooks", icon: Webhook },
];

export function PlatformSidebar({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
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

      {/* Navigation */}
      <div className="px-2 py-3 space-y-0.5 border-b border-border">
        {expanded && (
          <p className="text-[10px] text-text-muted uppercase tracking-wider px-2 mb-2">Menu</p>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-green/10 text-green border border-green/20"
                  : "text-text-muted hover:text-text hover:bg-surface-hover border border-transparent"
              }`}
              title={item.label}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                <Icon className={`w-4.5 h-4.5 ${isActive ? "text-green" : ""}`} />
              </div>
              {expanded && (
                <span className="text-xs font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Connected platforms */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {expanded && (
          <p className="text-[10px] text-text-muted uppercase tracking-wider px-2 mb-2">
            Plataformas
          </p>
        )}
        {connected.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.id}
              href={`/connectors/${p.id}`}
              className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors group relative"
              title={p.name}
            >
              <div className="relative shrink-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${p.color}15` }}
                >
                  <Icon className="w-4 h-4" style={{ color: p.color }} />
                </div>
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${
                    p.active ? "bg-green" : "bg-yellow"
                  }`}
                />
              </div>
              {expanded && (
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-[11px] font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-text-muted">
                    {p.active ? "Ativo" : "Configurado"}
                  </p>
                </div>
              )}
            </Link>
          );
        })}

        {expanded && available.length > 0 && (
          <>
            <div className="border-t border-border my-2" />
            <p className="text-[10px] text-text-muted uppercase tracking-wider px-2 mb-2">
              Disponíveis
            </p>
          </>
        )}
        {(expanded ? available : available.slice(0, 3)).map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.id}
              href={`/connectors/${p.id}`}
              className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors opacity-40 hover:opacity-70"
              title={`Conectar ${p.name}`}
            >
              <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-text-muted" />
              </div>
              {expanded && (
                <p className="text-[11px] text-text-muted truncate">{p.name}</p>
              )}
            </Link>
          );
        })}

        {!expanded && available.length > 3 && (
          <Link href="/connectors" className="w-full flex items-center justify-center py-1.5 rounded-lg hover:bg-surface-hover transition-colors opacity-40">
            <Plus className="w-4 h-4 text-text-muted" />
          </Link>
        )}
      </div>

      {/* Bottom */}
      <div className="border-t border-border p-2 space-y-0.5">
        <Link href="/settings" className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors" title="Configurações">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
            <Settings className="w-4.5 h-4.5 text-text-muted" />
          </div>
          {expanded && <span className="text-xs text-text-muted">Configurações</span>}
        </Link>

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
