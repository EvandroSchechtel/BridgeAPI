import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import crypto from "node:crypto";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.join(import.meta.dirname, "..", ".env") });

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL!,
});
const prisma = new PrismaClient({ adapter });

function generateApiKey(prefix: string) {
  return `bapi_${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}

async function main() {
  console.log("🌱 Seeding BridgeAPI database...");

  // 1. Create demo client
  const client = await prisma.client.upsert({
    where: { email: "admin@bridgeapi.com.br" },
    update: {},
    create: {
      name: "BridgeAPI Demo",
      email: "admin@bridgeapi.com.br",
      plan: "pro",
      active: true,
    },
  });
  console.log(`✅ Client: ${client.name} (${client.id})`);

  // 2. Create API keys
  const liveKey = await prisma.apiKey.create({
    data: {
      clientId: client.id,
      key: generateApiKey("live_sk"),
      name: "Production Agent",
      active: true,
    },
  });
  const testKey = await prisma.apiKey.create({
    data: {
      clientId: client.id,
      key: generateApiKey("test_sk"),
      name: "Development",
      active: true,
    },
  });
  console.log(`✅ API Keys: ${liveKey.name}, ${testKey.name}`);

  // 3. Create connectors
  const connectorTypes = [
    { type: "whatsapp", status: "active", credentials: { accessToken: "EAAGm0PX4ZCps...", phoneNumberId: "1234567890", businessAccountId: "9876543210" } },
    { type: "hotmart", status: "active", credentials: { clientId: "demo-client-id", clientSecret: "demo-client-secret" } },
    { type: "mercadolivre", status: "active", credentials: { accessToken: "APP_USR-1234567890" } },
    { type: "eduzz", status: "active", credentials: { apiKey: "demo-eduzz-key", publicKey: "demo-eduzz-pub" } },
    { type: "pix", status: "configured", credentials: { clientId: "demo-pix-client", clientSecret: "demo-pix-secret", pixKey: "pix@empresa.com.br" } },
    { type: "nfe", status: "configured", credentials: { apiToken: "demo-nfe-token", provider: "enotas" } },
    { type: "shopify", status: "inactive", credentials: {} },
    { type: "nuvemshop", status: "inactive", credentials: {} },
    { type: "instagram-direct", status: "inactive", credentials: {} },
    { type: "calendly", status: "inactive", credentials: {} },
    { type: "google-calendar", status: "inactive", credentials: {} },
    { type: "loja-integrada", status: "inactive", credentials: {} },
    { type: "tiktok", status: "inactive", credentials: {} },
    { type: "tiktok-shop", status: "inactive", credentials: {} },
    { type: "shopee", status: "inactive", credentials: {} },
    { type: "temu", status: "inactive", credentials: {} },
  ];

  const connectors: Record<string, { id: string }> = {};
  for (const c of connectorTypes) {
    const conn = await prisma.connector.create({
      data: {
        clientId: client.id,
        type: c.type,
        status: c.status,
        credentials: c.credentials,
      },
    });
    connectors[c.type] = conn;
  }
  console.log(`✅ Connectors: ${Object.keys(connectors).length} created`);

  // 4. Create sample tool calls (last 24h)
  const toolCallSamples = [
    { connector: "whatsapp", tool: "send_text_message", params: { to: "+5541999990001", body: "Olá!" }, status: 200, latency: 234 },
    { connector: "whatsapp", tool: "send_template_message", params: { to: "+5511999887766", template: "order_confirmation" }, status: 400, latency: 5023, error: "Template not found" },
    { connector: "whatsapp", tool: "send_media_message", params: { to: "+5541999990002", media_type: "image" }, status: 200, latency: 1567 },
    { connector: "whatsapp", tool: "mark_message_read", params: { message_id: "wamid.HBgN..." }, status: 200, latency: 98 },
    { connector: "hotmart", tool: "get_sales_history", params: { period: "7d" }, status: 200, latency: 891 },
    { connector: "hotmart", tool: "get_subscriptions", params: { status: "ACTIVE" }, status: 200, latency: 723 },
    { connector: "hotmart", tool: "cancel_subscription", params: { subscriber_code: "SUB089" }, status: 200, latency: 967 },
    { connector: "mercadolivre", tool: "search_items", params: { query: "iphone 15" }, status: 200, latency: 342 },
    { connector: "mercadolivre", tool: "get_order", params: { order_id: "MLB2048576321" }, status: 200, latency: 287 },
    { connector: "mercadolivre", tool: "answer_question", params: { question_id: 999888 }, status: 403, latency: 1200, error: "Permission denied" },
    { connector: "eduzz", tool: "get_sales", params: { page: 1 }, status: 200, latency: 678 },
    { connector: "pix", tool: "create_charge", params: { valor: "49.90" }, status: 200, latency: 456 },
    { connector: "pix", tool: "get_charge", params: { txid: "invalid" }, status: 404, latency: 890, error: "Charge not found" },
    { connector: "nfe", tool: "create_nfe", params: { valor: 150 }, status: 200, latency: 1234 },
    { connector: "nfe", tool: "cancel_nfe", params: { nfe_id: "nfe_00098" }, status: 200, latency: 2100 },
  ];

  const now = new Date();
  for (let i = 0; i < toolCallSamples.length; i++) {
    const s = toolCallSamples[i];
    const createdAt = new Date(now.getTime() - (i * 3 * 60 * 1000)); // 3 min apart
    await prisma.toolCall.create({
      data: {
        clientId: client.id,
        connectorId: connectors[s.connector].id,
        toolName: s.tool,
        params: s.params,
        response: s.error ? { error: s.error } : { success: true },
        statusCode: s.status,
        latencyMs: s.latency,
        error: s.error || null,
        createdAt,
      },
    });
  }
  console.log(`✅ Tool calls: ${toolCallSamples.length} created`);

  // 5. Create daily metrics (last 30 days)
  const activeConnectors = ["whatsapp", "hotmart", "mercadolivre", "eduzz", "pix", "nfe"];
  for (let day = 29; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);

    for (const type of activeConnectors) {
      const base = type === "whatsapp" ? 400 : type === "mercadolivre" ? 280 : type === "hotmart" ? 160 : 60;
      const total = base + Math.floor(Math.random() * 100);
      const errors = Math.floor(total * (0.005 + Math.random() * 0.02));
      await prisma.dailyMetric.create({
        data: {
          clientId: client.id,
          connectorId: connectors[type].id,
          date,
          totalCalls: total,
          successCalls: total - errors,
          errorCalls: errors,
          avgLatency: 200 + Math.random() * 600,
          p95Latency: 800 + Math.random() * 2000,
        },
      });
    }
  }
  console.log(`✅ Daily metrics: 30 days × ${activeConnectors.length} connectors`);

  console.log("\n🎉 Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
