import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  users,
  screeners,
  userScreenerAccess,
  type User,
  type Screener,
  type UserScreenerAccess,
} from "@shared/schema";

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
};
