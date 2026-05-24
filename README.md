# ◈ AlloReserve — Temporary Stock Reservation System
<div align="left">

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232a?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-39827F?style=for-the-badge&logo=prisma&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

AlloReserve is a production-ready, highly robust **Temporary Stock Reservation System** built with **Next.js 16 (App Router)**, **TypeScript**, **Supabase (PostgreSQL)**, and **Upstash Redis**. It solves the classic e-commerce **"Last Item Problem"** under high-concurrency environments.



---

## 📸 Snapshots

### 🖥️ Real-Time Product Catalog
Premium glassmorphic interface showing dynamic stock indicators. Badges automatically transition from green to critical pulsing red under scarce availability.

<img width="3112" height="1643" alt="Real-Time Product Catalog Preview" src="https://github.com/user-attachments/assets/3fb877fe-6447-42bf-83cd-3e7ad3ef9471" />

### 💳 Interactive Payment Terminal
Interactive terminal with live bank simulation featuring a neon circular SVG countdown progress ring tracking reservation lock TTL.
![Interactive Checkout Terminal Preview]<img width="1518" height="898" alt="Screenshot 2026-05-24 120009" src="https://github.com/user-attachments/assets/c18100e1-a824-4cb0-b964-ca1d9df20a93" />


---

## 📖 The "Last Item Problem"

In traditional e-commerce checkout systems, race conditions occur when a product has low stock (e.g., exactly 1 unit left) and multiple shoppers click "Buy" at the same instant.
* **Decrementing stock only at payment completion:** Multiple shoppers can pay for the same physical unit, leading to overselling, transaction refunds, manual operations overhead, and frustrated customers.
* **Decrementing stock at add-to-cart:** Shoppers can lock up inventory by leaving items in abandoned carts (typically an 80% cart abandonment rate), leading to false inventory depletion and lost sales.

### The AlloReserve Solution
AlloReserve introduces a **short-lived stock hold (e.g., 10 minutes)** secured at the start of checkout:
1. When checkout starts, a temporary hold is placed on the item in a specific warehouse.
2. Other shoppers see only the remaining stock.
3. **If payment succeeds:** The reservation is confirmed, and the stock is permanently decremented.
4. **If payment fails or the timer expires:** The reservation is released, and the stock is instantly returned to availability.

---

## 🛠️ Tech Stack & Infrastructure

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 (App Router) + TypeScript | Full-stack architecture, React Server Components, Route Handlers |
| **Database** | Supabase (PostgreSQL) | Connection pooling via Supavisor, multi-warehouse schema |
| **ORM** | Prisma v7 | Raw query support, type-safe transactions, migrations |
| **Caching** | Upstash Redis | Edge-compatible REST Redis client for transaction idempotency |
| **Styling** | Tailwind CSS + Custom CSS | Glassmorphism, Outfit display typography, floating cards |
| **Deployment** | Vercel | Serverless functions hosting + Vercel Cron Jobs |


### 🗄️ Supabase PostgreSQL Database

Supabase is used as the primary hosted PostgreSQL database for managing products, warehouses, inventory records, and reservation transactions. Connection pooling is handled through Supavisor to efficiently support high-concurrency reservation requests under heavy traffic conditions.

<img width="1205" height="622" alt="supabase-schema-qiuancpgzutycajomliw (1)" src="https://github.com/user-attachments/assets/de42640b-862b-4455-92f7-a32c92c5213c" />


### ⚡ Upstash Redis Cache

Upstash Redis is used for idempotency handling and request replay protection. It prevents duplicate reservation creation during network retries, accidental refreshes, and aggressive double-click actions during checkout.

<img width="1744" height="819" alt="image" src="https://github.com/user-attachments/assets/234a9ee9-5797-4e8f-817a-21093f4c9e53" />

---

## 🏗️ Architecture & Core Components

```
AlloReserve/
├── prisma/
│   ├── schema.prisma       # Products, Warehouses, Inventory, Reservations
│   └── seed.ts             # Hub seeding with scarce mock data (1 unit remaining)
├── src/
│   ├── lib/
│   │   ├── prisma.ts       # Singleton Prisma Client with connection pooling
│   │   ├── redis.ts        # Upstash Redis REST fallback client
│   │   ├── validators.ts   # Zod validation schemas shared between API & UI
│   │   ├── constants.ts    # Centralized TTL configurations (10 mins hold)
│   │   └── errors.ts       # Custom domain HTTP error classes
│   ├── services/
│   │   ├── reservation.service.ts  # SELECT FOR UPDATE transaction locking logic
│   │   ├── inventory.service.ts    # Stock querying and availability calculations
│   │   ├── cleanup.service.ts      # Active/Lazy expired holds restoration
│   │   └── idempotency.service.ts  # Double-click prevention response cache
│   └── app/
│       ├── page.tsx        # Real-time catalog with dynamic stock badges
│       └── checkout/[id]/  # Premium checkout terminal with countdown progress ring
```

---

## ⚡ Concurrency Locking Strategy

To achieve zero-overselling, I implement **Pessimistic Locking** inside a database transaction:

