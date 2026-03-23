"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Zap, Activity, Clock, CheckCircle2, XCircle,
  AlertTriangle, Settings, ScrollText, Puzzle, MessageSquare,
  Play, Shield, ExternalLink, Copy, Eye, EyeOff,
} from "lucide-react";

type ConnectorType = "whatsapp" | "hotmart" | "eduzz" | "mercadolivre" | "shopify" | "nuvemshop" | "loja-integrada" | "tiktok" | "tiktok-shop" | "shopee" | "temu" | "pix" | "nfe" | "calendly" | "google-calendar" | "instagram-direct";

interface ToolDef { name: string; description: string; calls: number; avgLatency: number; lastUsed: string; }
interface ResourceDef { uri: string; name: string; description: string; }
interface PromptDef { name: string; description: string; }
interface EnvVar { key: string; value: string; required: boolean; }
interface LogEntry { timestamp: string; tool: string; status: "success" | "error" | "timeout"; latency: number; }

const connectorMeta: Record<string, { name: string; description: string; status: string; category: string; tools: ToolDef[]; resources: ResourceDef[]; prompts: PromptDef[]; envVars: EnvVar[]; logs: LogEntry[]; }> = {
  whatsapp: {
    name: "WhatsApp Business", description: "Mensagens, templates, analytics, media via WhatsApp Cloud API", status: "active", category: "Messaging",
    tools: [
      { name: "send_text_message", description: "Envia mensagem de texto para um número", calls: 8421, avgLatency: 234, lastUsed: "2 min atrás" },
      { name: "send_template_message", description: "Envia template aprovado pela Meta", calls: 2847, avgLatency: 312, lastUsed: "5 min atrás" },
      { name: "send_media_message", description: "Envia imagem, vídeo, áudio ou documento", calls: 1523, avgLatency: 1567, lastUsed: "8 min atrás" },
      { name: "send_interactive_message", description: "Envia mensagem com botões ou lista", calls: 987, avgLatency: 289, lastUsed: "15 min atrás" },
      { name: "send_location_message", description: "Envia localização geográfica", calls: 156, avgLatency: 198, lastUsed: "1 hora atrás" },
      { name: "send_contact_message", description: "Envia cartão de contato", calls: 89, avgLatency: 210, lastUsed: "2 horas atrás" },
      { name: "mark_message_read", description: "Marca mensagem como lida (blue ticks)", calls: 4521, avgLatency: 98, lastUsed: "1 min atrás" },
      { name: "list_templates", description: "Lista templates aprovados/pendentes/rejeitados", calls: 234, avgLatency: 456, lastUsed: "30 min atrás" },
      { name: "create_template", description: "Cria novo template para aprovação da Meta", calls: 12, avgLatency: 890, lastUsed: "1 dia atrás" },
      { name: "delete_template", description: "Remove template existente", calls: 3, avgLatency: 345, lastUsed: "3 dias atrás" },
      { name: "get_phone_numbers", description: "Lista números de telefone da conta", calls: 67, avgLatency: 234, lastUsed: "1 hora atrás" },
      { name: "get_business_profile", description: "Retorna perfil comercial do WhatsApp", calls: 45, avgLatency: 189, lastUsed: "2 horas atrás" },
      { name: "update_business_profile", description: "Atualiza about, descrição, endereço", calls: 8, avgLatency: 456, lastUsed: "1 dia atrás" },
      { name: "get_analytics", description: "Métricas de mensagens enviadas/entregues/lidas", calls: 189, avgLatency: 678, lastUsed: "20 min atrás" },
      { name: "upload_media", description: "Upload de arquivo para envio posterior", calls: 234, avgLatency: 2100, lastUsed: "10 min atrás" },
      { name: "get_media_url", description: "Obtém URL temporária de mídia recebida", calls: 567, avgLatency: 156, lastUsed: "3 min atrás" },
    ],
    resources: [
      { uri: "whatsapp://templates", name: "Templates", description: "Lista de todos os templates de mensagem" },
      { uri: "whatsapp://profile", name: "Perfil", description: "Perfil comercial do WhatsApp Business" },
      { uri: "whatsapp://phone-numbers", name: "Números", description: "Números de telefone configurados" },
    ],
    prompts: [
      { name: "campaign-sender", description: "Guia para enviar campanha de marketing respeitando regras da Meta e janela de 24h" },
      { name: "support-responder", description: "Guia para responder suporte ao cliente via WhatsApp com templates e mensagens interativas" },
      { name: "template-creator", description: "Guia para criar templates seguindo as políticas da Meta (categorias, variáveis, botões)" },
    ],
    envVars: [
      { key: "WHATSAPP_ACCESS_TOKEN", value: "EAAGm0PX4ZCps...●●●●●●●●", required: true },
      { key: "WHATSAPP_PHONE_NUMBER_ID", value: "1234567890", required: true },
      { key: "WHATSAPP_BUSINESS_ACCOUNT_ID", value: "9876543210", required: true },
      { key: "WHATSAPP_API_VERSION", value: "v21.0", required: false },
    ],
    logs: [
      { timestamp: "14:23:01", tool: "send_text_message", status: "success", latency: 234 },
      { timestamp: "14:22:30", tool: "send_template_message", status: "error", latency: 5023 },
      { timestamp: "14:19:30", tool: "send_media_message", status: "success", latency: 1567 },
      { timestamp: "14:15:50", tool: "mark_message_read", status: "success", latency: 98 },
      { timestamp: "14:10:22", tool: "get_analytics", status: "success", latency: 678 },
    ],
  },
  hotmart: {
    name: "Hotmart", description: "Vendas, assinaturas, cupons, área de membros", status: "active", category: "Infoprodutos",
    tools: [
      { name: "get_sales_history", description: "Histórico de vendas com filtros", calls: 3102, avgLatency: 891, lastUsed: "5 min atrás" },
      { name: "get_sale_summary", description: "Resumo detalhado de uma transação", calls: 890, avgLatency: 456, lastUsed: "10 min atrás" },
      { name: "get_sale_participants", description: "Participantes e comissões de uma venda", calls: 234, avgLatency: 345, lastUsed: "30 min atrás" },
      { name: "get_commissions", description: "Histórico de comissões (produtor/afiliado)", calls: 156, avgLatency: 567, lastUsed: "1 hora atrás" },
      { name: "get_subscriptions", description: "Lista assinaturas ativas/canceladas", calls: 678, avgLatency: 723, lastUsed: "8 min atrás" },
      { name: "cancel_subscription", description: "Cancela assinatura de um subscriber", calls: 23, avgLatency: 967, lastUsed: "2 horas atrás" },
      { name: "reactivate_subscription", description: "Reativa assinatura cancelada", calls: 8, avgLatency: 1100, lastUsed: "1 dia atrás" },
      { name: "change_due_day", description: "Altera dia de vencimento da assinatura", calls: 12, avgLatency: 890, lastUsed: "3 horas atrás" },
      { name: "get_products", description: "Lista todos os produtos do produtor", calls: 345, avgLatency: 456, lastUsed: "20 min atrás" },
      { name: "get_modules", description: "Módulos da área de membros (Club)", calls: 167, avgLatency: 534, lastUsed: "45 min atrás" },
      { name: "get_student_progress", description: "Progresso do aluno na área de membros", calls: 89, avgLatency: 678, lastUsed: "1 hora atrás" },
      { name: "get_coupons", description: "Lista cupons de desconto", calls: 56, avgLatency: 345, lastUsed: "2 horas atrás" },
      { name: "create_coupon", description: "Cria cupom de desconto (% ou fixo)", calls: 12, avgLatency: 567, lastUsed: "1 dia atrás" },
      { name: "delete_coupon", description: "Remove cupom existente", calls: 5, avgLatency: 234, lastUsed: "2 dias atrás" },
    ],
    resources: [
      { uri: "hotmart://sales", name: "Vendas", description: "Histórico recente de vendas" },
      { uri: "hotmart://subscriptions", name: "Assinaturas", description: "Assinaturas ativas" },
      { uri: "hotmart://products", name: "Produtos", description: "Catálogo de produtos" },
    ],
    prompts: [
      { name: "sales-analyzer", description: "Analisa vendas do período, identifica tendências e sugere ações" },
      { name: "churn-reducer", description: "Identifica assinantes em risco e cria estratégia de retenção" },
      { name: "coupon-strategist", description: "Cria estratégia de cupons para aumentar conversão" },
    ],
    envVars: [
      { key: "HOTMART_CLIENT_ID", value: "a1b2c3d4-●●●●-●●●●-●●●●", required: true },
      { key: "HOTMART_CLIENT_SECRET", value: "e5f6g7h8-●●●●-●●●●-●●●●", required: true },
      { key: "HOTMART_ENVIRONMENT", value: "production", required: false },
    ],
    logs: [
      { timestamp: "14:22:58", tool: "get_sales_history", status: "success", latency: 891 },
      { timestamp: "14:18:55", tool: "get_subscriptions", status: "success", latency: 723 },
      { timestamp: "14:14:05", tool: "cancel_subscription", status: "success", latency: 967 },
      { timestamp: "14:08:30", tool: "get_products", status: "success", latency: 456 },
      { timestamp: "14:02:15", tool: "create_coupon", status: "success", latency: 567 },
    ],
  },
};

