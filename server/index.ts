import express from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { createServer } from "http";
import { serveStatic } from "./static";
import { initDb, closeDb } from "./db";
import { setupAuth } from "./auth";
import { registerAdminRoutes } from "./admin";
import type { User as AppUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends AppUser {}
  }
}

const app = express();
const httpServer = createServer(app);

// Trust Railway's load balancer / TLS-termination proxy.
app.set("trust proxy", 1);

app.use(express.json());

const MemoryStoreInstance = MemoryStore(session);
app.use(
  session({
    store: new MemoryStoreInstance({ checkPeriod: 30 * 60 * 1000, ttl: 4 * 60 * 60 * 1000 }),
    secret: process.env.SESSION_SECRET || "avm-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "lax" : false,
    },
  }),
);

setupAuth(app);
registerAdminRoutes(app);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  await initDb(databaseUrl);

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    console.log(`AVM server listening on port ${port}`);
  });

  async function gracefulShutdown(signal: string) {
    console.log(`${signal} received, shutting down…`);
    httpServer.close(async () => {
      await closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
})();
