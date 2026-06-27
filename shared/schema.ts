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
  symbol: varchar("symbol", { length: 20 }).primaryKey(),
  assetType: text("asset_type"), // 'stock' | 'etf' | 'adr' | 'fund' | 'unknown'
  exchange: text("exchange"),
  currency: text("currency"),
  isPeSupported: boolean("is_pe_supported").notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const peDailyPrices = pgTable("pe_daily_prices", {
  symbol: varchar("symbol", { length: 20 }).notNull(),
  tradeDate: text("trade_date").notNull(),
  close: real("close").notNull(),
  adjustedClose: real("adjusted_close"),
  source: text("source").notNull().default("yahoo"),
  fetchedAt: text("fetched_at").notNull(),
}, (table) => [
  unique().on(table.symbol, table.tradeDate),
]);

export const peQuarterlyEps = pgTable("pe_quarterly_eps", {
  symbol: varchar("symbol", { length: 20 }).notNull(),
  fiscalPeriodEnd: text("fiscal_period_end").notNull(),
  availableDate: text("available_date").notNull(),
  eps: real("eps"),
  dilutedEps: real("diluted_eps"),
  source: text("source").notNull().default("yahoo"),
  fetchedAt: text("fetched_at").notNull(),
}, (table) => [
  unique().on(table.symbol, table.fiscalPeriodEnd),
]);

export const peDailyMetrics = pgTable("pe_daily_metrics", {
  symbol: varchar("symbol", { length: 20 }).notNull(),
  tradeDate: text("trade_date").notNull(),
  price: real("price").notNull(),
  epsTtm: real("eps_ttm"),
  peDaily: real("pe_daily"),
  avgPe5y: real("avg_pe_5y"),
  epsWindowQuarterEnds: text("eps_window_quarter_ends"), // JSON array of 4 quarter-end dates
  calculationVersion: integer("calculation_version").notNull().default(1),
  calculatedAt: text("calculated_at").notNull(),
}, (table) => [
  unique().on(table.symbol, table.tradeDate),
]);

export const peDatasetStatus = pgTable("pe_dataset_status", {
  symbol: varchar("symbol", { length: 20 }).primaryKey(),
  windowStartDate: text("window_start_date"),
  windowEndDate: text("window_end_date"),
  lastPriceDateStored: text("last_price_date_stored"),
  lastQuarterAvailableDateStored: text("last_quarter_available_date_stored"),
  lastFullRebuildAt: text("last_full_rebuild_at"),
  lastIncrementalRefreshAt: text("last_incremental_refresh_at"),
  calculationVersion: integer("calculation_version").notNull().default(1),
  dataCompletenessStatus: text("data_completeness_status").notNull().default("partial"),
  errorMessage: text("error_message"),
});

export const peHypotheticalOrders = pgTable("pe_hypothetical_orders", {
  orderId: varchar("order_id").primaryKey(),
  userId: varchar("user_id").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  orderType: text("order_type").notNull(), // 'buy' | 'sell'
  tradeDate: text("trade_date").notNull(),
  tradePrice: real("trade_price").notNull(),
  shares: real("shares").notNull(),
  notional: real("notional").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type PeSecurity = typeof peSecurities.$inferSelect;
export type InsertPeSecurity = typeof peSecurities.$inferInsert;
export type PeDailyPrice = typeof peDailyPrices.$inferSelect;
export type PeQuarterlyEps = typeof peQuarterlyEps.$inferSelect;
export type PeDailyMetric = typeof peDailyMetrics.$inferSelect;
export type PeDatasetStatus = typeof peDatasetStatus.$inferSelect;
export type InsertPeDatasetStatus = typeof peDatasetStatus.$inferInsert;
export type PeHypotheticalOrder = typeof peHypotheticalOrders.$inferSelect;
export type InsertPeHypotheticalOrder = typeof peHypotheticalOrders.$inferInsert;

// ── Shiller PE DCA Strategy Screener ──────────────────────
// Global market data (Shiller CAPE + S&P 500 history) — not scoped to a user.

export const shillerCapeMonthly = pgTable("shiller_cape_monthly", {
  periodDate: text("period_date").primaryKey(), // YYYY-MM-01
  sp500Price: real("sp500_price").notNull(),    // nominal S&P Composite price (Shiller dataset column P)
  shillerPe: real("shiller_pe").notNull(),       // CAPE / P-E10
  earningsBase: real("earnings_base").notNull(), // derived: sp500Price / shillerPe
  source: text("source").notNull().default("shiller_dataset"),
  fetchedAt: text("fetched_at").notNull(),
});

export const sp500DailyPrices = pgTable("sp500_daily_prices", {
  tradeDate: text("trade_date").primaryKey(),
  close: real("close").notNull(),
  source: text("source").notNull().default("yfinance"),
  fetchedAt: text("fetched_at").notNull(),
});

export const shillerDatasetStatus = pgTable("shiller_dataset_status", {
  id: varchar("id").primaryKey().default("singleton"),
  lastShillerMonthStored: text("last_shiller_month_stored"),
  lastPriceDateStored: text("last_price_date_stored"),
  lastFullRebuildAt: text("last_full_rebuild_at"),
  lastIncrementalRefreshAt: text("last_incremental_refresh_at"),
  dataCompletenessStatus: text("data_completeness_status").notNull().default("partial"),
  errorMessage: text("error_message"),
});

export type ShillerCapeMonthly = typeof shillerCapeMonthly.$inferSelect;
export type Sp500DailyPrice = typeof sp500DailyPrices.$inferSelect;
export type ShillerDatasetStatus = typeof shillerDatasetStatus.$inferSelect;
export type InsertShillerDatasetStatus = typeof shillerDatasetStatus.$inferInsert;