// Fallback for connectors without detailed data
function getDefaultConnector(type: string) {
  return {
    name: type.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    description: `MCP connector para ${type}`,
    status: "available", category: "Geral",
    tools: Array.from({ length: 16 }, (_, i) => ({ name: `tool_${i + 1}`, description: `Tool ${i + 1} do conector`, calls: Math.floor(Math.random() * 500), avgLatency: Math.floor(Math.random() * 1000) + 100, lastUsed: "—" })),
    resources: [
      { uri: `${type}://resource1`, name: "Resource 1", description: "Recurso principal" },
      { uri: `${type}://resource2`, name: "Resource 2", description: "Recurso secundário" },
      { uri: `${type}://resource3`, name: "Resource 3", description: "Recurso terciário" },
    ],
    prompts: [
      { name: "prompt-1", description: "Prompt principal" },
      { name: "prompt-2", description: "Prompt secundário" },
      { name: "prompt-3", description: "Prompt auxiliar" },
    ],
    envVars: [
      { key: `${type.toUpperCase().replace(/-/g, "_")}_API_KEY`, value: "●●●●●●●●", required: true },
    ],
    logs: [],
  };
}

const tabs = [
  { id: "tools", label: "Tools", icon: Puzzle },
  { id: "resources", label: "Resources", icon: ExternalLink },
  { id: "prompts", label: "Prompts", icon: MessageSquare },
  { id: "config", label: "Configuração", icon: Settings },
  { id: "activity", label: "Atividade", icon: ScrollText },
];

