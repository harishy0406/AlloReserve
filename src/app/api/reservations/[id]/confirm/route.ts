import { NextResponse } from "next/server";
import { confirmReservation } from "@/services/reservation.service";
import {
  ReservationExpiredError,
  ReservationNotFoundError,
  InvalidReservationStateError,
} from "@/lib/errors";

/**
 * POST /api/reservations/:id/confirm
 *
 * Confirm a pending reservation after successful payment.
 * Permanently decrements stock. Returns 410 if expired.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reservation = await confirmReservation(id);
    return NextResponse.json(reservation);
  } catch (error) {
    if (error instanceof ReservationNotFoundError) {
      return NextResponse.json(
        { error: "Reservation not found", details: error.message },
        { status: 404 }
      );
    }

    if (error instanceof ReservationExpiredError) {
      return NextResponse.json(
        { error: "Reservation has expired", details: error.message },
        { status: 410 }
      );
    }

    if (error instanceof InvalidReservationStateError) {
      return NextResponse.json(
        { error: "Invalid reservation state", details: error.message },
        { status: 400 }
      );
    }

    console.error("[POST /api/reservations/:id/confirm] Error:", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}
