import { Redis } from "@upstash/redis";

/**
 * Upstash Redis client — REST-based, works in serverless/edge.
 * Used for idempotency key caching and optional distributed locking.
 *
 * Falls back gracefully if env vars are not set (e.g., local dev without Redis).
 */
function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn(
      "[Redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. Redis features (idempotency) will be disabled."
    );
    return null;
  }

  return new Redis({ url, token });
}

export const redis = createRedisClient();
