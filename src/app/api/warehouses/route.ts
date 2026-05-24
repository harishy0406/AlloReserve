import { NextResponse } from "next/server";
import { getWarehouses } from "@/services/inventory.service";

/**
 * GET /api/warehouses
 *
 * Returns all warehouse locations.
 */
export async function GET() {
  try {
    const warehouses = await getWarehouses();
    return NextResponse.json(warehouses);
  } catch (error) {
    console.error("[GET /api/warehouses] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch warehouses" },
      { status: 500 }
    );
  }
}
