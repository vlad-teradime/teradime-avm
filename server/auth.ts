import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import type { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(salt + ":" + derivedKey.toString("hex"));
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(":");
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      const keyBuf = Buffer.from(key, "hex");
      resolve(keyBuf.length === derivedKey.length && timingSafeEqual(keyBuf, derivedKey));
    });
  });
}

export function setupAuth(app: Express) {
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }
        const ok = await verifyPassword(password, user.password);
        if (!ok) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user ?? false);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: User | false, info: { message?: string }) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message ?? "Invalid username or password" });
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.json({ id: user.id, username: user.username, role: user.role });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    res.json({ id: user.id, username: user.username, role: user.role });
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  if ((req.user as User).role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
}

export async function requireScreenerAccess(screenerKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    const allowed = await storage.canAccessScreener(user.id, screenerKey);
    if (!allowed) return res.status(403).json({ message: "Access to this screener has been restricted" });
    next();
  };
}
