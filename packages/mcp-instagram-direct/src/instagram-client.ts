#!/usr/bin/env node
/**
 * Instagram Graph API Client
 * @bridgeapi/mcp-instagram-direct
 *
 * Handles all communication with the Instagram Graph API (v21.0)
 * and the Facebook Graph API (v21.0) for messaging endpoints.
 */

// ─── Configuration ───────────────────────────────────────────────────────────

export interface InstagramConfig {
  accessToken: string;
  pageId: string;
  appId?: string;
  appSecret?: string;
}

// ─── Response types ──────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: number; message: string; details?: unknown };
  meta: { latency_ms: number; endpoint: string; method: string };
}

// ─── Hook system (BridgeAPI governance layer) ────────────────────────────────

export interface HookContext {
  tool_name: string;
  params: Record<string, unknown>;
  config: InstagramConfig;
  timestamp: string;
}

export interface PreHookResult {
  allow: boolean;
  reason?: string;
  escalation_id?: string;
}

export interface PostHookResult {
  accept: boolean;
  flags?: string[];
}

export async function preExecuteHook(_ctx: HookContext): Promise<PreHookResult> {
  return { allow: true };
}

export async function postExecuteHook(
  _ctx: HookContext,
  _response: ApiResponse
): Promise<PostHookResult> {
  return { accept: true };
}

// ─── Instagram Graph API data shapes ─────────────────────────────────────────

export interface InstagramProfile {
  id: string;
  name?: string;
  username?: string;
  biography?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  profile_picture_url?: string;
  website?: string;
}

export interface InstagramMessage {
  id: string;
  created_time?: string;
  from?: { id: string; username?: string; name?: string };
  to?: { data: Array<{ id: string; username?: string; name?: string }> };
  message?: string;
  attachments?: { data: Array<{ type: string; url?: string }> };
}

export interface InstagramConversation {
  id: string;
  updated_time?: string;
  participants?: { data: Array<{ id: string; username?: string; name?: string }> };
  messages?: { data: InstagramMessage[] };
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  children?: { data: Array<{ id: string; media_type: string; media_url: string }> };
}

export interface InstagramComment {
  id: string;
  text?: string;
  timestamp?: string;
  from?: { id: string; username?: string };
  like_count?: number;
  replies?: { data: InstagramComment[] };
}

export interface InstagramStory {
  id: string;
  media_type?: string;
  media_url?: string;
  timestamp?: string;
  caption?: string;
}

export interface QuickReply {
  title: string;
  payload: string;
}

export interface Icebreaker {
  question: string;
  payload: string;
}

// ─── Client ──────────────────────────────────────────────────────────────────

const IG_BASE = "https://graph.instagram.com/v21.0";
const FB_BASE = "https://graph.facebook.com/v21.0";

export class InstagramClient {
  private config: InstagramConfig;

  constructor(config: InstagramConfig) {
    this.config = config;
  }

  // ── Low-level request helpers ────────────────────────────────────────────

