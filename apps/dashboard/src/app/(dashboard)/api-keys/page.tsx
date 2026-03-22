"use client";

import { useState } from "react";
import { Plus, Copy, Trash2, CheckCircle2, Eye, EyeOff, KeyRound, Shield } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  status: "active" | "revoked";
  createdAt: string;
  lastUsed: string;
  callsTotal: number;
}

const mockKeys: ApiKey[] = [
  { id: "1", name: "Production Agent", key: "bapi_live_sk_7f3a2b9c4d5e6f7a8b9c0d1e2f3a4b5c", status: "active", createdAt: "2026-03-15", lastUsed: "2 min atras", callsTotal: 12847 },
  { id: "2", name: "Development", key: "bapi_test_sk_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d", status: "active", createdAt: "2026-03-10", lastUsed: "1 hora atras", callsTotal: 3421 },
  { id: "3", name: "Staging Agent", key: "bapi_test_sk_9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k", status: "revoked", createdAt: "2026-03-01", lastUsed: "5 dias atras", callsTotal: 891 },
];

export default function ApiKeysPage() {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-muted text-sm mt-1">Gerencie as API keys que seus agents usam para se conectar ao Gateway.</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-green px-4 py-2.5 text-sm font-semibold text-bg hover:bg-green-hover transition-colors">
          <Plus className="w-4 h-4" /> Nova API Key
        </button>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 bg-yellow/5 border border-yellow/20 rounded-xl p-4">
        <Shield className="w-5 h-5 text-yellow shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="text-yellow font-medium">Seguranca</p>
          <p className="text-text-muted mt-0.5">API keys dao acesso completo a sua conta. Nunca compartilhe ou exponha em codigo client-side.</p>
        </div>
      </div>

      {/* Keys list */}
      <div className="space-y-3">
        {mockKeys.map((k) => (
          <div
            key={k.id}
            className={`bg-surface border rounded-xl p-5 transition-colors ${
              k.status === "revoked" ? "border-border opacity-60" : "border-border hover:border-green/20"
            }`}
            data-key-id={k.id}
            data-key-status={k.status}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  k.status === "active" ? "bg-green/10" : "bg-surface-hover"
                }`}>
                  <KeyRound className={`w-5 h-5 ${k.status === "active" ? "text-green" : "text-text-muted"}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{k.name}</h3>
                  <p className="text-text-muted text-xs mt-0.5">Criada em {k.createdAt}</p>
                </div>
              </div>
              <span className={`text-[11px] px-2 py-1 rounded-md font-medium ${
                k.status === "active" ? "bg-green/15 text-green" : "bg-red/15 text-red"
              }`}>
                {k.status === "active" ? "Ativa" : "Revogada"}
              </span>
            </div>

            {/* Key display */}
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 bg-bg rounded-lg px-3 py-2 font-mono text-xs border border-border">
                {showKey[k.id] ? k.key : k.key.slice(0, 12) + "••••••••••••••••••••••"}
              </div>
              <button
                onClick={() => setShowKey((s) => ({ ...s, [k.id]: !s[k.id] }))}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
                aria-label={showKey[k.id] ? "Esconder key" : "Mostrar key"}
              >
                {showKey[k.id] ? <EyeOff className="w-4 h-4 text-text-muted" /> : <Eye className="w-4 h-4 text-text-muted" />}
              </button>
              <button
                onClick={() => copyKey(k.key, k.id)}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
                aria-label="Copiar key"
              >
                {copied === k.id ? <CheckCircle2 className="w-4 h-4 text-green" /> : <Copy className="w-4 h-4 text-text-muted" />}
              </button>
              {k.status === "active" && (
                <button className="p-2 rounded-lg hover:bg-red/10 transition-colors" aria-label="Revogar key">
                  <Trash2 className="w-4 h-4 text-red" />
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="mt-3 flex items-center gap-6 text-xs text-text-muted">
              <span>Ultimo uso: {k.lastUsed}</span>
              <span>{k.callsTotal.toLocaleString("pt-BR")} calls totais</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
