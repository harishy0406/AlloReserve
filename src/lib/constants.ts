/**
 * Application-wide constants
 */

/** How long a reservation stays active before auto-expiry (in minutes) */
export const RESERVATION_TTL_MINUTES = parseInt(
  process.env.RESERVATION_TTL_MINUTES || "10",
  10
);

/** Reservation statuses (mirrors the Prisma enum for use in services) */
export const ReservationStatusEnum = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  RELEASED: "RELEASED",
} as const;

/** Idempotency key TTL in seconds (1 hour) */
export const IDEMPOTENCY_TTL_SECONDS = 3600;

/** Redis key prefixes */
export const REDIS_KEYS = {
  IDEMPOTENCY: "idempotency:",
} as const;
