export default function ApiKeysPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">API Keys</h2>
        <button className="rounded-lg bg-green px-4 py-2 text-sm font-semibold text-bg hover:bg-green-hover transition-colors">
          Criar API Key
        </button>
      </div>
      <div className="bg-surface border border-border rounded-xl p-6">
        <p className="text-text-muted">
          Gerencie as API keys que seus agents usam para se conectar ao Gateway.
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between p-4 bg-bg rounded-lg border border-border">
            <div>
              <p className="font-medium">dev-test-key</p>
              <p className="text-text-muted text-xs mt-1">Criada para desenvolvimento</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-green text-bg">Ativa</span>
          </div>
        </div>
      </div>
    </div>
  );
}
