export default function LogsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Tool Call Logs</h2>
      <div className="bg-surface border border-border rounded-xl p-6">
        <p className="text-text-muted">
          Logs de tool calls serao exibidos aqui quando o Gateway estiver conectado ao banco de dados.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="pb-3 pr-4">Timestamp</th>
                <th className="pb-3 pr-4">Conector</th>
                <th className="pb-3 pr-4">Tool</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3">Latencia</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-text-muted">
                <td colSpan={5} className="py-8 text-center">
                  Nenhum log registrado ainda
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
