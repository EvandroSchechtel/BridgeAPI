/**
 * BridgeAPI Gateway — Redis Client (Rate Limiting)
 *
 * Phase 1: In-memory fallback when Redis is not available.
 * Production: Connect to Redis for distributed rate limiting.
 */

// In-memory rate limit store (fallback when Redis unavailable)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const PLAN_LIMITS: Record<string, number> = {
  free: 100,       // 100 calls/hour
  starter: 1_000,  // 1K calls/hour
  pro: 10_000,     // 10K calls/hour
  enterprise: 100_000, // 100K calls/hour
};

/**
 * Check rate limit using sliding window (in-memory for Phase 1).
 * Phase 2: Replace with Redis MULTI/EXEC sliding window.
 */
export async function checkRateLimit(
  clientId: string,
  plan: string
): Promise<RateLimitResult> {
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const windowMs = 60 * 60 * 1000; // 1 hour
  const key = `rate:${clientId}`;
  const now = Date.now();

  const entry = memoryStore.get(key);

  if (!entry || now >= entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  entry.count++;

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
