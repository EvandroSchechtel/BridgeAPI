const connectors = [
  { type: "whatsapp", name: "WhatsApp Business API", status: "active", tools: 16, icon: "💬" },
  { type: "hotmart", name: "Hotmart", status: "coming_soon", tools: 0, icon: "🔥" },
  { type: "eduzz", name: "Eduzz", status: "coming_soon", tools: 0, icon: "📦" },
  { type: "pix", name: "Pix / Pagamentos", status: "planned", tools: 0, icon: "💰" },
  { type: "nfe", name: "NFe / Notas Fiscais", status: "planned", tools: 0, icon: "📄" },
  { type: "guru", name: "Guru", status: "planned", tools: 0, icon: "🧘" },
  { type: "hubbla", name: "Hubbla", status: "planned", tools: 0, icon: "🌐" },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "bg-green" },
  coming_soon: { label: "Em breve", color: "bg-yellow" },
  planned: { label: "Planejado", color: "bg-text-muted" },
};

export default function ConnectorsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Conectores MCP</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connectors.map((c) => {
          const status = statusLabels[c.status];
          return (
            <div
              key={c.type}
              className="bg-surface border border-border rounded-xl p-6 hover:border-green/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">{c.icon}</span>
                <span className={`text-xs px-2 py-1 rounded-full text-bg ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <h3 className="font-semibold text-lg">{c.name}</h3>
              <p className="text-text-muted text-sm mt-1">
                {c.tools > 0 ? `${c.tools} tools disponiveis` : "Em desenvolvimento"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
