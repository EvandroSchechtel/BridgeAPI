"use client";

import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Activity, Zap, Clock, AlertTriangle, Calendar, Filter, ToggleLeft, ToggleRight } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const connectors = [
  { key: "whatsapp", name: "WhatsApp", color: "#25D366" },
  { key: "mercadolivre", name: "Mercado Livre", color: "#3B82F6" },
  { key: "hotmart", name: "Hotmart", color: "#F59E0B" },
  { key: "eduzz", name: "Eduzz", color: "#8B5CF6" },
  { key: "pix", name: "Pix", color: "#EC4899" },
  { key: "nfe", name: "NFe", color: "#14B8A6" },
  { key: "calendly", name: "Calendly", color: "#6366F1" },
  { key: "shopify", name: "Shopify", color: "#6B7280" },
];

// Generate 30 days of data
function generateDailyData() {
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(2026, 2, 22);
    d.setDate(d.getDate() - i);
    const day = d.getDate();
    const base = 800 + Math.floor(Math.sin(i * 0.5) * 400) + i * 60;
    data.push({
      date: `Mar ${day}`,
      calls: base + Math.floor(Math.random() * 200),
      errors: Math.floor(base * 0.008) + Math.floor(Math.random() * 10),
      whatsapp: Math.floor(base * 0.38),
      mercadolivre: Math.floor(base * 0.25),
      hotmart: Math.floor(base * 0.15),
      eduzz: Math.floor(base * 0.08),
      pix: Math.floor(base * 0.06),
      nfe: Math.floor(base * 0.04),
      calendly: Math.floor(base * 0.02),
      shopify: Math.floor(base * 0.02),
    });
  }
  return data;
}

const dailyData = generateDailyData();

const topTools = [
  { tool: "send_text_message", calls: 8421, connector: "whatsapp", errors: 12 },
  { tool: "search_items", calls: 5234, connector: "mercadolivre", errors: 8 },
  { tool: "get_sales_history", calls: 3102, connector: "hotmart", errors: 5 },
  { tool: "send_template_message", calls: 2847, connector: "whatsapp", errors: 34 },
  { tool: "get_orders", calls: 2156, connector: "mercadolivre", errors: 18 },
  { tool: "create_charge", calls: 1890, connector: "pix", errors: 3 },
  { tool: "create_nfe", calls: 1234, connector: "nfe", errors: 15 },
  { tool: "get_scheduled_events", calls: 987, connector: "calendly", errors: 2 },
];

const topErrors = [
  { error: "Template not found", code: 132000, connector: "whatsapp", count: 34, lastSeen: "2 min atrás" },
  { error: "Rate limit exceeded", code: 130429, connector: "mercadolivre", count: 18, lastSeen: "15 min atrás" },
  { error: "SEFAZ timeout", code: 500, connector: "nfe", count: 15, lastSeen: "1 hora atrás" },
  { error: "Token expired", code: 401, connector: "hotmart", count: 8, lastSeen: "3 horas atrás" },
  { error: "Invalid PIX key", code: 422, connector: "pix", count: 3, lastSeen: "5 horas atrás" },
];

const latencyBuckets = [
  { range: "0-100ms", count: 12400, color: "#25D366" },
  { range: "100-500ms", count: 8200, color: "#3B82F6" },
  { range: "500ms-1s", count: 3100, color: "#F59E0B" },
  { range: "1-5s", count: 1200, color: "#F97316" },
  { range: "5s+", count: 300, color: "#EF4444" },
];

