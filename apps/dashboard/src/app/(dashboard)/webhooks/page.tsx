export default function WebhooksPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Webhooks</h2>
        <button className="rounded-lg bg-green px-4 py-2 text-sm font-semibold text-bg hover:bg-green-hover transition-colors">
          Adicionar Webhook
        </button>
      </div>
      <div className="bg-surface border border-border rounded-xl p-6">
        <p className="text-text-muted">
          Configure webhooks para receber notificacoes de erro e eventos do Gateway.
        </p>
        <p className="text-text-muted text-sm mt-2">
          Phase 2: webhooks de escalonamento (&quot;acao X precisa da sua decisao&quot;).
        </p>
      </div>
    </div>
  );
}
