import { z } from "zod";

/**
 * Zod schemas shared between API routes and frontend forms
 */

// ── Reserve Stock ──
export const reserveStockSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  warehouseId: z.string().uuid("Invalid warehouse ID"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be at least 1"),
});

export type ReserveStockInput = z.infer<typeof reserveStockSchema>;

// ── API Response Types ──
export interface ProductWithInventory {
  id: string;
  name: string;
  description: string;
  price: string; // Decimal comes as string from Prisma
  imageUrl: string;
  inventories: InventoryItem[];
}

export interface InventoryItem {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
}

export interface ReservationResponse {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface ApiError {
  error: string;
  details?: string;
}