```typescript
const inventoryRows = await tx.$queryRaw<InventoryRow[]>`
  SELECT "id", "productId", "warehouseId", "totalStock", "reservedStock"
  FROM "Inventory"
  WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
  FOR UPDATE
`;
```

### How It Works:
1. **Row-Level Lock:** The PostgreSQL `SELECT ... FOR UPDATE` query locks the specific `Inventory` row for the duration of the transaction.
2. **Blocking Concurrent Reads:** Any concurrent transaction trying to acquire a lock on the *same* inventory row is blocked and queued until the active transaction commits or rolls back.
3. **Strict Stock Check:** I calculate `availableStock = totalStock - reservedStock`. If `availableStock < requestedQuantity`, I throw an `InsufficientStockError` (which translates to a `409 Conflict` HTTP status), rolling back the transaction.
4. **Safety Level:** Using a `ReadCommitted` isolation level with `FOR UPDATE` is highly performant and guarantees exactly one transaction succeeds while concurrent competitors receive `409` instantly.

---

## ⏱️ Auto-Expiry & Cleanup Mechanism

AlloReserve uses my hybrid cleanup strategy to ensure stock is never permanently leaked if checkout is abandoned:

### 1. Active Cleanup (Vercel Cron Job)
Configured in `vercel.json`, Vercel invokes `/api/cron/cleanup` every minute. It queries and releases all expired reservations in bulk:
```typescript
const expiredReservations = await prisma.reservation.findMany({
  where: {
    status: "PENDING",
    expiresAt: { lte: new Date() },
  },
});
```
Each expired reservation is released back to available stock in an isolated transaction to prevent any blocking.

### 2. Lazy Cleanup (Just-in-Time)
On every `GET /api/products` request, the server runs a lazy cleanup check *before* returning stock figures. This ensures that even if the cron job hasn't fired yet, shoppers always see 100% accurate, up-to-the-millisecond stock counts on the homepage catalog.

---

## 🔑 Idempotency (Bonus Feature)

To prevent duplicate reservations from network retries, browser page refreshes, or aggressive double-clicking, my system supports a custom `idempotency-key` header cached in Redis:
* When a client initiates checkout, I check the cache using the idempotency key.
* If a cached response exists, I immediately replay it.
* If not, the transaction executes normally and caches the result for **5 minutes**.
* The cache fails-open gracefully; if Upstash Redis is down, checkout still proceeds safely.

---

## 🚀 Getting Started (Local Setup)

Follow these steps to run the application locally:

### 1. Prerequisites
Ensure you have **Node.js (v18+)** and **npm** installed. You will also need a hosted PostgreSQL instance (e.g., Supabase) and Upstash Redis.

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/harishy0406/AlloReserve.git
cd AlloReserve
npm install
```

### 3. Environment Configuration
Create a `.env` file at the root of the project by copying `.env.example`:
```bash
cp .env.example .env
```
Fill in the following connection credentials:
```ini
# Supabase Transaction Pooler (Port 6543)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Supabase Direct URL (Port 5432) for Migrations
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Upstash Redis credentials
UPSTASH_REDIS_REST_URL="https://[your-endpoint].upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-rest-token"

# App Settings
RESERVATION_TTL_MINUTES=10
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Run Migrations & Seed Data
Initialize the database schemas and populate mock catalog items (with scarce warehouses configured):
```bash
npx prisma migrate dev --name init
npm run seed
```

### 5. Launch the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing Verification

### Automated Concurrency Test
I have provided a multi-threaded test script `concurrency_test.ts` in the project's root directory to demonstrate lock safety:
* **Scenario:** Shoots 10 simultaneous API requests at the exact same millisecond to reserve the last remaining unit of an item.
* **Expected Output:** Exactly 1 request receives a `201 Created` with a valid reservation ID, while the other 9 receive `409 Conflict` (Insufficient Stock).
* **To Run:**
  ```bash
  # Inside project root
  npx tsx concurrency_test.ts
  ```

### Manual Visual Verification
1. **Pulsing Badge:** Locate the scarcest product in the catalog (e.g., only 1 unit available). The stock badge will pulse red.
2. **Hold Security:** Click "Reserve Checkout Slot." You will be redirected to a custom checkout terminal with a live SVG countdown progress ring.
3. **Early Release:** Click "Decline (Release Stock)" on the payment terminal. Return to the homepage; the available stock immediately increments back.
4. **Natural Expiry:** Click reserve, wait for the timer to expire (or click the mock timeout link), and watch the catalog stock restore automatically.

---

## 🌐 Production Deployment

### 1. Database & Cache
Ensure your Supabase PostgreSQL database and Upstash Redis instances are fully configured.

### 2. Vercel Settings
* Connect your GitHub repository to Vercel.
* Add all environment variables from my `.env` file in the Vercel project settings dashboard.
* Vercel will automatically build the project using the preset build script `prisma generate && next build`.

### 3. Vercel Cron Job
Vercel automatically parses `vercel.json` to register the cron schedule:
```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "* * * * *"
    }
  ]
}
```
This runs the background cleanup process every minute, ensuring completely automated hold restoration.

---

<div align="center">

**Made with ❤️ by M Harish Gautham**

⭐ If you find this project helpful, please star it! ⭐

</div>
