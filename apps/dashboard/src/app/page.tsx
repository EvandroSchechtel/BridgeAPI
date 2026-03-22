import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">
          <span className="text-green">Bridge</span>API
        </h1>
        <p className="text-text-muted text-lg">
          Dashboard para gerenciar conectores MCP
        </p>
        <Link
          href="/connectors"
          className="inline-block rounded-lg bg-green px-6 py-3 font-semibold text-bg hover:bg-green-hover transition-colors"
        >
          Acessar Dashboard
        </Link>
      </div>
    </div>
  );
}
