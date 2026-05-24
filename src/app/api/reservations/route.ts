import { NextRequest, NextResponse } from "next/server";
import { reserveStockSchema } from "@/lib/validators";
import { InsufficientStockError } from "@/lib/errors";
import { createReservation } from "@/services/reservation.service";
import {
  getIdempotentResponse,
  cacheIdempotentResponse,
} from "@/services/idempotency.service";

/**
 * POST /api/reservations
 *
 * Reserve stock for a product in a specific warehouse.
 *
 * This is the CORE endpoint — must be correct under concurrency.
 * Uses PostgreSQL SELECT ... FOR UPDATE to guarantee that if two
 * requests come in simultaneously for the last unit, exactly one
 * succeeds and the other gets 409.
 *
 * Supports optional Idempotency-Key header to prevent duplicate
 * reservations from retries or double-clicks.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Check Idempotency-Key (Bonus Feature) ──
    const idempotencyKey = request.headers.get("idempotency-key");

    if (idempotencyKey) {
      const cached = await getIdempotentResponse(idempotencyKey);
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.status });
      }
    }

    // ── Parse and validate request body ──
    const body = await request.json();
    const validation = reserveStockSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validation.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = validation.data;

    // ── Create reservation (with pessimistic locking) ──
    const reservation = await createReservation(
      productId,
      warehouseId,
      quantity,
      idempotencyKey || undefined
    );

    // Cache the response for idempotency
    if (idempotencyKey) {
      await cacheIdempotentResponse(idempotencyKey, 201, reservation as unknown as Record<string, unknown>);
    }

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    // ── Handle known domain errors ──
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        {
          error: "Insufficient stock available",
          details: error.message,
          available: error.available,
          requested: error.requested,
        },
        { status: 409 }
      );
    }

    console.error("[POST /api/reservations] Error:", error);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}
