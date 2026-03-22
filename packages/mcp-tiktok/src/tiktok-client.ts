/**
 * TikTok Content API Client
 * @bridgeapi/mcp-tiktok
 *
 * Docs: https://developers.tiktok.com/doc/content-posting-api
 */

// ─── Config & Types ──────────────────────────────────────────────
export interface TikTokConfig {
  accessToken: string;
  appId: string;
  appSecret: string;
  openId: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: number; message: string; details?: unknown };
  meta: { latency_ms: number; endpoint: string; method: string };
}

export interface HookContext {
  tool_name: string;
  params: Record<string, unknown>;
  config: TikTokConfig;
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

// ─── Hooks (extensible) ──────────────────────────────────────────
export async function preExecuteHook(
  _ctx: HookContext,
): Promise<PreHookResult> {
  return { allow: true };
}

export async function postExecuteHook(
  _ctx: HookContext,
  _response: ApiResponse,
): Promise<PostHookResult> {
  return { accept: true };
}

// ─── Client ──────────────────────────────────────────────────────
export class TikTokClient {
  private config: TikTokConfig;
  private baseUrl = "https://open.tiktokapis.com/v2";

  constructor(config: TikTokConfig) {
    this.config = config;
  }

  // Generic request helper
  async request<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    body?: unknown,
    queryParams?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    let url = `${this.baseUrl}${endpoint}`;
    if (queryParams) {
      const qs = new URLSearchParams(queryParams).toString();
      url += `?${qs}`;
    }

    const start = Date.now();
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const data = (await res.json()) as Record<string, unknown>;
      const latency_ms = Date.now() - start;

      if (!res.ok) {
        return {
          success: false,
          error: {
            code: res.status,
            message: String(
              (data as Record<string, unknown>).error?.toString() ??
                (data as Record<string, unknown>).message ??
                `HTTP ${res.status}`,
            ),
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

  // ─── User ────────────────────────────────────────────────────
  async getUserInfo(): Promise<ApiResponse> {
    return this.request("/user/info/", "GET", undefined, {
      fields: "open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count",
    });
  }

  // ─── Videos ──────────────────────────────────────────────────
  async getUserVideos(
    max_count = 20,
    cursor?: number,
  ): Promise<ApiResponse> {
    const body: Record<string, unknown> = { max_count };
    if (cursor !== undefined) body.cursor = cursor;
    return this.request(
      "/video/list/",
      "POST",
      body,
      { fields: "id,title,video_description,duration,cover_image_url,share_url,create_time,like_count,comment_count,share_count,view_count" },
    );
  }

  async getVideoInfo(video_id: string): Promise<ApiResponse> {
    return this.request(
      "/video/query/",
      "POST",
      { filters: { video_ids: [video_id] } },
      { fields: "id,title,video_description,duration,cover_image_url,share_url,embed_link,create_time,like_count,comment_count,share_count,view_count" },
    );
  }

  async deleteVideo(video_id: string): Promise<ApiResponse> {
    return this.request("/video/delete/", "POST", { video_id });
  }

  async publishVideo(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.request("/post/publish/video/init/", "POST", data);
  }

  // ─── Comments ────────────────────────────────────────────────
  async getVideoComments(video_id: string): Promise<ApiResponse> {
    return this.request("/comment/list/", "POST", {
      video_id,
      max_count: 50,
    });
  }

  async replyToComment(comment_id: string, text: string): Promise<ApiResponse> {
    return this.request("/comment/reply/", "POST", {
      comment_id,
      text,
    });
  }

  // ─── Analytics ───────────────────────────────────────────────
  async getVideoAnalytics(video_id: string): Promise<ApiResponse> {
    return this.request(
      "/research/video/query/",
      "POST",
      { filters: { video_ids: [video_id] } },
      { fields: "id,like_count,comment_count,share_count,view_count,create_time" },
    );
  }

  async getCreatorInsights(): Promise<ApiResponse> {
    return this.request("/business/get/", "GET", undefined, {
      fields: "audience_countries,audience_genders,audience_ages",
    });
  }

  // ─── Followers ───────────────────────────────────────────────
  async getFollowersList(max_count = 100): Promise<ApiResponse> {
    return this.request("/user/follower/list/", "POST", { max_count });
  }

  // ─── Search & Discovery ──────────────────────────────────────
  async searchVideos(query: string): Promise<ApiResponse> {
    return this.request("/research/video/query/", "POST", {
      query,
      max_count: 20,
    });
  }

  async getHashtagInfo(hashtag: string): Promise<ApiResponse> {
    return this.request("/research/hashtag/query/", "POST", {
      keyword: hashtag,
    });
  }

  async getTrendingHashtags(): Promise<ApiResponse> {
    return this.request("/research/hashtag/trending/", "GET");
  }

  // ─── Liked Videos ────────────────────────────────────────────
  async getLikedVideos(max_count = 20): Promise<ApiResponse> {
    return this.request("/user/liked_videos/", "POST", { max_count });
  }
}
