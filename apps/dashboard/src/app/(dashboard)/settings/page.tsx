"use client";

import { User, Mail, Lock, CreditCard, Bell, Shield, Zap, Check } from "lucide-react";

const plans = [
  { name: "Free", price: "R$0", calls: "100/hora", features: ["1 conector", "Logs 7 dias", "Suporte comunidade"], current: true },
  { name: "Starter", price: "R$97", calls: "1.000/hora", features: ["5 conectores", "Logs 30 dias", "Suporte email"], current: false },
  { name: "Pro", price: "R$297", calls: "10.000/hora", features: ["Todos conectores", "Logs 90 dias", "Suporte prioritario", "Webhooks"], current: false },
  { name: "Enterprise", price: "R$497+", calls: "100.000/hora", features: ["Tudo do Pro", "SLA 99.9%", "Suporte dedicado", "Phase 2 beta"], current: false },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Profile */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-green" /> Perfil
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs text-text-muted mb-1.5">
              <User className="w-3 h-3" /> Nome da empresa
            </label>
            <input
              type="text"
              defaultValue="Minha Empresa"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:border-green focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs text-text-muted mb-1.5">
              <Mail className="w-3 h-3" /> Email
            </label>
            <input
              type="email"
              defaultValue="admin@empresa.com"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:border-green focus:outline-none transition-colors"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button className="px-4 py-2 text-sm font-semibold bg-green text-bg rounded-lg hover:bg-green-hover transition-colors">
            Salvar
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-5">
          <Lock className="w-4 h-4 text-green" /> Seguranca
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Senha atual</label>
            <input type="password" className="w-full max-w-sm bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:border-green focus:outline-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-sm md:max-w-none">
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">Nova senha</label>
              <input type="password" className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:border-green focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">Confirmar nova senha</label>
              <input type="password" className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:border-green focus:outline-none" />
            </div>
          </div>
          <button className="px-4 py-2 text-sm text-text-muted border border-border rounded-lg hover:text-text hover:border-green/30 transition-colors">
            Alterar senha
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-5">
          <Bell className="w-4 h-4 text-green" /> Notificacoes
        </h3>
        <div className="space-y-3">
          {[
            { label: "Erros de execucao", desc: "Receber email quando tool calls falharem", defaultChecked: true },
            { label: "Rate limit atingido", desc: "Alerta quando se aproximar do limite", defaultChecked: true },
            { label: "Relatorio semanal", desc: "Resumo de uso toda segunda-feira", defaultChecked: false },
          ].map((n) => (
            <label key={n.label} className="flex items-center justify-between p-3 bg-bg rounded-lg border border-border cursor-pointer hover:border-green/20 transition-colors">
              <div>
                <p className="text-sm font-medium">{n.label}</p>
                <p className="text-xs text-text-muted mt-0.5">{n.desc}</p>
              </div>
              <input type="checkbox" defaultChecked={n.defaultChecked} className="accent-green w-4 h-4" />
            </label>
          ))}
        </div>
      </div>

      {/* Plan */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-5">
          <CreditCard className="w-4 h-4 text-green" /> Plano
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-xl p-4 border transition-colors ${
                p.current ? "border-green bg-green/5" : "border-border hover:border-green/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">{p.name}</h4>
                {p.current && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green text-bg font-semibold">Atual</span>}
              </div>
              <p className="text-xl font-bold">{p.price}<span className="text-xs text-text-muted font-normal">/mes</span></p>
              <p className="text-xs text-text-muted mt-1">{p.calls}</p>
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Check className="w-3 h-3 text-green shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {!p.current && (
                <button className="w-full mt-3 py-2 rounded-lg border border-border text-xs text-text-muted hover:text-text hover:border-green/30 transition-colors">
                  Fazer upgrade
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
