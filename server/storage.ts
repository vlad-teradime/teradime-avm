import { randomUUID } from "crypto";
import { eq, and, asc, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  users,
  screeners,
  userScreenerAccess,
  peSecurities,
  peDailyPrices,
  peQuarterlyEps,
  peDailyMetrics,
  peDatasetStatus,
  peHypotheticalOrders,
  type User,
  type Screener,
  type UserScreenerAccess,
  type InsertPeSecurity,
  type PeDailyPrice,
  type PeQuarterlyEps,
  type PeDailyMetric,
  type PeDatasetStatus,
  type InsertPeDatasetStatus,
  type InsertPeHypotheticalOrder,
} from "@shared/schema";

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const storage = {
  async getUser(id: string): Promise<User | undefined> {
    const [row] = await getDb().select().from(users).where(eq(users.id, id));
    return row;
  },

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [row] = await getDb().select().from(users).where(eq(users.username, username));
    return row;
  },

  async listUsers(): Promise<User[]> {
    return getDb().select().from(users);
  },

  async createUser(data: {
    username: string;
    password: string;
    role: "admin" | "user";
    email?: string;
  }): Promise<User> {
    const [row] = await getDb()
      .insert(users)
      .values({
        id: randomUUID(),
        username: data.username,
        email: data.email ?? null,
        password: data.password,
        role: data.role,
        twoFactorEnabled: false,
        totpSecret: null,
        createdAt: new Date().toISOString(),
      })
      .returning();
    return row;
  },

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    await getDb().update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  },

  async deleteUser(id: string): Promise<boolean> {
    await getDb().delete(userScreenerAccess).where(eq(userScreenerAccess.userId, id));
    const rows = await getDb().delete(users).where(eq(users.id, id)).returning({ id: users.id });
    return rows.length > 0;
  },

  async listScreeners(): Promise<Screener[]> {
    return getDb().select().from(screeners);
  },

  async upsertScreener(key: string, name: string, description?: string): Promise<void> {
    await getDb()
      .insert(screeners)
      .values({ key, name, description: description ?? null, createdAt: new Date().toISOString() })
      .onConflictDoNothing();
  },

  /** A user is allowed access unless a restriction row exists for this (userId, screenerKey) pair. */
  async canAccessScreener(userId: string, screenerKey: string): Promise<boolean> {
    const [row] = await getDb()
      .select()
      .from(userScreenerAccess)
      .where(and(eq(userScreenerAccess.userId, userId), eq(userScreenerAccess.screenerKey, screenerKey)));
    return !row;
  },

  async listRestrictionsForUser(userId: string): Promise<UserScreenerAccess[]> {
    return getDb().select().from(userScreenerAccess).where(eq(userScreenerAccess.userId, userId));
  },

  async restrictUserScreener(userId: string, screenerKey: string, restrictedBy: string): Promise<void> {
    await getDb()
      .insert(userScreenerAccess)
      .values({
        id: randomUUID(),
        userId,
        screenerKey,
        enabled: false,
        restrictedAt: new Date().toISOString(),
        restrictedBy,
      })
      .onConflictDoNothing();
  },

  async unrestrictUserScreener(userId: string, screenerKey: string): Promise<void> {
    await getDb()
      .delete(userScreenerAccess)
      .where(and(eq(userScreenerAccess.userId, userId), eq(userScreenerAccess.screenerKey, screenerKey)));
  },

  // ── PE Evaluator ─────────────────────────────────────────

  async getPeSecurity(symbol: string) {
    const [row] = await getDb().select().from(peSecurities).where(eq(peSecurities.symbol, symbol));
    return row;
  },

  async upsertPeSecurity(symbol: string, data: Partial<InsertPeSecurity>) {
    const now = new Date().toISOString();
    const [row] = await getDb()
      .insert(peSecurities)
      .values({ symbol, isPeSupported: true, createdAt: now, updatedAt: now, ...data })
      .onConflictDoUpdate({ target: peSecurities.symbol, set: { ...data, updatedAt: now } })
      .returning();
    return row;
  },

  async getPeDatasetStatus(symbol: string) {
    const [row] = await getDb().select().from(peDatasetStatus).where(eq(peDatasetStatus.symbol, symbol));
    return row;
  },

  async upsertPeDatasetStatus(symbol: string, data: Partial<InsertPeDatasetStatus>) {
    const [row] = await getDb()
      .insert(peDatasetStatus)
      .values({ symbol, calculationVersion: 1, dataCompletenessStatus: "partial", ...data })
      .onConflictDoUpdate({ target: peDatasetStatus.symbol, set: data })
      .returning();
    return row;
  },

  async upsertPeDailyPrices(rows: { symbol: string; tradeDate: string; close: number; adjustedClose?: number | null; source: string; fetchedAt: string }[]) {
    if (!rows.length) return;
    for (const chunk of chunkArray(rows, 500)) {
      await getDb()
        .insert(peDailyPrices)
        .values(chunk.map((r) => ({ ...r, adjustedClose: r.adjustedClose ?? null })))
        .onConflictDoNothing();
    }
  },

  async getPeDailyPrices(symbol: string, fromDate?: string): Promise<PeDailyPrice[]> {
    if (fromDate) {
      return getDb()
        .select()
        .from(peDailyPrices)
        .where(and(eq(peDailyPrices.symbol, symbol), gte(peDailyPrices.tradeDate, fromDate)))
        .orderBy(asc(peDailyPrices.tradeDate));
    }
    return getDb().select().from(peDailyPrices).where(eq(peDailyPrices.symbol, symbol)).orderBy(asc(peDailyPrices.tradeDate));
  },

  async upsertPeQuarterlyEps(rows: { symbol: string; fiscalPeriodEnd: string; availableDate: string; eps: number | null; dilutedEps?: number | null; source: string; fetchedAt: string }[]): Promise<string[]> {
    if (!rows.length) return [];
    const inserted: string[] = [];
    for (const row of rows) {
      const result = await getDb()
        .insert(peQuarterlyEps)
        .values({ ...row, dilutedEps: row.dilutedEps ?? null })
        .onConflictDoNothing()
        .returning({ availableDate: peQuarterlyEps.availableDate });
      if (result.length > 0) inserted.push(result[0].availableDate);
    }
    return inserted;
  },

  async getPeQuarterlyEps(symbol: string): Promise<PeQuarterlyEps[]> {
    return getDb().select().from(peQuarterlyEps).where(eq(peQuarterlyEps.symbol, symbol)).orderBy(asc(peQuarterlyEps.availableDate));
  },

  async upsertPeDailyMetrics(rows: PeDailyMetric[]) {
    if (!rows.length) return;
    for (const chunk of chunkArray(rows, 500)) {
      await getDb()
        .insert(peDailyMetrics)
        .values(chunk)
        .onConflictDoUpdate({
          target: [peDailyMetrics.symbol, peDailyMetrics.tradeDate],
          set: {
            price: sql`excluded.price`,
            epsTtm: sql`excluded.eps_ttm`,
            peDaily: sql`excluded.pe_daily`,
            avgPe5y: sql`excluded.avg_pe_5y`,
            epsWindowQuarterEnds: sql`excluded.eps_window_quarter_ends`,
            calculationVersion: sql`excluded.calculation_version`,
            calculatedAt: sql`excluded.calculated_at`,
          },
        });
    }
  },

  async getPeDailyMetrics(symbol: string): Promise<PeDailyMetric[]> {
    return getDb().select().from(peDailyMetrics).where(eq(peDailyMetrics.symbol, symbol)).orderBy(asc(peDailyMetrics.tradeDate));
  },

  async deletePeDailyMetrics(symbol: string) {
    await getDb().delete(peDailyMetrics).where(eq(peDailyMetrics.symbol, symbol));
  },

  async createPeHypotheticalOrder(data: Omit<InsertPeHypotheticalOrder, "orderId">) {
    const [row] = await getDb()
      .insert(peHypotheticalOrders)
      .values({ orderId: randomUUID(), ...data })
      .returning();
    return row;
  },

  async getPeHypotheticalOrders(userId: string, symbol: string) {
    return getDb()
      .select()
      .from(peHypotheticalOrders)
      .where(and(eq(peHypotheticalOrders.userId, userId), eq(peHypotheticalOrders.symbol, symbol)))
      .orderBy(asc(peHypotheticalOrders.tradeDate));
  },

  async deletePeHypotheticalOrder(orderId: string, userId: string): Promise<boolean> {
    const rows = await getDb()
      .delete(peHypotheticalOrders)
      .where(and(eq(peHypotheticalOrders.orderId, orderId), eq(peHypotheticalOrders.userId, userId)))
      .returning({ orderId: peHypotheticalOrders.orderId });
    return rows.length > 0;
  },
};