export default function ConnectorDetailPage() {
  const params = useParams();
  const type = params.type as string;
  const data = connectorMeta[type] || getDefaultConnector(type);
  const [activeTab, setActiveTab] = useState("tools");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<null | "success" | "loading">(null);

  const totalCalls = data.tools.reduce((s, t) => s + t.calls, 0);
  const avgLatency = Math.round(data.tools.reduce((s, t) => s + t.avgLatency, 0) / data.tools.length);
  const errorCount = data.logs.filter(l => l.status !== "success").length;

  const handleTest = () => {
    setTestResult("loading");
    setTimeout(() => setTestResult("success"), 1500);
    setTimeout(() => setTestResult(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/connectors" className="p-2 rounded-lg hover:bg-surface-hover transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-muted" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{data.name}</h1>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${data.status === "active" ? "bg-green/15 text-green" : "bg-blue/15 text-blue"}`}>
              {data.status === "active" ? "Ativo" : "Disponível"}
            </span>
            <span className="text-xs text-text-muted bg-surface-hover px-2 py-0.5 rounded">{data.category}</span>
          </div>
          <p className="text-sm text-text-muted mt-1">{data.description}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Calls hoje", value: totalCalls.toLocaleString(), icon: Zap, color: "text-green" },
          { label: "Erro rate", value: data.logs.length > 0 ? `${((errorCount / data.logs.length) * 100).toFixed(1)}%` : "0%", icon: AlertTriangle, color: errorCount > 0 ? "text-yellow" : "text-green" },
          { label: "Latência média", value: `${avgLatency}ms`, icon: Clock, color: avgLatency > 1000 ? "text-yellow" : "text-green" },
          { label: "Uptime", value: "99.8%", icon: Activity, color: "text-green" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-xs text-text-muted">{kpi.label}</span>
            </div>
            <p className="text-lg font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-px overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
              activeTab === tab.id
                ? "text-green border-green"
                : "text-text-muted border-transparent hover:text-text"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === "tools" && <span className="text-xs bg-surface-hover px-1.5 py-0.5 rounded">{data.tools.length}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {activeTab === "tools" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-text-muted">Tool</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted hidden md:table-cell">Descrição</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted text-right">Calls</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted text-right">Latência</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted text-right">Último uso</th>
                </tr>
              </thead>
              <tbody>
                {data.tools.map(tool => (
                  <tr key={tool.name} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-green">{tool.name}</td>
                    <td className="px-4 py-3 text-xs text-text-muted hidden md:table-cell">{tool.description}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono">{tool.calls.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono">
                      <span className={tool.avgLatency > 2000 ? "text-yellow" : "text-text-muted"}>{tool.avgLatency}ms</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-right text-text-muted">{tool.lastUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "resources" && (
          <div className="p-4 space-y-3">
            {data.resources.map(r => (
              <div key={r.uri} className="flex items-center gap-4 p-3 rounded-lg bg-bg border border-border/50">
                <ExternalLink className="w-4 h-4 text-blue shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-text-muted">{r.description}</p>
                </div>
                <code className="text-xs font-mono text-blue bg-blue/10 px-2 py-1 rounded">{r.uri}</code>
              </div>
            ))}
          </div>
        )}

        {activeTab === "prompts" && (
          <div className="p-4 space-y-3">
            {data.prompts.map(p => (
              <div key={p.name} className="flex items-start gap-4 p-3 rounded-lg bg-bg border border-border/50">
                <MessageSquare className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium font-mono">{p.name}</p>
                  <p className="text-xs text-text-muted mt-1">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "config" && (
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2"><Shield className="w-4 h-4 text-text-muted" /> Variáveis de ambiente</h3>
              {data.envVars.map(ev => (
                <div key={ev.key} className="flex items-center gap-3 p-3 rounded-lg bg-bg border border-border/50">
                  <div className="flex-1">
                    <p className="text-xs font-mono text-text-muted">{ev.key} {ev.required && <span className="text-red">*</span>}</p>
                    <p className="text-sm font-mono mt-1">
                      {showKeys[ev.key] ? ev.value : ev.value.replace(/[^●.]/g, (c, i) => i < 10 ? c : "●")}
                    </p>
                  </div>
                  <button onClick={() => setShowKeys(s => ({ ...s, [ev.key]: !s[ev.key] }))} className="p-1.5 rounded hover:bg-surface-hover">
                    {showKeys[ev.key] ? <EyeOff className="w-4 h-4 text-text-muted" /> : <Eye className="w-4 h-4 text-text-muted" />}
                  </button>
                  <button className="p-1.5 rounded hover:bg-surface-hover">
                    <Copy className="w-4 h-4 text-text-muted" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-medium mb-3">Testar conexão</h3>
              <button
                onClick={handleTest}
                disabled={testResult === "loading"}
                className="flex items-center gap-2 px-4 py-2 bg-green text-bg rounded-lg text-sm font-medium hover:bg-green-hover transition-colors disabled:opacity-50"
              >
                {testResult === "loading" ? (
                  <><Clock className="w-4 h-4 animate-spin" /> Testando...</>
                ) : testResult === "success" ? (
                  <><CheckCircle2 className="w-4 h-4" /> Conexão OK!</>
                ) : (
                  <><Play className="w-4 h-4" /> Testar Conexão</>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-text-muted">Hora</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted">Tool</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted text-right">Latência</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.length > 0 ? data.logs.map((log, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover/50">
                    <td className="px-4 py-3 text-xs font-mono text-text-muted">{log.timestamp}</td>
                    <td className="px-4 py-3 text-xs font-mono">{log.tool}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs ${log.status === "success" ? "text-green" : log.status === "error" ? "text-red" : "text-yellow"}`}>
                        {log.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {log.status === "success" ? "Sucesso" : log.status === "error" ? "Erro" : "Timeout"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-right text-text-muted">{log.latency}ms</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted text-sm">Nenhuma atividade recente. Configure o conector para começar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
