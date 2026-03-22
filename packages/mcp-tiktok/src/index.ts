#!/usr/bin/env node
/**
 * @bridgeapi/mcp-tiktok — MCP Server
 * TikTok Content API integration for AI Agents
 * Part of the BridgeAPI ecosystem
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  TikTokClient,
  preExecuteHook,
  postExecuteHook,
  type TikTokConfig,
  type HookContext,
  type ApiResponse,
} from "./tiktok-client.js";

// ═══════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════
function loadConfig(): TikTokConfig {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) throw new Error("TIKTOK_ACCESS_TOKEN is required");
  const appId = process.env.TIKTOK_APP_ID;
  if (!appId) throw new Error("TIKTOK_APP_ID is required");
  const appSecret = process.env.TIKTOK_APP_SECRET;
  if (!appSecret) throw new Error("TIKTOK_APP_SECRET is required");
  const openId = process.env.TIKTOK_OPEN_ID;
  if (!openId) throw new Error("TIKTOK_OPEN_ID is required");
  return { accessToken, appId, appSecret, openId };
}

// ═══════════════════════════════════════════════════════════════════
// Hook wrapper
// ═══════════════════════════════════════════════════════════════════
async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: TikTokConfig,
  executor: () => Promise<ApiResponse<T>>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const hookCtx: HookContext = {
    tool_name: toolName,
    params,
    config,
    timestamp: new Date().toISOString(),
  };

  const preResult = await preExecuteHook(hookCtx);
  if (!preResult.allow) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            blocked: true,
            reason: preResult.reason || "Blocked",
            escalation_id: preResult.escalation_id,
          }),
        },
      ],
    };
  }

  const response = await executor();
  const postResult = await postExecuteHook(hookCtx, response);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: response.success,
            ...(response.data ? { data: response.data } : {}),
            ...(response.error ? { error: response.error } : {}),
            meta: {
              ...response.meta,
              confidence_score: null,
              execution_mode: "auto",
              flags: postResult.flags || [],
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════
// Bootstrap
// ═══════════════════════════════════════════════════════════════════
const config = loadConfig();
const client = new TikTokClient(config);

const server = new McpServer(
  { name: "bridgeapi-tiktok", version: "0.1.0" },
  {
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false },
      prompts: { listChanged: false },
    },
  },
);

// ═══════════════════════════════════════════════════════════════════
// TOOLS (14 TikTok-specific)
// ═══════════════════════════════════════════════════════════════════

// 1. get_user_info — Perfil do criador autenticado
server.tool(
  "get_user_info",
  "Retorna informacoes do perfil do criador autenticado no TikTok (nome, bio, contadores).",
  {},
  async () =>
    executeWithHooks("get_user_info", {}, config, () =>
      client.getUserInfo(),
    ),
);

// 2. get_user_videos — Listar videos do criador
server.tool(
  "get_user_videos",
  "Lista os videos publicados pelo criador autenticado, com paginacao.",
  {
    max_count: z.number().optional().default(20).describe("Quantidade maxima de videos (1-20)"),
    cursor: z.number().optional().describe("Cursor para paginacao"),
  },
  async ({ max_count, cursor }) =>
    executeWithHooks("get_user_videos", { max_count, cursor }, config, () =>
      client.getUserVideos(max_count, cursor),
    ),
);

// 3. get_video_info — Detalhes de um video especifico
server.tool(
  "get_video_info",
  "Retorna detalhes completos de um video especifico pelo ID.",
  {
    video_id: z.string().describe("ID do video no TikTok"),
  },
  async ({ video_id }) =>
    executeWithHooks("get_video_info", { video_id }, config, () =>
      client.getVideoInfo(video_id),
    ),
);

// 4. get_video_comments — Comentarios de um video
server.tool(
  "get_video_comments",
  "Lista os comentarios de um video especifico.",
  {
    video_id: z.string().describe("ID do video"),
  },
  async ({ video_id }) =>
    executeWithHooks("get_video_comments", { video_id }, config, () =>
      client.getVideoComments(video_id),
    ),
);

// 5. reply_to_comment — Responder a um comentario
server.tool(
  "reply_to_comment",
  "Responde a um comentario em um video do TikTok.",
  {
    comment_id: z.string().describe("ID do comentario"),
    text: z.string().describe("Texto da resposta"),
  },
  async ({ comment_id, text }) =>
    executeWithHooks("reply_to_comment", { comment_id, text }, config, () =>
      client.replyToComment(comment_id, text),
    ),
);

// 6. get_video_analytics — Metricas de desempenho de um video
server.tool(
  "get_video_analytics",
  "Retorna metricas de desempenho (views, likes, shares, comments) de um video.",
  {
    video_id: z.string().describe("ID do video"),
  },
  async ({ video_id }) =>
    executeWithHooks("get_video_analytics", { video_id }, config, () =>
      client.getVideoAnalytics(video_id),
    ),
);

// 7. get_followers_list — Lista de seguidores
server.tool(
  "get_followers_list",
  "Retorna a lista de seguidores do criador autenticado.",
  {
    max_count: z.number().optional().default(100).describe("Quantidade maxima de seguidores"),
  },
  async ({ max_count }) =>
    executeWithHooks("get_followers_list", { max_count }, config, () =>
      client.getFollowersList(max_count),
    ),
);

// 8. search_videos — Pesquisar videos
server.tool(
  "search_videos",
  "Pesquisa videos no TikTok por palavra-chave.",
  {
    query: z.string().describe("Termo de busca"),
  },
  async ({ query }) =>
    executeWithHooks("search_videos", { query }, config, () =>
      client.searchVideos(query),
    ),
);

// 9. get_hashtag_info — Informacoes de uma hashtag
server.tool(
  "get_hashtag_info",
  "Retorna informacoes e metricas de uma hashtag especifica.",
  {
    hashtag: z.string().describe("Nome da hashtag (sem #)"),
  },
  async ({ hashtag }) =>
    executeWithHooks("get_hashtag_info", { hashtag }, config, () =>
      client.getHashtagInfo(hashtag),
    ),
);

// 10. get_trending_hashtags — Hashtags em alta
server.tool(
  "get_trending_hashtags",
  "Retorna as hashtags que estao em tendencia no TikTok.",
  {},
  async () =>
    executeWithHooks("get_trending_hashtags", {}, config, () =>
      client.getTrendingHashtags(),
    ),
);

// 11. get_creator_insights — Insights do criador (audiencia)
server.tool(
  "get_creator_insights",
  "Retorna insights sobre a audiencia do criador (paises, generos, idades).",
  {},
  async () =>
    executeWithHooks("get_creator_insights", {}, config, () =>
      client.getCreatorInsights(),
    ),
);

// 12. delete_video — Excluir video
server.tool(
  "delete_video",
  "Exclui um video do perfil do criador autenticado.",
  {
    video_id: z.string().describe("ID do video a ser excluido"),
  },
  async ({ video_id }) =>
    executeWithHooks("delete_video", { video_id }, config, () =>
      client.deleteVideo(video_id),
    ),
);

// 13. get_liked_videos — Videos curtidos
server.tool(
  "get_liked_videos",
  "Lista os videos curtidos pelo criador autenticado.",
  {
    max_count: z.number().optional().default(20).describe("Quantidade maxima"),
  },
  async ({ max_count }) =>
    executeWithHooks("get_liked_videos", { max_count }, config, () =>
      client.getLikedVideos(max_count),
    ),
);

// 14. publish_video — Publicar video
server.tool(
  "publish_video",
  "Inicia a publicacao de um video no TikTok via Content Posting API.",
  {
    data: z.record(z.string(), z.unknown()).describe("Dados de publicacao (post_info, source_info, etc.)"),
  },
  async ({ data }) =>
    executeWithHooks("publish_video", { data }, config, () =>
      client.publishVideo(data),
    ),
);

// ═══════════════════════════════════════════════════════════════════
// RESOURCES (3)
// ═══════════════════════════════════════════════════════════════════

server.resource(
  "profile",
  "tiktok://profile",
  async () => {
    const result = await client.getUserInfo();
    return {
      contents: [
        {
          uri: "tiktok://profile",
          mimeType: "application/json",
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  },
);

server.resource(
  "videos",
  "tiktok://videos",
  async () => {
    const result = await client.getUserVideos(20);
    return {
      contents: [
        {
          uri: "tiktok://videos",
          mimeType: "application/json",
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  },
);

server.resource(
  "analytics",
  "tiktok://analytics",
  async () => {
    const result = await client.getCreatorInsights();
    return {
      contents: [
        {
          uri: "tiktok://analytics",
          mimeType: "application/json",
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  },
);

// ═══════════════════════════════════════════════════════════════════
// PROMPTS (3 — PT-BR)
// ═══════════════════════════════════════════════════════════════════

server.prompt(
  "planejador-conteudo",
  "Planejador de conteudo TikTok — cria calendario editorial, sugere formatos e hashtags",
  {
    nicho: z.string().describe("Nicho ou tema do perfil"),
    periodo: z.string().optional().describe("Periodo desejado (ex: proxima semana, proximo mes)"),
  },
  ({ nicho, periodo }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Sou um criador de conteudo TikTok no nicho "${nicho}".`,
            periodo ? `Preciso de um plano para ${periodo}.` : "Preciso de um plano semanal.",
            "",
            "Por favor:",
            "1. Use get_user_info para entender meu perfil atual",
            "2. Use get_trending_hashtags para identificar tendencias relevantes",
            "3. Use get_user_videos para analisar meus videos recentes",
            "4. Crie um calendario editorial com:",
            "   - Sugestoes de temas e formatos (duets, stitches, trends)",
            "   - Melhores horarios para postar",
            "   - Hashtags recomendadas por video",
            "   - Estrategia de engajamento (CTAs, ganchos)",
          ].join("\n"),
        },
      },
    ],
  }),
);

server.prompt(
  "engajamento",
  "Estrategia de engajamento — analisa comentarios e sugere respostas para aumentar interacao",
  {
    video_id: z.string().describe("ID do video para analisar engajamento"),
  },
  ({ video_id }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Preciso melhorar o engajamento no video ${video_id}.`,
            "",
            "Por favor:",
            "1. Use get_video_info para obter os dados do video",
            "2. Use get_video_comments para ler os comentarios",
            "3. Use get_video_analytics para ver as metricas",
            "4. Analise o sentimento dos comentarios",
            "5. Sugira respostas estrategicas para os comentarios mais relevantes",
            "6. Use reply_to_comment para responder os prioritarios",
            "7. De sugestoes para aumentar o engajamento futuro",
          ].join("\n"),
        },
      },
    ],
  }),
);

server.prompt(
  "analise-tendencias",
  "Analise de tendencias TikTok — identifica oportunidades de conteudo viral",
  {
    nicho: z.string().optional().describe("Nicho especifico para filtrar tendencias"),
  },
  ({ nicho }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "Preciso de uma analise completa das tendencias atuais do TikTok.",
            nicho ? `Foco no nicho: "${nicho}".` : "",
            "",
            "Por favor:",
            "1. Use get_trending_hashtags para listar tendencias atuais",
            nicho ? `2. Use search_videos para encontrar videos populares no nicho "${nicho}"` : "2. Use search_videos com termos relevantes",
            "3. Use get_creator_insights para entender minha audiencia",
            "4. Identifique padroes de conteudo viral (formatos, duracao, estilo)",
            "5. Recomende 5-10 ideias de video baseadas nas tendencias",
            "6. Sugira hashtags combinando trending + nicho para maximo alcance",
          ].join("\n"),
        },
      },
    ],
  }),
);

// ═══════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BridgeAPI TikTok MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
