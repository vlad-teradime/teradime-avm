import { pgTable, varchar, text, boolean, real, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ── Users ──────────────────────────────────────────────────
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: varchar("username").notNull().unique(),
  email: varchar("email"),
  password: text("password").notNull(),
  role: varchar("role").notNull(), // "admin" | "user"
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  totpSecret: text("totp_secret"),
  createdAt: text("created_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type User = typeof users.$inferSelect;
export type InsertUser = typeof insertUserSchema._type;

// ── Screener registry ─────────────────────────────────────
export const screeners = pgTable("screeners", {
  key: varchar("key").primaryKey(), // e.g. "pe-evaluator"
  name: varchar("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull(),
});

export type Screener = typeof screeners.$inferSelect;

// ── Per-user screener restrictions (deny-list) ────────────
// Absence of a row = access granted. A row only exists when an admin
// has explicitly restricted a user from a screener.
export const userScreenerAccess = pgTable("user_screener_access", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  screenerKey: varchar("screener_key").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  restrictedAt: text("restricted_at").notNull(),
  restrictedBy: varchar("restricted_by").notNull(),
}, (table) => [
  unique().on(table.userId, table.screenerKey),
]);

export type UserScreenerAccess = typeof userScreenerAccess.$inferSelect;

// ── PE Evaluator ───────────────────────────────────────────
export const peSecurities = pgTable("pe_securities", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  symbol: varchar("symbol").notNull(),
  createdAt: text("created_at").notNull(),
});

export const peDailyPrices = pgTable("pe_daily_prices", {
  id: varchar("id").primaryKey(),
  securityId: varchar("security_id").notNull(),
  date: text("date").notNull(),
  adjClose: real("adj_close").notNull(),
});

export const peQuarterlyEps = pgTable("pe_quarterly_eps", {
  id: varchar("id").primaryKey(),
  securityId: varchar("security_id").notNull(),
  quarterEnd: text("quarter_end").notNull(),
  eps: real("eps").notNull(),
  source: varchar("source").notNull(), // "annual" | "quarterly" | "earnings_history"
});

export const peDailyMetrics = pgTable("pe_daily_metrics", {
  id: varchar("id").primaryKey(),
  securityId: varchar("security_id").notNull(),
  date: text("date").notNull(),
  peRatio: real("pe_ratio"),
});

export const peDatasetStatus = pgTable("pe_dataset_status", {
  securityId: varchar("security_id").primaryKey(),
  lastBackfillAt: text("last_backfill_at"),
  lastIncrementalRefreshAt: text("last_incremental_refresh_at"),
  status: varchar("status").notNull(),
});

export const peHypotheticalOrders = pgTable("pe_hypothetical_orders", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  securityId: varchar("security_id").notNull(),
  side: varchar("side").notNull(), // "buy" | "sell"
  date: text("date").notNull(),
  price: real("price").notNull(),
  shares: integer("shares").notNull(),
});

export type PeSecurity = typeof peSecurities.$inferSelect;
export type PeDailyPrice = typeof peDailyPrices.$inferSelect;
export type PeQuarterlyEps = typeof peQuarterlyEps.$inferSelect;
export type PeDailyMetric = typeof peDailyMetrics.$inferSelect;
export type PeDatasetStatus = typeof peDatasetStatus.$inferSelect;
export type PeHypotheticalOrder = typeof peHypotheticalOrders.$inferSelect;
