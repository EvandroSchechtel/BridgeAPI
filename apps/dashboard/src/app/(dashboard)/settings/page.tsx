export default function SettingsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Configuracoes</h2>
      <div className="space-y-6">
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Perfil</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Nome</label>
              <input
                type="text"
                placeholder="Sua empresa"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text focus:border-green focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Email</label>
              <input
                type="email"
                placeholder="email@empresa.com"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text focus:border-green focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Plano</h3>
          <div className="flex items-center gap-4">
            <span className="text-xs px-3 py-1 rounded-full bg-green text-bg font-semibold">Free</span>
            <span className="text-text-muted text-sm">100 calls/hora</span>
          </div>
        </div>
      </div>
    </div>
  );
}
