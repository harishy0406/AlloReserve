import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * Cleanup service — releases expired pending reservations back to available stock.
 *
 * This is invoked:
 *   1. Lazily on every GET /api/products request (ensures always-accurate counts)
 *   2. Periodically via Vercel Cron at GET /api/cron/cleanup (bulk hygiene)
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  // Find all expired pending reservations
  const expiredReservations = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
  });

  if (expiredReservations.length === 0) {
    return 0;
  }

  let releasedCount = 0;

  // Release each expired reservation in its own transaction for safety
  for (const reservation of expiredReservations) {
    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Lock the reservation row to prevent race conditions with confirm/release
        const locked = await tx.$queryRaw<
          Array<{ id: string; status: string }>
        >`
          SELECT "id", "status" FROM "Reservation"
          WHERE "id" = ${reservation.id}
          FOR UPDATE
        `;

        // Skip if already released/confirmed (another process got there first)
        if (!locked[0] || locked[0].status !== "PENDING") {
          return;
        }

        // Release the reserved stock back
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
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "RELEASED" },
        });

        releasedCount++;
      });
    } catch (error) {
      // Log but don't throw — we want to continue cleaning up other reservations
      console.error(
        `[Cleanup] Failed to release reservation ${reservation.id}:`,
        error
      );
    }
  }

  if (releasedCount > 0) {
    console.log(
      `[Cleanup] Released ${releasedCount} expired reservation(s)`
    );
  }

  return releasedCount;
}
