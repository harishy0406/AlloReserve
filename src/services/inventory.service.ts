import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "./cleanup.service";
import type { ProductWithInventory } from "@/lib/validators";

/**
 * Inventory service — product & stock queries
 */

/**
 * Fetch all products with their per-warehouse inventory.
 * Automatically runs lazy cleanup of expired reservations first
 * to ensure stock counts are always 100% accurate.
 */
export async function getProductsWithInventory(): Promise<
  ProductWithInventory[]
> {
  // Lazy cleanup: release expired reservations before returning stock counts
  await releaseExpiredReservations();

  const products = await prisma.product.findMany({
    include: {
      inventories: {
        include: {
          warehouse: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price.toString(),
    imageUrl: product.imageUrl,
    inventories: product.inventories.map((inv) => ({
      id: inv.id,
      warehouseId: inv.warehouseId,
      warehouseName: inv.warehouse.name,
      warehouseLocation: inv.warehouse.location,
      totalStock: inv.totalStock,
      reservedStock: inv.reservedStock,
      availableStock: inv.totalStock - inv.reservedStock,
    })),
  }));
}

/**
 * Fetch all warehouses.
 */
export async function getWarehouses() {
  return prisma.warehouse.findMany({
    orderBy: { name: "asc" },
  });
}
