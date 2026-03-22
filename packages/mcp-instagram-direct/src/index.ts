#!/usr/bin/env node
/**
 * @bridgeapi/mcp-instagram-direct — MCP Server
 *
 * 18 Instagram-specific tools, 3 resources, 3 prompts (PT-BR).
 * Part of the BridgeAPI ecosystem.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  InstagramClient,
  preExecuteHook,
  postExecuteHook,
  type InstagramConfig,
  type HookContext,
  type ApiResponse,
} from "./instagram-client.js";

// ─── Config loader ───────────────────────────────────────────────────────────

function loadConfig(): InstagramConfig {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) throw new Error("INSTAGRAM_ACCESS_TOKEN is required");
  const pageId = process.env.INSTAGRAM_PAGE_ID;
  if (!pageId) throw new Error("INSTAGRAM_PAGE_ID is required");

  return {
    accessToken,
    pageId,
    appId: process.env.INSTAGRAM_APP_ID,
    appSecret: process.env.INSTAGRAM_APP_SECRET,
  };
}

// ─── Hook wrapper ────────────────────────────────────────────────────────────

async function executeWithHooks<T>(
  toolName: string,
  params: Record<string, unknown>,
  config: InstagramConfig,
  executor: () => Promise<ApiResponse<T>>
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
          2
        ),
      },
    ],
  };
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const config = loadConfig();
const client = new InstagramClient(config);

const server = new McpServer(
  { name: "bridgeapi-instagram-direct", version: "0.1.0" },
  {
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false },
      prompts: { listChanged: false },
    },
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS (18)
// ═══════════════════════════════════════════════════════════════════════════════

// 1 ── send_text_message ────────────────────────────────────────────────────
server.tool(
  "send_text_message",
  "Send a plain text message to a user via Instagram DM.",
  {
    recipient_id: z.string().describe("Instagram-scoped user ID (IGSID) of the recipient"),
    text: z.string().describe("Message text (max 1000 chars)"),
  },
  async ({ recipient_id, text }) =>
    executeWithHooks("send_text_message", { recipient_id, text }, config, () =>
      client.sendTextMessage(recipient_id, text)
    )
);

// 2 ── send_media_message ───────────────────────────────────────────────────
server.tool(
  "send_media_message",
  "Send an image, video, or audio attachment via Instagram DM.",
  {
    recipient_id: z.string().describe("Recipient IGSID"),
    media_type: z
      .enum(["image", "video", "audio"])
      .describe("Type of media to send"),
    media_url: z.string().url().describe("Public URL of the media file"),
  },
  async ({ recipient_id, media_type, media_url }) =>
    executeWithHooks(
      "send_media_message",
      { recipient_id, media_type, media_url },
      config,
      () => client.sendMediaMessage(recipient_id, media_type, media_url)
    )
);

// 3 ── send_quick_replies ───────────────────────────────────────────────────
server.tool(
  "send_quick_replies",
  "Send a text message with quick-reply buttons via Instagram DM.",
  {
    recipient_id: z.string().describe("Recipient IGSID"),
    text: z.string().describe("Message text displayed above the quick replies"),
    replies: z
      .array(
        z.object({
          title: z.string().describe("Button label (max 20 chars)"),
          payload: z.string().describe("Payload string sent back when tapped"),
        })
      )
      .min(1)
      .max(13)
      .describe("Quick-reply buttons (1-13)"),
  },
  async ({ recipient_id, text, replies }) =>
    executeWithHooks(
      "send_quick_replies",
      { recipient_id, text, replies },
      config,
      () => client.sendQuickReplies(recipient_id, text, replies)
    )
);

// 4 ── set_icebreakers ──────────────────────────────────────────────────────
server.tool(
  "set_icebreakers",
  "Configure icebreaker questions shown when a user opens a new DM conversation.",
  {
    icebreakers: z
      .array(
        z.object({
          question: z.string().describe("Question text displayed to the user"),
          payload: z.string().describe("Payload sent back when the user taps the question"),
        })
      )
      .min(1)
      .max(4)
      .describe("Icebreaker questions (1-4)"),
  },
  async ({ icebreakers }) =>
    executeWithHooks("set_icebreakers", { icebreakers }, config, () =>
      client.setIcebreakers(icebreakers)
    )
);

// 5 ── get_conversations ────────────────────────────────────────────────────
server.tool(
  "get_conversations",
  "List Instagram DM conversation threads. Optionally filter by a specific user.",
  {
    user_id: z
      .string()
      .optional()
      .describe("Filter conversations to a specific user IGSID"),
  },
  async ({ user_id }) =>
    executeWithHooks("get_conversations", { user_id }, config, () =>
      client.getConversations(user_id)
    )
);

// 6 ── get_conversation ─────────────────────────────────────────────────────
server.tool(
  "get_conversation",
  "Get full details of a single Instagram DM conversation including participants and messages.",
  {
    conversation_id: z.string().describe("Conversation (thread) ID"),
  },
  async ({ conversation_id }) =>
    executeWithHooks(
      "get_conversation",
      { conversation_id },
      config,
      () => client.getConversation(conversation_id)
    )
);

// 7 ── get_messages ─────────────────────────────────────────────────────────
server.tool(
  "get_messages",
  "Retrieve messages from a conversation thread with pagination.",
  {
    conversation_id: z.string().describe("Conversation (thread) ID"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe("Number of messages to return (default 20, max 100)"),
  },
  async ({ conversation_id, limit }) =>
    executeWithHooks(
      "get_messages",
      { conversation_id, limit },
      config,
      () => client.getMessages(conversation_id, limit)
    )
);

// 8 ── get_profile ──────────────────────────────────────────────────────────
server.tool(
  "get_profile",
  "Get the authenticated Instagram Professional account profile (bio, follower count, etc.).",
  {},
  async () =>
    executeWithHooks("get_profile", {}, config, () => client.getProfile())
);

// 9 ── get_media ────────────────────────────────────────────────────────────
server.tool(
  "get_media",
  "Get details of a specific Instagram media post (photo, video, carousel).",
  {
    media_id: z.string().describe("Media object ID"),
  },
  async ({ media_id }) =>
    executeWithHooks("get_media", { media_id }, config, () =>
      client.getMedia(media_id)
    )
);

// 10 ── list_media ──────────────────────────────────────────────────────────
server.tool(
  "list_media",
  "List recent media posts from the authenticated Instagram account.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe("Number of media items to return (default 20, max 100)"),
  },
  async ({ limit }) =>
    executeWithHooks("list_media", { limit }, config, () =>
      client.listMedia(limit)
    )
);

// 11 ── get_media_insights ──────────────────────────────────────────────────
server.tool(
  "get_media_insights",
  "Get performance insights for a specific media post (impressions, reach, engagement, saves).",
  {
    media_id: z.string().describe("Media object ID"),
  },
  async ({ media_id }) =>
    executeWithHooks("get_media_insights", { media_id }, config, () =>
      client.getMediaInsights(media_id)
    )
);

// 12 ── create_comment ──────────────────────────────────────────────────────
server.tool(
  "create_comment",
  "Post a comment on an Instagram media object.",
  {
    media_id: z.string().describe("Media object ID to comment on"),
    text: z.string().describe("Comment text"),
  },
  async ({ media_id, text }) =>
    executeWithHooks("create_comment", { media_id, text }, config, () =>
      client.createComment(media_id, text)
    )
);

// 13 ── get_comments ────────────────────────────────────────────────────────
server.tool(
  "get_comments",
  "List comments on an Instagram media post.",
  {
    media_id: z.string().describe("Media object ID"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe("Number of comments to return (default 20)"),
  },
  async ({ media_id, limit }) =>
    executeWithHooks("get_comments", { media_id, limit }, config, () =>
      client.getComments(media_id, limit)
    )
);

// 14 ── get_stories ─────────────────────────────────────────────────────────
server.tool(
  "get_stories",
  "Get currently active (non-expired) Instagram stories from the authenticated account.",
  {},
  async () =>
    executeWithHooks("get_stories", {}, config, () => client.getStories())
);

// 15 ── get_story_insights ──────────────────────────────────────────────────
server.tool(
  "get_story_insights",
  "Get performance insights for a specific Instagram story (impressions, reach, replies, taps).",
  {
    story_id: z.string().describe("Story media ID"),
  },
  async ({ story_id }) =>
    executeWithHooks("get_story_insights", { story_id }, config, () =>
      client.getStoryInsights(story_id)
    )
);

// 16 ── mark_message_seen ───────────────────────────────────────────────────
server.tool(
  "mark_message_seen",
  "Send a read receipt (mark as seen) for a specific Instagram DM message.",
  {
    message_id: z.string().describe("Message ID to mark as seen"),
  },
  async ({ message_id }) =>
    executeWithHooks("mark_message_seen", { message_id }, config, () =>
      client.markMessageSeen(message_id)
    )
);

// 17 ── send_reaction ───────────────────────────────────────────────────────
server.tool(
  "send_reaction",
  "React to an Instagram DM message with an emoji reaction.",
  {
    message_id: z.string().describe("Message ID to react to"),
    reaction: z
      .enum(["love", "laugh", "wow", "sad", "angry", "like"])
      .describe("Reaction type"),
  },
  async ({ message_id, reaction }) =>
    executeWithHooks("send_reaction", { message_id, reaction }, config, () =>
      client.sendReaction(message_id, reaction)
    )
);

// 18 ── get_followers ───────────────────────────────────────────────────────
server.tool(
  "get_followers",
  "Get follower information for the Instagram Professional account.",
  {},
  async () =>
    executeWithHooks("get_followers", {}, config, () => client.getFollowers())
);

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCES (3)
// ═══════════════════════════════════════════════════════════════════════════════

server.resource(
  "conversations",
  "instagram://conversations",
  async () => {
    const result = await client.getConversations();
    return {
      contents: [
        {
          uri: "instagram://conversations",
          mimeType: "application/json",
          text: JSON.stringify(result.data ?? result.error, null, 2),
        },
      ],
    };
  }
);

server.resource(
  "profile",
  "instagram://profile",
  async () => {
    const result = await client.getProfile();
    return {
      contents: [
        {
          uri: "instagram://profile",
          mimeType: "application/json",
          text: JSON.stringify(result.data ?? result.error, null, 2),
        },
      ],
    };
  }
);

server.resource(
  "media",
  "instagram://media",
  async () => {
    const result = await client.listMedia(50);
    return {
      contents: [
        {
          uri: "instagram://media",
          mimeType: "application/json",
          text: JSON.stringify(result.data ?? result.error, null, 2),
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS (3, PT-BR)
// ═══════════════════════════════════════════════════════════════════════════════

server.prompt(
  "atendimento-dm",
  "Guia completo para atendimento ao cliente via Instagram DM",
  {
    contexto: z
      .string()
      .optional()
      .describe("Contexto adicional sobre o atendimento"),
  },
  ({ contexto }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "Voce e um assistente de atendimento via Instagram Direct.",
            "Siga estas diretrizes:",
            "",
            "1. Use get_conversations para listar conversas recentes.",
            "2. Use get_messages para ler o historico de cada conversa.",
            "3. Responda com send_text_message de forma cordial e profissional.",
            "4. Para respostas rapidas use send_quick_replies com opcoes claras.",
            "5. Marque mensagens lidas com mark_message_seen apos ler.",
            "6. Use send_reaction para reagir a mensagens quando apropriado.",
            "7. Envie midias com send_media_message quando necessario (catalogo, tutorial).",
            "",
            "Regras:",
            "- Tempo de resposta maximo: analise e responda o mais rapido possivel.",
            "- Tom de voz: amigavel, objetivo e prestativo.",
            "- Sempre confirme o entendimento antes de tomar acoes.",
            "- Escalone para humano quando a situacao exigir.",
            contexto ? `\nContexto adicional: ${contexto}` : "",
          ].join("\n"),
        },
      },
    ],
  })
);

server.prompt(
  "engajamento",
  "Estrategia de engajamento para Instagram (comentarios, reacoes, DMs)",
  {
    objetivo: z
      .string()
      .optional()
      .describe("Objetivo especifico de engajamento"),
  },
  ({ objetivo }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "Voce e um especialista em engajamento no Instagram.",
            "Use as ferramentas disponiveis para executar uma estrategia de engajamento:",
            "",
            "1. Use list_media para ver os posts recentes.",
            "2. Use get_comments para analisar comentarios em cada post.",
            "3. Responda comentarios com create_comment de forma autentica.",
            "4. Use get_media_insights para identificar posts com melhor desempenho.",
            "5. Use get_conversations para acompanhar DMs de seguidores engajados.",
            "6. Envie mensagens personalizadas com send_text_message para nutrir relacionamentos.",
            "7. Use get_stories e get_story_insights para avaliar o desempenho dos stories.",
            "",
            "Metricas-chave: impressoes, alcance, salvamentos, compartilhamentos, respostas.",
            "Priorize interacoes genuinas e que gerem conversa.",
            objetivo ? `\nObjetivo especifico: ${objetivo}` : "",
          ].join("\n"),
        },
      },
    ],
  })
);

server.prompt(
  "analise-stories",
  "Analise de desempenho de Instagram Stories com recomendacoes",
  {
    periodo: z
      .string()
      .optional()
      .describe("Periodo de analise (ex: ultima semana)"),
  },
  ({ periodo }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "Voce e um analista de performance de Instagram Stories.",
            "Realize uma analise completa seguindo estes passos:",
            "",
            "1. Use get_stories para listar os stories ativos.",
            "2. Para cada story, use get_story_insights para coletar metricas.",
            "3. Analise as metricas: impressoes, alcance, respostas, toques pra frente/tras, saidas.",
            "4. Identifique padroes — quais tipos de story performam melhor.",
            "5. Use get_profile para contextualizar os numeros (base de seguidores).",
            "",
            "Gere um relatorio com:",
            "- Resumo geral de desempenho",
            "- Top stories por engajamento",
            "- Taxa de retencao (toques pra frente vs saidas)",
            "- Recomendacoes praticas para melhorar o desempenho",
            periodo ? `\nPeriodo de analise: ${periodo}` : "",
          ].join("\n"),
        },
      },
    ],
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BridgeAPI Instagram Direct MCP Server v0.1.0 running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
