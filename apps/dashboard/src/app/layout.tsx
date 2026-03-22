import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BridgeAPI Dashboard",
  description: "Manage MCP connectors, API keys, analytics, and logs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-bg text-text antialiased">
        {children}
      </body>
    </html>
  );
}
