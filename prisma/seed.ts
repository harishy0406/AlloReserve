import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Clear existing data ──
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // ── Create Warehouses ──
  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: {
        name: "Bangalore North Hub",
        location: "Bangalore, Karnataka",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Mumbai Central Hub",
        location: "Mumbai, Maharashtra",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Delhi NCR Hub",
        location: "New Delhi, Delhi",
      },
    }),
  ]);

  console.log(`✅ Created ${warehouses.length} warehouses`);

  // ── Create Products ──
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "iPhone 16 Pro",
        description:
          "Latest iPhone with A18 Pro chip, 48MP camera system, and titanium design.",
        price: 134900.0,
        imageUrl: "/images/iphone.png",
      },
    }),
    prisma.product.create({
      data: {
        name: "MacBook Air M3",
        description:
          "Ultra-thin laptop with M3 chip, 18-hour battery, and Liquid Retina display.",
        price: 114900.0,
        imageUrl: "/images/macbook.png",
      },
    }),
    prisma.product.create({
      data: {
        name: "AirPods Pro 2",
        description:
          "Active Noise Cancellation, Adaptive Audio, and USB-C charging case.",
        price: 24900.0,
        imageUrl: "/images/airpods.png",
      },
    }),
    prisma.product.create({
      data: {
        name: "Sony WH-1000XM5",
        description:
          "Industry-leading noise cancellation with 30-hour battery life.",
        price: 29990.0,
        imageUrl: "/images/headphones.png",
      },
    }),
    prisma.product.create({
      data: {
        name: "Samsung Galaxy S24 Ultra",
        description:
          "AI-powered flagship with S Pen, 200MP camera, and titanium frame.",
        price: 129999.0,
        imageUrl: "/images/galaxy.png",
      },
    }),
  ]);

  console.log(`✅ Created ${products.length} products`);

  // ── Create Inventory ──
  // Strategic stock levels: some plentiful, some scarce (for testing concurrency)
  const inventoryData = [
    // iPhone 16 Pro — SCARCE in Bangalore (only 1 left!) for race-condition testing
    { product: products[0], warehouse: warehouses[0], totalStock: 1 },
    { product: products[0], warehouse: warehouses[1], totalStock: 8 },
    { product: products[0], warehouse: warehouses[2], totalStock: 5 },

    // MacBook Air M3 — moderate stock
    { product: products[1], warehouse: warehouses[0], totalStock: 12 },
    { product: products[1], warehouse: warehouses[1], totalStock: 3 },
    { product: products[1], warehouse: warehouses[2], totalStock: 7 },

    // AirPods Pro 2 — plentiful stock
    { product: products[2], warehouse: warehouses[0], totalStock: 25 },
    { product: products[2], warehouse: warehouses[1], totalStock: 18 },
    { product: products[2], warehouse: warehouses[2], totalStock: 30 },

    // Sony WH-1000XM5 — SCARCE in Delhi (only 2 left!)
    { product: products[3], warehouse: warehouses[0], totalStock: 6 },
    { product: products[3], warehouse: warehouses[1], totalStock: 10 },
    { product: products[3], warehouse: warehouses[2], totalStock: 2 },

    // Samsung Galaxy S24 Ultra — moderate stock
    { product: products[4], warehouse: warehouses[0], totalStock: 4 },
    { product: products[4], warehouse: warehouses[1], totalStock: 15 },
    { product: products[4], warehouse: warehouses[2], totalStock: 9 },
  ];

  await Promise.all(
    inventoryData.map((item) =>
      prisma.inventory.create({
        data: {
          productId: item.product.id,
          warehouseId: item.warehouse.id,
          totalStock: item.totalStock,
          reservedStock: 0,
        },
      })
    )
  );

  console.log(`✅ Created ${inventoryData.length} inventory records`);

  console.log("\n🎉 Seed complete!\n");
  console.log("Key test scenarios:");
  console.log(
    "  → iPhone 16 Pro @ Bangalore North Hub: only 1 unit (concurrency test)"
  );
  console.log(
    "  → Sony WH-1000XM5 @ Delhi NCR Hub: only 2 units (low stock test)"
  );
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
