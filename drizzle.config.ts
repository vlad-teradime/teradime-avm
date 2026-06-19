import { defineConfig } from "drizzle-kit";

// DATABASE_URL is required for push/migrate commands but not for generate.
// Provide a placeholder so `drizzle-kit generate` works without a live DB.
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost/placeholder";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
