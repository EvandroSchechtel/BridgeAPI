#!/usr/bin/env node
/**
 * @bridgeapi/mcp-loja-integrada — MCP Server
 * Part of the BridgeAPI ecosystem
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  LojaIntegradaClient,
  preExecuteHook,
  postExecuteHook,
  type LojaIntegradaConfig,
  type HookContext,
  type ApiResponse,
} from "./loja-integrada-client.js";

function loadConfig(): LojaIntegradaConfig {
  const loja_integrada_api_key = process.env.LOJA_INTEGRADA_API_KEY;
  if (!loja_integrada_api_key) throw new Error("LOJA_INTEGRADA_API_KEY is required");
  const loja_integrada_app_key = process.env.LOJA_INTEGRADA_APP_KEY;
  if (!loja_integrada_app_key) throw new Error("LOJA_INTEGRADA_APP_KEY is required");
  return {
    loja_integrada_api_key: loja_integrada_api_key,
    loja_integrada_app_key: loja_integrada_app_key,
  };
}

async function executeWithHooks<T>(
  toolName: string, params: Record<string, unknown>, config: LojaIntegradaConfig,
  executor: () => Promise<ApiResponse<T>>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const hookCtx: HookContext = { tool_name: toolName, params, config, timestamp: new Date().toISOString() };
  const preResult = await preExecuteHook(hookCtx);
  if (!preResult.allow) {
    return { content: [{ type: "text", text: JSON.stringify({ success: false, blocked: true, reason: preResult.reason || "Blocked", escalation_id: preResult.escalation_id }) }] };
  }
  const response = await executor();
  const postResult = await postExecuteHook(hookCtx, response);
  return { content: [{ type: "text", text: JSON.stringify({ success: response.success, ...(response.data ? { data: response.data } : {}), ...(response.error ? { error: response.error } : {}), meta: { ...response.meta, confidence_score: null, execution_mode: "auto", flags: postResult.flags || [] } }, null, 2) }] };
}

const config = loadConfig();
const client = new LojaIntegradaClient(config);

const server = new McpServer(
  { name: "bridgeapi-loja-integrada", version: "0.1.0" },
  { capabilities: { tools: { listChanged: false }, resources: { listChanged: false }, prompts: { listChanged: false } } }
);

// ═══ TOOLS ═══
server.tool("list_items", "List items/resources.", {
  page: z.number().optional().default(1).describe("Page number"),
  limit: z.number().optional().default(20).describe("Items per page"),
  status: z.string().optional().describe("Filter by status"),
  query: z.string().optional().describe("Search query"),
}, async (params) => executeWithHooks("list_items", params, config, () =>
  client.request(`/items?${new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])).toString()}`)
));

server.tool("get_item", "Get item by ID.", {
  id: z.string().describe("Item ID"),
}, async ({ id }) => executeWithHooks("get_item", { id }, config, () => client.request(`/items/${id}`)));

server.tool("create_item", "Create a new item.", {
  data: z.record(z.string(), z.unknown()).describe("Item data"),
}, async ({ data }) => executeWithHooks("create_item", { data }, config, () => client.request("/items", "POST", data)));

server.tool("update_item", "Update an item.", {
  id: z.string().describe("Item ID"),
  data: z.record(z.string(), z.unknown()).describe("Fields to update"),
}, async ({ id, data }) => executeWithHooks("update_item", { id, data }, config, () => client.request(`/items/${id}`, "PUT", data)));

server.tool("delete_item", "Delete an item.", {
  id: z.string().describe("Item ID"),
}, async ({ id }) => executeWithHooks("delete_item", { id }, config, () => client.request(`/items/${id}`, "DELETE")));

server.tool("list_orders", "List orders.", {
  page: z.number().optional().default(1).describe("Page"),
  limit: z.number().optional().default(20).describe("Limit"),
  status: z.string().optional().describe("Status filter"),
  start_date: z.string().optional().describe("Start date"),
  end_date: z.string().optional().describe("End date"),
}, async (params) => executeWithHooks("list_orders", params, config, () =>
  client.request(`/orders?${new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])).toString()}`)
));

server.tool("get_order", "Get order details.", {
  id: z.string().describe("Order ID"),
}, async ({ id }) => executeWithHooks("get_order", { id }, config, () => client.request(`/orders/${id}`)));

server.tool("update_order", "Update order.", {
  id: z.string().describe("Order ID"),
  data: z.record(z.string(), z.unknown()).describe("Update data"),
}, async ({ id, data }) => executeWithHooks("update_order", { id, data }, config, () => client.request(`/orders/${id}`, "PUT", data)));

server.tool("list_customers", "List customers.", {
  page: z.number().optional().default(1).describe("Page"),
  query: z.string().optional().describe("Search"),
}, async (params) => executeWithHooks("list_customers", params, config, () =>
  client.request(`/customers?${new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])).toString()}`)
));

server.tool("get_customer", "Get customer by ID.", {
  id: z.string().describe("Customer ID"),
}, async ({ id }) => executeWithHooks("get_customer", { id }, config, () => client.request(`/customers/${id}`)));

server.tool("get_analytics", "Get analytics data.", {
  start_date: z.string().describe("Start date"),
  end_date: z.string().describe("End date"),
  metric: z.string().optional().describe("Metric name"),
}, async (params) => executeWithHooks("get_analytics", params, config, () =>
  client.request(`/analytics?${new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])).toString()}`)
));

server.tool("get_profile", "Get account profile.", {},
  async () => executeWithHooks("get_profile", {}, config, () => client.request("/me")));

server.tool("search", "Search the platform.", {
  query: z.string().describe("Search query"),
  type: z.string().optional().describe("Result type"),
  limit: z.number().optional().default(20).describe("Max results"),
}, async (params) => executeWithHooks("search", params, config, () =>
  client.request(`/search?${new URLSearchParams(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])).toString()}`)
));

server.tool("get_categories", "List categories.", {},
  async () => executeWithHooks("get_categories", {}, config, () => client.request("/categories")));

server.tool("send_message", "Send a message.", {
  to: z.string().describe("Recipient ID"),
  text: z.string().describe("Message text"),
}, async ({ to, text }) => executeWithHooks("send_message", { to, text }, config, () => client.request("/messages", "POST", { to, text })));

server.tool("get_webhooks", "List webhooks.", {},
  async () => executeWithHooks("get_webhooks", {}, config, () => client.request("/webhooks")));

// ═══ RESOURCES ═══
server.resource("items", "lojaintegrada://items", async () => {
  const result = await client.request("/items?limit=50");
  return { contents: [{ uri: "lojaintegrada://items", mimeType: "application/json", text: JSON.stringify(result.data, null, 2) }] };
});
server.resource("orders", "lojaintegrada://orders", async () => {
  const result = await client.request("/orders?limit=50");
  return { contents: [{ uri: "lojaintegrada://orders", mimeType: "application/json", text: JSON.stringify(result.data, null, 2) }] };
});
server.resource("profile", "lojaintegrada://profile", async () => {
  const result = await client.request("/me");
  return { contents: [{ uri: "lojaintegrada://profile", mimeType: "application/json", text: JSON.stringify(result.data, null, 2) }] };
});

// ═══ PROMPTS ═══
server.prompt("item-manager", "Guia para gerenciar itens/produtos", {
  action: z.string().describe("Acao desejada"),
}, ({ action }) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: `Preciso ${action} na plataforma. Use as tools disponiveis.` } }] }));

server.prompt("order-handler", "Guia para gerenciar pedidos", {
  status: z.string().optional().describe("Status"),
}, ({ status }) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: `Gerenciar pedidos${status ? ` com status ${status}` : ""}. Use list_orders e update_order.` } }] }));

server.prompt("analytics-reporter", "Guia para relatorios", {
  period: z.string().optional().describe("Periodo"),
}, ({ period }) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: `Gerar relatorio${period ? ` para ${period}` : ""}. Use get_analytics.` } }] }));

// ═══ START ═══
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BridgeAPI Loja Integrada MCP Server v0.1.0 running on stdio");
}
main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