// Heatmap data: 7 days x 24 hours
const heatmapData: number[][] = Array.from({ length: 7 }, (_, day) =>
  Array.from({ length: 24 }, (_, hour) => {
    const isWorkHour = hour >= 8 && hour <= 20;
    const isWeekday = day < 5;
    const base = isWorkHour && isWeekday ? 80 : isWorkHour ? 40 : isWeekday ? 15 : 5;
    return base + Math.floor(Math.random() * 30);
  })
);
const heatmapMax = Math.max(...heatmapData.flat());
const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const tooltipStyle = { background: "#16161E", border: "1px solid #2A2A3A", borderRadius: 8, fontSize: 12 };

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("7d");
  const [connectorFilter, setConnectorFilter] = useState("all");
  const [compareMode, setCompareMode] = useState(false);

  const periodDays = period === "24h" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const visibleData = dailyData.slice(-Math.min(periodDays, 30));
  const prevData = dailyData.slice(-Math.min(periodDays * 2, 30), -Math.min(periodDays, 30));

  const totalCalls = visibleData.reduce((s, d) => s + d.calls, 0);
  const prevCalls = prevData.reduce((s, d) => s + d.calls, 0);
  const totalErrors = visibleData.reduce((s, d) => s + d.errors, 0);
  const prevErrors = prevData.reduce((s, d) => s + d.errors, 0);
  const successRate = ((totalCalls - totalErrors) / totalCalls * 100).toFixed(1);
  const prevSuccessRate = prevCalls > 0 ? ((prevCalls - prevErrors) / prevCalls * 100).toFixed(1) : "0";

  const delta = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev * 100).toFixed(1) : "—";

  const connectorBreakdown = useMemo(() => connectors.map(c => ({
    ...c,
    calls: visibleData.reduce((s, d) => s + ((d as unknown as Record<string, number>)[c.key] || 0), 0),
  })).sort((a, b) => b.calls - a.calls), [visibleData]);

  const errorsByConnector = connectors.map(c => ({
    name: c.name,
    color: c.color,
    errors: topErrors.filter(e => e.connector === c.key).reduce((s, e) => s + e.count, 0),
  })).filter(c => c.errors > 0).sort((a, b) => b.errors - a.errors);

  const kpis = [
    { label: "Tool calls", value: totalCalls.toLocaleString(), icon: Zap, color: "text-green", trend: Number(delta(totalCalls, prevCalls)), prevValue: prevCalls.toLocaleString() },
    { label: "Taxa de sucesso", value: `${successRate}%`, icon: Activity, color: "text-green", trend: Number(delta(Number(successRate), Number(prevSuccessRate))), prevValue: `${prevSuccessRate}%` },
    { label: "Latência P50", value: "234ms", icon: Clock, color: "text-blue", trend: -8.2, prevValue: "255ms" },
    { label: "Latência P95", value: "1.2s", icon: Clock, color: "text-yellow", trend: -3.1, prevValue: "1.24s" },
    { label: "Latência P99", value: "4.8s", icon: Clock, color: "text-red", trend: 12.5, prevValue: "4.3s" },
    { label: "Erros", value: totalErrors.toString(), icon: AlertTriangle, color: "text-yellow", trend: Number(delta(totalErrors, prevErrors)), prevValue: prevErrors.toString() },
  ];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Calendar className="w-4 h-4 text-text-muted" />
        {["24h", "7d", "30d", "90d"].map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p ? "bg-green/15 text-green border border-green/20" : "text-text-muted hover:text-text hover:bg-surface-hover border border-transparent"}`}
          >{p}</button>
        ))}

        <div className="ml-4 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-text-muted" />
          <select value={connectorFilter} onChange={e => setConnectorFilter(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text focus:border-green focus:outline-none">
            <option value="all">Todos conectores</option>
            {connectors.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>

        <button onClick={() => setCompareMode(!compareMode)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${compareMode ? "bg-purple-500/15 text-purple-400 border-purple-500/20" : "text-text-muted hover:text-text border-border"}`}
        >
          {compareMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          Comparar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className={`flex items-center gap-0.5 text-[11px] ${kpi.trend > 0 && kpi.label === "Erros" ? "text-red" : kpi.trend > 0 ? "text-green" : kpi.trend < 0 && kpi.label === "Erros" ? "text-green" : "text-green"}`}>
                {kpi.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {kpi.trend > 0 ? "+" : ""}{isNaN(kpi.trend) ? "—" : `${kpi.trend}%`}
              </span>
            </div>
            <p className="text-xl font-bold mt-2">{kpi.value}</p>
            <p className="text-text-muted text-[10px] mt-0.5">{kpi.label}</p>
            {compareMode && <p className="text-[10px] text-purple-400 mt-1">Anterior: {kpi.prevValue}</p>}
          </div>
        ))}
      </div>

      {/* Charts Row 1: Area + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Calls por dia</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visibleData}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#25D366" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#E4E4E7" }} />
                <Area type="monotone" dataKey="calls" stroke="#25D366" strokeWidth={2} fill="url(#colorCalls)" />
                {compareMode && <Area type="monotone" dataKey="errors" stroke="#8B5CF6" strokeWidth={1.5} fill="none" strokeDasharray="5 5" />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Por conector</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={connectorBreakdown} dataKey="calls" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2}>
                  {connectorBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {connectorBreakdown.slice(0, 6).map(c => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  <span className="text-text-muted">{c.name}</span>
                </div>
                <span className="font-mono">{c.calls.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Errors by Connector + Latency Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Erros por conector</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={errorsByConnector} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} width={100} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="errors" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Distribuição de latência</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={latencyBuckets}>
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32}>
                  {latencyBuckets.map((b, i) => <Cell key={i} fill={b.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">Heatmap de calls (dia × hora)</h3>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="flex gap-0.5 mb-1 ml-10">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center text-[9px] text-text-muted">{h % 3 === 0 ? `${h}h` : ""}</div>
              ))}
            </div>
            {heatmapData.map((row, dayIdx) => (
              <div key={dayIdx} className="flex items-center gap-0.5 mb-0.5">
                <span className="text-[10px] text-text-muted w-10 text-right pr-2">{dayLabels[dayIdx]}</span>
                {row.map((val, hourIdx) => (
                  <div
                    key={hourIdx}
                    className="flex-1 h-5 rounded-sm transition-colors"
                    style={{ backgroundColor: `rgba(37, 211, 102, ${Math.max(0.05, val / heatmapMax)})` }}
                    title={`${dayLabels[dayIdx]} ${hourIdx}h: ${val} calls`}
                  />
                ))}
              </div>
            ))}
            <div className="flex items-center justify-end gap-2 mt-3">
              <span className="text-[10px] text-text-muted">Menos</span>
              {[0.1, 0.25, 0.5, 0.75, 1].map(o => (
                <div key={o} className="w-4 h-3 rounded-sm" style={{ backgroundColor: `rgba(37, 211, 102, ${o})` }} />
              ))}
              <span className="text-[10px] text-text-muted">Mais</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Tools + Top Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Top tools (período)</h3>
          <div className="space-y-3">
            {topTools.map((t, i) => (
              <div key={t.tool} className="flex items-center gap-3">
                <span className="text-xs text-text-muted w-4">{i + 1}.</span>
                <span className="text-xs px-2 py-0.5 rounded bg-surface-hover font-medium w-24 text-center truncate">{t.connector}</span>
                <span className="flex-1 font-mono text-xs truncate">{t.tool}</span>
                <div className="hidden sm:block w-24 h-2 bg-bg rounded-full overflow-hidden">
                  <div className="h-full bg-green rounded-full" style={{ width: `${(t.calls / topTools[0].calls) * 100}%` }} />
                </div>
                <span className="text-xs font-mono text-text-muted w-14 text-right">{t.calls.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Top erros</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 text-text-muted font-medium">Erro</th>
                  <th className="pb-2 text-text-muted font-medium">Código</th>
                  <th className="pb-2 text-text-muted font-medium">Conector</th>
                  <th className="pb-2 text-text-muted font-medium text-right">Qtd</th>
                  <th className="pb-2 text-text-muted font-medium text-right">Último</th>
                </tr>
              </thead>
              <tbody>
                {topErrors.map((e, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 text-red">{e.error}</td>
                    <td className="py-2 font-mono text-text-muted">{e.code}</td>
                    <td className="py-2"><span className="px-1.5 py-0.5 rounded bg-surface-hover">{e.connector}</span></td>
                    <td className="py-2 font-mono text-right">{e.count}</td>
                    <td className="py-2 text-text-muted text-right">{e.lastSeen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
