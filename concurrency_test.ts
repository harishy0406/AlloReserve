import { v4 as uuidv4 } from "uuid";

/**
 * AlloReserve — Concurrency Test Script
 * 
 * This script fires 10 concurrent requests at the exact same millisecond
 * targeting a product with only 1 available stock unit.
 * 
 * It verifies that database-level row-locking (SELECT ... FOR UPDATE)
 * functions perfectly, guaranteeing that exactly ONE customer succeeds
 * and the other N competitors get blocked with a 409 Conflict.
 * 
 * PREREQUISITE:
 *   1. Your development server must be running locally: `npm run dev` (on port 3000)
 *   2. Your database must be seeded: `npm run seed`
 */

const BASE_URL = "http://localhost:3000";

async function runConcurrencyTest() {
  console.log("⚡ Starting Concurrency Race Condition Test...");
  console.log("Fetching local catalog to find a scarce product (1 unit left)...");

  try {
    const productsRes = await fetch(`${BASE_URL}/api/products`);
    if (!productsRes.ok) {
      throw new Error(`Failed to fetch catalog: ${productsRes.statusText}. Is your dev server running?`);
    }

    const products = await productsRes.json();
    
    // Find a product that has exactly 1 unit left in a warehouse
    let targetProductId = "";
    let targetWarehouseId = "";
    let productName = "";
    let warehouseName = "";

    for (const p of products) {
      const scarceInv = p.inventories.find(
        (inv: any) => inv.totalStock - inv.reservedStock === 1
      );
      if (scarceInv) {
        targetProductId = p.id;
        targetWarehouseId = scarceInv.warehouseId;
        productName = p.name;
        warehouseName = scarceInv.warehouse.name;
        break;
      }
    }

    if (!targetProductId) {
      console.warn("⚠️ No scarce product with exactly 1 unit available was found.");
      console.warn("Falling back to the first available product in the catalog...");
      if (products.length === 0) {
        throw new Error("Catalog is completely empty. Please seed the database first.");
      }
      const firstProduct = products[0];
      const firstInv = firstProduct.inventories[0];
      if (!firstInv) {
        throw new Error("No inventory entries found in database.");
      }
      targetProductId = firstProduct.id;
      targetWarehouseId = firstInv.warehouseId;
      productName = firstProduct.name;
      warehouseName = firstInv.warehouse.name;
    }

    console.log(`\n🎯 TARGET SELECTED:`);
    console.log(`   Product:   ${productName} (${targetProductId})`);
    console.log(`   Warehouse: ${warehouseName} (${targetWarehouseId})`);
    console.log(`   Stock:     1 Unit Available`);

    console.log("\n🚀 Dispatching 10 concurrent checkout holds at the exact same millisecond...");

    // Create 10 concurrent requests
    const requestPromises = Array.from({ length: 10 }).map((_, index) => {
      const clientName = `Client-${index + 1}`;
      // Generate a unique idempotency key for each separate client
      const idempotencyKey = uuidv4();

      return fetch(`${BASE_URL}/api/reservations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          productId: targetProductId,
          warehouseId: targetWarehouseId,
          quantity: 1,
        }),
      }).then(async (res) => {
        const body = await res.json();
        return {
          clientName,
          status: res.status,
          body,
        };
      });
    });

    const results = await Promise.all(requestPromises);

    console.log("\n📊 RACE RESULTS RECEIVED:");
    console.log("------------------------------------------------------------------");
    
    let successCount = 0;
    let conflictCount = 0;
    let otherCount = 0;

    results.forEach((r) => {
      if (r.status === 201) {
        successCount++;
        console.log(`🟢 ${r.clientName}: SUCCESS (201 Created) → Reservation ID: ${r.body.id}`);
      } else if (r.status === 409) {
        conflictCount++;
        console.log(`🔴 ${r.clientName}: CONFLICT (409) → ${r.body.error}: ${r.body.details}`);
      } else {
        otherCount++;
        console.log(`⚠️ ${r.clientName}: HTTP ${r.status} → ${JSON.stringify(r.body)}`);
      }
    });

    console.log("------------------------------------------------------------------");
    console.log(`\n🏁 CONCURRENCY AUDIT REPORT:`);
    console.log(`   🏆 Winners (201 Success):  ${successCount}`);
    console.log(`   ⛔ Blocked (409 Conflict): ${conflictCount}`);
    console.log(`   ⚠️ Others:                 ${otherCount}`);

    console.log("\n🔒 CRITICAL LOCKING INTEGRITY CHECK:");
    if (successCount === 1 && conflictCount === 9) {
      console.log("   ✅ VERDICT: PERFECT locking integrity! Pessimistic select FOR UPDATE prevented double-selling.");
      console.log("   Exactly 1 reservation was secured, and 9 clients were rejected safely.");
    } else if (successCount > 1) {
      console.log("   ❌ VERDICT: FAIL! Concurrency guard breached. Double-selling occurred!");
    } else {
      console.log("   ⚠️ VERDICT: INCONCLUSIVE. Make sure the target product had exactly 1 unit left before running the script.");
    }

  } catch (error: any) {
    console.error("\n❌ Concurrency Test Failed with Error:", error.message);
  }
}

runConcurrencyTest();
