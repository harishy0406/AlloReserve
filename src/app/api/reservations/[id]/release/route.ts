import { NextResponse } from "next/server";
import { releaseReservation } from "@/services/reservation.service";
import {
  ReservationNotFoundError,
  InvalidReservationStateError,
} from "@/lib/errors";

/**
 * POST /api/reservations/:id/release
 *
 * Release a pending reservation early (payment failed or user cancelled).
 * Returns reserved stock back to available immediately.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reservation = await releaseReservation(id);
    return NextResponse.json(reservation);
  } catch (error) {
    if (error instanceof ReservationNotFoundError) {
      return NextResponse.json(
        { error: "Reservation not found", details: error.message },
        { status: 404 }
      );
    }

    if (error instanceof InvalidReservationStateError) {
      return NextResponse.json(
        {
          error: "Cannot release reservation",
          details: error.message,
        },
        { status: 400 }
      );
    }

    console.error("[POST /api/reservations/:id/release] Error:", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
