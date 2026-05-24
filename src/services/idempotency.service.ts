import { redis } from "@/lib/redis";
import { REDIS_KEYS, IDEMPOTENCY_TTL_SECONDS } from "@/lib/constants";

/**
 * Idempotency service (Bonus Feature)
 *
 * Prevents duplicate reservations when a client retries a request
 * with the same Idempotency-Key header.
 *
 * Flow:
 *   1. Client sends POST /api/reservations with header `Idempotency-Key: <uuid>`
 *   2. We check Redis for `idempotency:<uuid>`
 *   3. If found → return the cached response (no side-effect repeated)
 *   4. If not found → process the request, cache the response with a TTL
 */

interface CachedResponse {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Check if a response for this idempotency key already exists.
 * Returns the cached response if found, null otherwise.
 */
export async function getIdempotentResponse(
  key: string
): Promise<CachedResponse | null> {
  if (!redis) return null;

  try {
    const cached = await redis.get<CachedResponse>(
      `${REDIS_KEYS.IDEMPOTENCY}${key}`
    );
    return cached || null;
  } catch (error) {
    console.error("[Idempotency] Failed to check key:", error);
    return null; // Fail open — don't block the request
  }
}

/**
 * Cache a response for an idempotency key.
 */
export async function cacheIdempotentResponse(
  key: string,
  status: number,
  body: Record<string, unknown>
): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(
      `${REDIS_KEYS.IDEMPOTENCY}${key}`,
      { status, body },
      { ex: IDEMPOTENCY_TTL_SECONDS }
    );
  } catch (error) {
    console.error("[Idempotency] Failed to cache response:", error);
    // Fail open — the reservation was already created successfully
  }
}
