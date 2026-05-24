import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { RESERVATION_TTL_MINUTES } from "@/lib/constants";
import {
  InsufficientStockError,
  ReservationExpiredError,
  ReservationNotFoundError,
  InvalidReservationStateError,
} from "@/lib/errors";
import type { ReservationResponse } from "@/lib/validators";

// ──────────────────────────────────────────────
// Type for raw SQL query results
// ──────────────────────────────────────────────
interface InventoryRow {
  id: string;
  productId: string;
  warehouseId: string;
  totalStock: number;
  reservedStock: number;
}

interface ReservationRow {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: string;
  expiresAt: Date;
}

// ──────────────────────────────────────────────
// CREATE RESERVATION (with Pessimistic Locking)
// ──────────────────────────────────────────────

/**
 * Reserve stock for a product in a specific warehouse.
 *
 * CONCURRENCY STRATEGY:
 *   Uses PostgreSQL `SELECT ... FOR UPDATE` to acquire an exclusive row-level
 *   lock on the Inventory record. This ensures that if two requests arrive
 *   simultaneously for the last unit, exactly ONE succeeds and the other
 *   gets a 409 (InsufficientStockError).
 *
 *   The lock is held only for the duration of the transaction (~ms) and
 *   released automatically on commit/rollback.
 */
export async function createReservation(
  productId: string,
  warehouseId: string,
  quantity: number,
  idempotencyKey?: string
): Promise<ReservationResponse> {
  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // ── Step 1: Lock the inventory row with SELECT ... FOR UPDATE ──
      // This blocks any concurrent transaction trying to read the same row
      // until this transaction completes (commits or rolls back).
      const inventoryRows = await tx.$queryRaw<InventoryRow[]>`
        SELECT "id", "productId", "warehouseId", "totalStock", "reservedStock"
        FROM "Inventory"
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (inventoryRows.length === 0) {
        throw new Error(
          `No inventory record found for product ${productId} in warehouse ${warehouseId}`
        );
      }

      const inventory = inventoryRows[0];

      // ── Step 2: Check available stock ──
      const availableStock = inventory.totalStock - inventory.reservedStock;

      if (availableStock < quantity) {
        throw new InsufficientStockError(availableStock, quantity);
      }

      // ── Step 3: Increment reserved stock ──
      await tx.inventory.update({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
        data: {
          reservedStock: { increment: quantity },
        },
      });

      // ── Step 4: Create the reservation record ──
      const expiresAt = new Date(
        Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
      );

      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "PENDING",
          expiresAt,
          idempotencyKey: idempotencyKey || null,
        },
      });

      return reservation;
    },
    {
      // Transaction isolation level — SERIALIZABLE would be strongest but
      // FOR UPDATE with READ COMMITTED is sufficient and more performant
      isolationLevel: "ReadCommitted",
      timeout: 10000, // 10 second timeout to prevent deadlocks
    }
  );

  return formatReservation(result);
}

// ──────────────────────────────────────────────
// CONFIRM RESERVATION (Payment Succeeded)
// ──────────────────────────────────────────────

/**
 * Confirm a pending reservation after successful payment.
 *
 * This permanently decrements stock (both totalStock and reservedStock)
 * and transitions the reservation to CONFIRMED.
 *
 * Returns 410 Gone if the reservation has expired.
 */
export async function confirmReservation(
  reservationId: string
): Promise<ReservationResponse> {
  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Lock the reservation row
      const reservationRows = await tx.$queryRaw<ReservationRow[]>`
        SELECT "id", "productId", "warehouseId", "quantity", "status", "expiresAt"
        FROM "Reservation"
        WHERE "id" = ${reservationId}
        FOR UPDATE
      `;

      if (reservationRows.length === 0) {
        throw new ReservationNotFoundError(reservationId);
      }

      const reservation = reservationRows[0];

      // Check if reservation is in a confirmable state
      if (reservation.status !== "PENDING") {
        throw new InvalidReservationStateError(
          reservationId,
          reservation.status,
          "PENDING"
        );
      }

      // Check if reservation has expired
      if (new Date(reservation.expiresAt) <= new Date()) {
        // Auto-release the expired reservation
        await tx.inventory.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: {
            reservedStock: { decrement: reservation.quantity },
          },
        });

        await tx.reservation.update({
          where: { id: reservationId },
          data: { status: "RELEASED" },
        });

        throw new ReservationExpiredError(reservationId);
      }

      // ── Confirm: permanently decrement stock ──
      // Decrease both totalStock (physical units sold) and
      // reservedStock (units no longer pending)
      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          totalStock: { decrement: reservation.quantity },
          reservedStock: { decrement: reservation.quantity },
        },
      });

      // Mark reservation as confirmed
      const confirmed = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: "CONFIRMED" },
      });

      return confirmed;
    },
    {
      isolationLevel: "ReadCommitted",
      timeout: 10000,
    }
  );

  return formatReservation(result);
}

// ──────────────────────────────────────────────
// RELEASE RESERVATION (Payment Failed / Cancelled)
// ──────────────────────────────────────────────

/**
 * Release a pending reservation early (payment failed or user cancelled).
 * Returns reserved stock back to available.
 */
export async function releaseReservation(
  reservationId: string
): Promise<ReservationResponse> {
  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Lock the reservation row
      const reservationRows = await tx.$queryRaw<ReservationRow[]>`
        SELECT "id", "productId", "warehouseId", "quantity", "status", "expiresAt"
        FROM "Reservation"
        WHERE "id" = ${reservationId}
        FOR UPDATE
      `;

      if (reservationRows.length === 0) {
        throw new ReservationNotFoundError(reservationId);
      }

      const reservation = reservationRows[0];

      // Only PENDING reservations can be released
      if (reservation.status !== "PENDING") {
        throw new InvalidReservationStateError(
          reservationId,
          reservation.status,
          "PENDING"
        );
      }

      // Return reserved stock to available
      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          reservedStock: { decrement: reservation.quantity },
        },
      });

      // Mark reservation as released
      const released = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: "RELEASED" },
      });

      return released;
    },
    {
      isolationLevel: "ReadCommitted",
      timeout: 10000,
    }
  );

  return formatReservation(result);
}

// ──────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────

function formatReservation(reservation: {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}): ReservationResponse {
  return {
    id: reservation.id,
    productId: reservation.productId,
    warehouseId: reservation.warehouseId,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
    createdAt: reservation.createdAt.toISOString(),
  };
}
