"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PlugZap,
  ScrollText,
  KeyRound,
  Webhook,
  BarChart3,
  Settings,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/connectors", label: "Conectores", icon: PlugZap },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Configuracoes", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col shrink-0">
      <div className="p-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green flex items-center justify-center">
          <Zap className="w-4 h-4 text-bg" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">
            <span className="text-green">Bridge</span>API
          </h1>
          <p className="text-text-muted text-[10px] leading-tight">Ecosystem v0.1.0</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-green/10 text-green border border-green/20"
                  : "text-text-muted hover:text-text hover:bg-surface-hover"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mx-3 mb-3 rounded-lg bg-bg border border-border">
        <p className="text-[11px] text-text-muted leading-relaxed">
          <span className="text-green font-semibold">Phase 1</span> — Infra de Conexao
        </p>
        <p className="text-[10px] text-text-muted mt-1">16 conectores MCP ativos</p>
      </div>
    </aside>
  );
}
