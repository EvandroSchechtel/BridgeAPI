"use client";

import { usePathname } from "next/navigation";
import { Bell, Search, ChevronRight, Home } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/connectors": "Conectores",
  "/logs": "Logs",
  "/api-keys": "API Keys",
  "/webhooks": "Webhooks",
  "/analytics": "Analytics",
  "/settings": "Configuracoes",
};

export function Header() {
  const pathname = usePathname();
  const pageTitle = pageTitles[pathname || ""] || "Dashboard";

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2 text-sm">
        <Home className="w-3.5 h-3.5 text-text-muted" />
        <ChevronRight className="w-3 h-3 text-text-muted" />
        <span className="font-medium">{pageTitle}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-48 bg-bg border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-green focus:outline-none transition-colors"
          />
        </div>

        <button className="relative p-2 rounded-lg hover:bg-surface-hover transition-colors">
          <Bell className="w-4 h-4 text-text-muted" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green rounded-full" />
        </button>

        <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-hover transition-colors">
          <div className="w-7 h-7 rounded-full bg-green flex items-center justify-center text-bg font-bold text-xs">
            E
          </div>
        </button>
      </div>
    </header>
  );
}
