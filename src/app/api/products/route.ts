import { NextResponse } from "next/server";
import { getProductsWithInventory } from "@/services/inventory.service";

/**
 * GET /api/products
 *
 * Returns all products with per-warehouse stock levels.
 * Automatically runs lazy cleanup of expired reservations
 * to ensure stock counts are always accurate.
 */
export async function GET() {
  try {
    const products = await getProductsWithInventory();
    return NextResponse.json(products);
  } catch (error) {
    console.error("[GET /api/products] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
