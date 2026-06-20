import type { Express } from "express";
import { requireAdmin } from "./auth";
import { hashPassword } from "./auth";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export function registerAdminRoutes(app: Express) {
  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    const allUsers = await storage.listUsers();
    res.json(allUsers.map((u) => ({ id: u.id, username: u.username, email: u.email, role: u.role })));
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    const { username, password, role, email } = req.body as {
      username?: string;
      password?: string;
      role?: string;
      email?: string;
    };
    if (!username || !password || (role !== "admin" && role !== "user")) {
      return res.status(400).json({ message: "username, password, and role ('admin' | 'user') are required" });
    }
    const existing = await storage.getUserByUsername(username);
    if (existing) return res.status(409).json({ message: "Username already exists" });

    const hashed = await hashPassword(password);
    const user = await storage.createUser({ username, password: hashed, role, email });
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  });

  app.post("/api/admin/users/:userId/copy", requireAdmin, async (req, res) => {
    const { username, password, email } = req.body as { username?: string; password?: string; email?: string };
    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required" });
    }
    const source = await storage.getUser(String(req.params.userId));
    if (!source) return res.status(404).json({ message: "User not found" });
    const existing = await storage.getUserByUsername(username);
    if (existing) return res.status(409).json({ message: "Username already exists" });

    const hashed = await hashPassword(password);
    const newUser = await storage.createUser({ username, password: hashed, role: source.role as "admin" | "user", email });

    const admin = req.user as User;
    const restrictions = await storage.listRestrictionsForUser(source.id);
    for (const r of restrictions) {
      await storage.restrictUserScreener(newUser.id, r.screenerKey, admin.id);
    }
    res.status(201).json({ id: newUser.id, username: newUser.username, role: newUser.role });
  });

  app.patch("/api/admin/users/:userId/password", requireAdmin, async (req, res) => {
    const { newPassword } = req.body as { newPassword?: string };
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const target = await storage.getUser(String(req.params.userId));
    if (!target) return res.status(404).json({ message: "User not found" });

    const hashed = await hashPassword(newPassword);
    await storage.updateUserPassword(target.id, hashed);
    res.json({ message: "Password updated" });
  });

  app.delete("/api/admin/users/:userId", requireAdmin, async (req, res) => {
    const admin = req.user as User;
    if (admin.id === req.params.userId) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }
    const deleted = await storage.deleteUser(String(req.params.userId));
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  });

  app.get("/api/admin/screeners", requireAdmin, async (_req, res) => {
    res.json(await storage.listScreeners());
  });

  app.get("/api/admin/users/:userId/restrictions", requireAdmin, async (req, res) => {
    res.json(await storage.listRestrictionsForUser(String(req.params.userId)));
  });

  app.post("/api/admin/users/:userId/restrictions", requireAdmin, async (req, res) => {
    const { screenerKey } = req.body as { screenerKey?: string };
    if (!screenerKey) return res.status(400).json({ message: "screenerKey is required" });
    const admin = req.user as User;
    await storage.restrictUserScreener(String(req.params.userId), screenerKey, admin.id);
    res.status(201).json({ message: "Restricted" });
  });

  app.delete("/api/admin/users/:userId/restrictions/:screenerKey", requireAdmin, async (req, res) => {
    await storage.unrestrictUserScreener(String(req.params.userId), String(req.params.screenerKey));
    res.json({ message: "Restriction removed" });
  });
}