  /**
   * Generic request against the Instagram Graph API.
   */
  async igRequest<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    body?: unknown
  ): Promise<ApiResponse<T>> {
    return this.request<T>(IG_BASE, endpoint, method, body);
  }

  /**
   * Generic request against the Facebook Graph API (used for messaging).
   */
  async fbRequest<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    body?: unknown
  ): Promise<ApiResponse<T>> {
    return this.request<T>(FB_BASE, endpoint, method, body);
  }

  private async request<T = unknown>(
    base: string,
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    body?: unknown
  ): Promise<ApiResponse<T>> {
    // Append access_token as query param for GET, or keep in body for POST
    const separator = endpoint.includes("?") ? "&" : "?";
    const url =
      method === "GET"
        ? `${base}${endpoint}${separator}access_token=${this.config.accessToken}`
        : `${base}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // For non-GET requests the token goes in the Authorization header
    if (method !== "GET") {
      headers["Authorization"] = `Bearer ${this.config.accessToken}`;
    }

    const start = Date.now();

    try {
      const res = await fetch(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const data = (await res.json()) as Record<string, unknown>;
      const latency_ms = Date.now() - start;

      if (!res.ok) {
        const igError = data.error as Record<string, unknown> | undefined;
        return {
          success: false,
          error: {
            code: res.status,
            message: igError
              ? String(igError.message)
              : `HTTP ${res.status}`,
            details: data,
          },
          meta: { latency_ms, endpoint, method },
        };
      }

      return { success: true, data: data as T, meta: { latency_ms, endpoint, method } };
    } catch (err) {
      return {
        success: false,
        error: {
          code: -1,
          message: err instanceof Error ? err.message : "Unknown error",
        },
        meta: { latency_ms: Date.now() - start, endpoint, method },
      };
    }
  }

  // ── Messaging (Instagram Messaging API via Facebook Graph) ───────────────

  /**
   * Send a plain text message to a user via Instagram DM.
   */
  async sendTextMessage(
    recipientId: string,
    text: string
  ): Promise<ApiResponse> {
    return this.fbRequest(`/${this.config.pageId}/messages`, "POST", {
      recipient: { id: recipientId },
      message: { text },
    });
  }

  /**
   * Send a media attachment (image, video, audio) via Instagram DM.
   */
  async sendMediaMessage(
    recipientId: string,
    type: "image" | "video" | "audio",
    url: string
  ): Promise<ApiResponse> {
    return this.fbRequest(`/${this.config.pageId}/messages`, "POST", {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type,
          payload: { url, is_reusable: true },
        },
      },
    });
  }

  /**
   * Send a text message with quick-reply buttons.
   */
  async sendQuickReplies(
    recipientId: string,
    text: string,
    replies: QuickReply[]
  ): Promise<ApiResponse> {
    return this.fbRequest(`/${this.config.pageId}/messages`, "POST", {
      recipient: { id: recipientId },
      message: {
        text,
        quick_replies: replies.map((r) => ({
          content_type: "text",
          title: r.title,
          payload: r.payload,
        })),
      },
    });
  }

  /**
   * Configure icebreaker questions that appear when a user opens
   * a new conversation with the Instagram Professional account.
   */
  async setIcebreakers(icebreakers: Icebreaker[]): Promise<ApiResponse> {
    return this.fbRequest(`/${this.config.pageId}/messenger_profile`, "POST", {
      ice_breakers: icebreakers.map((ib) => ({
        question: ib.question,
        payload: ib.payload,
      })),
    });
  }

  /**
   * Mark a specific message as seen (read receipt).
   */
  async markMessageSeen(messageId: string): Promise<ApiResponse> {
    return this.fbRequest(`/${this.config.pageId}/messages`, "POST", {
      recipient: { id: messageId },
      sender_action: "mark_seen",
    });
  }

  /**
   * Send a reaction emoji to a message.
   */
  async sendReaction(
    messageId: string,
    reaction: "love" | "laugh" | "wow" | "sad" | "angry" | "like"
  ): Promise<ApiResponse> {
    return this.fbRequest(`/${messageId}/reactions`, "POST", {
      reaction_type: reaction,
    });
  }

  // ── Conversations ────────────────────────────────────────────────────────

  /**
   * List conversations (threads) for the Instagram account.
   * Optionally filter by a specific user_id.
   */
  async getConversations(
    userId?: string
  ): Promise<ApiResponse<{ data: InstagramConversation[] }>> {
    const fields = "participants,updated_time,messages{id,created_time,from,to,message}";
    let endpoint = `/${this.config.pageId}/conversations?platform=instagram&fields=${encodeURIComponent(fields)}`;
    if (userId) {
      endpoint += `&user_id=${userId}`;
    }
    return this.igRequest(endpoint);
  }

  /**
   * Get a single conversation by its ID.
   */
  async getConversation(
    conversationId: string
  ): Promise<ApiResponse<InstagramConversation>> {
    const fields = "participants,updated_time,messages{id,created_time,from,to,message,attachments}";
    return this.igRequest(
      `/${conversationId}?fields=${encodeURIComponent(fields)}`
    );
  }

  /**
   * Get messages inside a conversation.
   */
  async getMessages(
    conversationId: string,
    limit = 20
  ): Promise<ApiResponse<{ data: InstagramMessage[] }>> {
    const fields = "id,created_time,from,to,message,attachments";
    return this.igRequest(
      `/${conversationId}/messages?fields=${encodeURIComponent(fields)}&limit=${limit}`
    );
  }

  // ── Profile ──────────────────────────────────────────────────────────────

  /**
   * Get the authenticated Instagram Professional account profile.
   */
  async getProfile(): Promise<ApiResponse<InstagramProfile>> {
    const fields =
      "id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website";
    return this.igRequest(`/me?fields=${encodeURIComponent(fields)}`);
  }

  /**
   * Get followers (via the Facebook page linked to the IG account).
   */
  async getFollowers(): Promise<ApiResponse<{ data: Array<{ id: string; username?: string; name?: string }> }>> {
    return this.fbRequest(
      `/${this.config.pageId}?fields=instagram_business_account{followers_count}`
    );
  }

  /**
   * Get following count.
   */
  async getFollowing(): Promise<ApiResponse<{ data: Array<{ id: string; username?: string; name?: string }> }>> {
    return this.fbRequest(
      `/${this.config.pageId}?fields=instagram_business_account{follows_count}`
    );
  }

  // ── Media ────────────────────────────────────────────────────────────────

  /**
   * Get details of a single media object.
   */
  async getMedia(mediaId: string): Promise<ApiResponse<InstagramMedia>> {
    const fields =
      "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{id,media_type,media_url}";
    return this.igRequest(`/${mediaId}?fields=${encodeURIComponent(fields)}`);
  }

  /**
   * List recent media for the authenticated account.
   */
  async listMedia(
    limit = 20
  ): Promise<ApiResponse<{ data: InstagramMedia[] }>> {
    const fields =
      "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
    return this.igRequest(
      `/me/media?fields=${encodeURIComponent(fields)}&limit=${limit}`
    );
  }

  /**
   * Get insights/metrics for a specific media object.
   */
  async getMediaInsights(
    mediaId: string
  ): Promise<ApiResponse<{ data: Array<{ name: string; values: Array<{ value: number }> }> }>> {
    const metric =
      "impressions,reach,engagement,saved,video_views,likes,comments,shares";
    return this.igRequest(
      `/${mediaId}/insights?metric=${encodeURIComponent(metric)}`
    );
  }

  /**
   * Create a comment on a media object.
   */
  async createComment(
    mediaId: string,
    text: string
  ): Promise<ApiResponse<{ id: string }>> {
    return this.igRequest(`/${mediaId}/comments`, "POST", { message: text });
  }

  /**
   * List comments on a media object.
   */
  async getComments(
    mediaId: string,
    limit = 20
  ): Promise<ApiResponse<{ data: InstagramComment[] }>> {
    const fields = "id,text,timestamp,from,like_count,replies{id,text,timestamp,from}";
    return this.igRequest(
      `/${mediaId}/comments?fields=${encodeURIComponent(fields)}&limit=${limit}`
    );
  }

  // ── Stories ──────────────────────────────────────────────────────────────

  /**
   * Get current (active) stories for the authenticated account.
   */
  async getStories(): Promise<ApiResponse<{ data: InstagramStory[] }>> {
    const fields = "id,media_type,media_url,timestamp,caption";
    return this.igRequest(
      `/me/stories?fields=${encodeURIComponent(fields)}`
    );
  }

  /**
   * Get insights for a specific story.
   */
  async getStoryInsights(
    storyId: string
  ): Promise<ApiResponse<{ data: Array<{ name: string; values: Array<{ value: number }> }> }>> {
    const metric = "impressions,reach,replies,taps_forward,taps_back,exits";
    return this.igRequest(
      `/${storyId}/insights?metric=${encodeURIComponent(metric)}`
    );
  }
}
