export default function AnalyticsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Analytics</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Tool Calls Hoje", value: "0", change: "-" },
          { label: "Taxa de Sucesso", value: "-%", change: "-" },
          { label: "Latencia Media", value: "-ms", change: "-" },
          { label: "Conectores Ativos", value: "1", change: "WhatsApp" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-text-muted text-sm">{kpi.label}</p>
            <p className="text-2xl font-bold mt-1">{kpi.value}</p>
            <p className="text-text-muted text-xs mt-1">{kpi.change}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="font-semibold mb-4">Metricas por Periodo</h3>
        <p className="text-text-muted">
          Graficos de uso serao exibidos aqui quando houver dados de tool calls no banco.
        </p>
        <p className="text-text-muted text-sm mt-2">
          Dados coletados: volume por cliente/dia, taxa de erro, latencia, padroes de uso.
        </p>
      </div>
    </div>
  );
}
