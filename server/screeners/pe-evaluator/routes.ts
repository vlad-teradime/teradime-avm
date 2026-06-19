import type { Express } from "express";
import { requireAuth, requireScreenerAccess } from "../../auth";
import { storage } from "../../storage";
import type { User } from "@shared/schema";

const SCREENER_KEY = "pe-evaluator";

export async function registerPeEvaluatorRoutes(app: Express) {
  const gate = await requireScreenerAccess(SCREENER_KEY);
  const base = "/api/screeners/pe-evaluator";

  app.post(`${base}/:symbol/recalculate`, requireAuth, gate, async (req, res) => {
    const symbol = String(req.params.symbol).toUpperCase().trim();
    if (!symbol) return res.status(400).json({ error: "symbol required" });
    const { mode } = req.body as { mode?: "incremental" | "full" };
    try {
      const { fullBackfill, incrementalRefresh } = await import("./pe-service");
      if (mode === "full") {
        await fullBackfill(symbol);
      } else {
        await incrementalRefresh(symbol);
      }
      const status = await storage.getPeDatasetStatus(symbol);
      const metrics = await storage.getPeDailyMetrics(symbol);
      const last = metrics.length ? metrics[metrics.length - 1] : null;
      res.json({
        symbol,
        windowStartDate: status?.windowStartDate,
        windowEndDate: status?.windowEndDate,
        latestPrice: last?.price ?? null,
        latestPe: last?.peDaily ?? null,
        avgPe5y: last?.avgPe5y ?? null,
        status: status?.dataCompletenessStatus ?? "complete",
      });
    } catch (e) {
      const err = e as Error;
      console.error("[pe-evaluator recalculate]", err);
      await storage.upsertPeDatasetStatus(symbol, { dataCompletenessStatus: "error", errorMessage: err.message }).catch(() => {});
      res.status(500).json({ error: err.message });
    }
  });

  app.get(`${base}/:symbol/series`, requireAuth, gate, async (req, res) => {
    const symbol = String(req.params.symbol).toUpperCase().trim();
    try {
      const metrics = await storage.getPeDailyMetrics(symbol);
      const last = metrics.length ? metrics[metrics.length - 1] : null;
      res.json({
        symbol,
        latestPrice: last?.price ?? null,
        latestPe: last?.peDaily ?? null,
        avgPe5y: last?.avgPe5y ?? null,
        series: metrics.map((m) => ({
          tradeDate: m.tradeDate,
          price: m.price,
          peDaily: m.peDaily,
          avgPe5y: m.avgPe5y,
        })),
      });
    } catch (e) {
      const err = e as Error;
      console.error("[pe-evaluator series]", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`${base}/:symbol/orders`, requireAuth, gate, async (req, res) => {
    const symbol = String(req.params.symbol).toUpperCase().trim();
    const { orderType, tradeDate, tradePrice, shares } = req.body as {
      orderType: string;
      tradeDate: string;
      tradePrice: number;
      shares: number;
    };
    if (!orderType || !tradeDate || !tradePrice || !shares) {
      return res.status(400).json({ error: "orderType, tradeDate, tradePrice, and shares are required" });
    }
    if (!["buy", "sell"].includes(orderType)) {
      return res.status(400).json({ error: "orderType must be buy or sell" });
    }
    if (shares <= 0 || tradePrice <= 0) {
      return res.status(400).json({ error: "shares and tradePrice must be positive" });
    }
    const user = req.user as User;
    if (orderType === "sell") {
      const existingOrders = await storage.getPeHypotheticalOrders(user.id, symbol);
      let netShares = 0;
      for (const o of existingOrders.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))) {
        netShares = o.orderType === "buy" ? netShares + o.shares : Math.max(0, netShares - o.shares);
      }
      if (shares > netShares) {
        return res.status(400).json({ error: `Cannot sell ${shares} shares — only ${netShares} net shares held` });
      }
    }
    try {
      const now = new Date().toISOString();
      const order = await storage.createPeHypotheticalOrder({
        userId: user.id,
        symbol,
        orderType,
        tradeDate,
        tradePrice,
        shares,
        notional: shares * tradePrice,
        createdAt: now,
        updatedAt: now,
      });
      res.json(order);
    } catch (e) {
      const err = e as Error;
      console.error("[pe-evaluator order create]", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get(`${base}/:symbol/orders/summary`, requireAuth, gate, async (req, res) => {
    const symbol = String(req.params.symbol).toUpperCase().trim();
    const user = req.user as User;
    try {
      const orders = await storage.getPeHypotheticalOrders(user.id, symbol);
      const metrics = await storage.getPeDailyMetrics(symbol);
      const latestPrice = metrics.length ? metrics[metrics.length - 1].price : null;
      const { computePlSummary } = await import("./pe-service");
      const summary = computePlSummary(
        orders.map((o) => ({
          orderId: o.orderId,
          orderType: o.orderType,
          tradeDate: o.tradeDate,
          tradePrice: o.tradePrice,
          shares: o.shares,
          notional: o.notional,
        })),
        latestPrice,
      );
      res.json(summary);
    } catch (e) {
      const err = e as Error;
      console.error("[pe-evaluator orders summary]", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete(`${base}/:symbol/orders/:orderId`, requireAuth, gate, async (req, res) => {
    const orderId = String(req.params.orderId);
    const user = req.user as User;
    try {
      const ok = await storage.deletePeHypotheticalOrder(orderId, user.id);
      if (!ok) return res.status(404).json({ error: "Order not found" });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });
}
