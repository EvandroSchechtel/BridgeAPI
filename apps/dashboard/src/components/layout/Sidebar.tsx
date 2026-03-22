import Link from "next/link";

const navItems = [
  { href: "/connectors", label: "Conectores", icon: "🔌" },
  { href: "/logs", label: "Logs", icon: "📋" },
  { href: "/api-keys", label: "API Keys", icon: "🔑" },
  { href: "/webhooks", label: "Webhooks", icon: "🔗" },
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/settings", label: "Config", icon: "⚙️" },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold">
          <span className="text-green">Bridge</span>API
        </h1>
        <p className="text-text-muted text-xs mt-1">Dashboard v0.1.0</p>
      </div>
      <nav className="flex-1 px-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors mb-1"
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
