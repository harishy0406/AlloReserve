import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Pooled connection (port 6543) for general queries
    url: process.env["DATABASE_URL"],
    // Direct connection (port 5432) for migrations
    directUrl: process.env["DIRECT_URL"],
  },
});
