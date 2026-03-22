"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Activity, Zap, Clock, AlertTriangle, Calendar } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const dailyData = [
  { date: "Mar 15", calls: 1200, errors: 12 },
  { date: "Mar 16", calls: 1800, errors: 8 },
  { date: "Mar 17", calls: 2400, errors: 24 },
  { date: "Mar 18", calls: 2100, errors: 15 },
  { date: "Mar 19", calls: 3200, errors: 19 },
  { date: "Mar 20", calls: 2800, errors: 11 },
  { date: "Mar 21", calls: 3600, errors: 22 },
  { date: "Mar 22", calls: 4100, errors: 18 },
];

const connectorData = [
  { name: "WhatsApp", calls: 12400, color: "#25D366" },
  { name: "Mercado Livre", calls: 8200, color: "#3B82F6" },
  { name: "Hotmart", calls: 4800, color: "#F59E0B" },
  { name: "Eduzz", calls: 2100, color: "#8B5CF6" },
  { name: "Pix", calls: 1600, color: "#EC4899" },
  { name: "Outros", calls: 900, color: "#6B7280" },
];

const topTools = [
  { tool: "send_text_message", calls: 8421, connector: "whatsapp" },
  { tool: "search_items", calls: 5234, connector: "mercadolivre" },
  { tool: "get_sales_history", calls: 3102, connector: "hotmart" },
  { tool: "send_template_message", calls: 2847, connector: "whatsapp" },
  { tool: "get_orders", calls: 2156, connector: "mercadolivre" },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("7d");

  const totalCalls = dailyData.reduce((s, d) => s + d.calls, 0);
  const totalErrors = dailyData.reduce((s, d) => s + d.errors, 0);
  const successRate = (((totalCalls - totalErrors) / totalCalls) * 100).toFixed(1);
  const avgLatency = 342;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-text-muted" />
        {["24h", "7d", "30d", "90d"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              period === p ? "bg-green/15 text-green border border-green/20" : "text-text-muted hover:text-text hover:bg-surface-hover border border-transparent"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <Zap className="w-4 h-4 text-green" />
            <span className="flex items-center gap-1 text-[11px] text-green"><TrendingUp className="w-3 h-3" />+23%</span>
          </div>
          <p className="text-2xl font-bold mt-2">{totalCalls.toLocaleString("pt-BR")}</p>
          <p className="text-text-muted text-xs mt-0.5">Tool calls no periodo</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <Activity className="w-4 h-4 text-green" />
            <span className="flex items-center gap-1 text-[11px] text-green"><TrendingUp className="w-3 h-3" />+0.5%</span>
          </div>
          <p className="text-2xl font-bold mt-2">{successRate}%</p>
          <p className="text-text-muted text-xs mt-0.5">Taxa de sucesso</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <Clock className="w-4 h-4 text-blue" />
            <span className="flex items-center gap-1 text-[11px] text-green"><TrendingDown className="w-3 h-3" />-12%</span>
          </div>
          <p className="text-2xl font-bold mt-2">{avgLatency}ms</p>
          <p className="text-text-muted text-xs mt-0.5">Latencia media</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <AlertTriangle className="w-4 h-4 text-yellow" />
            <span className="flex items-center gap-1 text-[11px] text-red"><TrendingUp className="w-3 h-3" />+8</span>
          </div>
          <p className="text-2xl font-bold mt-2">{totalErrors}</p>
          <p className="text-text-muted text-xs mt-0.5">Erros no periodo</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area Chart — Calls over time */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Calls por dia</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#25D366" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#16161E", border: "1px solid #2A2A3A", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#E4E4E7" }}
                />
                <Area type="monotone" dataKey="calls" stroke="#25D366" strokeWidth={2} fill="url(#colorCalls)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart — Distribuicao por conector */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Por conector</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={connectorData} dataKey="calls" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2}>
                  {connectorData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#16161E", border: "1px solid #2A2A3A", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {connectorData.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  <span className="text-text-muted">{c.name}</span>
                </div>
                <span className="font-mono">{c.calls.toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Tools */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">Top tools (periodo)</h3>
        <div className="space-y-3">
          {topTools.map((t, i) => (
            <div key={t.tool} className="flex items-center gap-4">
              <span className="text-xs text-text-muted w-4">{i + 1}.</span>
              <span className="text-xs px-2 py-0.5 rounded bg-surface-hover font-medium w-28 text-center">{t.connector}</span>
              <span className="flex-1 font-mono text-xs">{t.tool}</span>
              <div className="w-32 h-2 bg-bg rounded-full overflow-hidden">
                <div className="h-full bg-green rounded-full" style={{ width: `${(t.calls / topTools[0].calls) * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-text-muted w-16 text-right">{t.calls.toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
