import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reservations/:id
 *
 * Retrieves reservation details along with product and warehouse information.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // Fetch associated product and warehouse details
    const product = await prisma.product.findUnique({
      where: { id: reservation.productId },
    });

    const warehouse = await prisma.warehouse.findUnique({
      where: { id: reservation.warehouseId },
    });

    return NextResponse.json({
      id: reservation.id,
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      product: product ? {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        imageUrl: product.imageUrl,
      } : null,
      warehouse: warehouse ? {
        id: warehouse.id,
        name: warehouse.name,
        location: warehouse.location,
      } : null,
    });
  } catch (error) {
    console.error("[GET /api/reservations/:id] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservation details" },
      { status: 500 }
    );
  }
}
