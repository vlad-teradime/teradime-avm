import type { Express } from "express";
import { requireAuth, requireScreenerAccess } from "../../auth";
import { storage } from "../../storage";

const SCREENER_KEY = "shiller-pe-strategy";

export async function registerShillerPeStrategyRoutes(app: Express) {
  const gate = await requireScreenerAccess(SCREENER_KEY);
  const base = "/api/screeners/shiller-pe-strategy";

  app.get(`${base}/data-range`, requireAuth, gate, async (_req, res) => {
    try {
      const { getDataRange } = await import("./data-service");
      res.json(await getDataRange());
    } catch (e) {
      const err = e as Error;
      console.error("[shiller-pe-strategy data-range]", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`${base}/refresh`, requireAuth, gate, async (req, res) => {
    const { mode } = req.body as { mode?: "incremental" | "full" };
    try {
      const { fullBackfill, incrementalRefresh, getDataRange } = await import("./data-service");
      if (mode === "full") {
        await fullBackfill();
      } else {
        await incrementalRefresh();
      }
      res.json(await getDataRange());
    } catch (e) {
      const err = e as Error;
      console.error("[shiller-pe-strategy refresh]", err);
      await storage.upsertShillerDatasetStatus({ dataCompletenessStatus: "error", errorMessage: err.message }).catch(() => {});
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`${base}/backtest`, requireAuth, gate, async (req, res) => {
    const {
      startDate, endDate, frequency, thresholdMode, sdMultiplier, absoluteThreshold,
      contributionAmount, trendMaMonths,
    } = req.body as {
      startDate?: string; endDate?: string; frequency?: string; thresholdMode?: string;
      sdMultiplier?: number; absoluteThreshold?: number | null;
      contributionAmount?: number; trendMaMonths?: number;
    };
    if (!startDate || !endDate) return res.status(400).json({ error: "startDate and endDate are required" });
    if (!["daily", "weekly", "monthly"].includes(frequency ?? "")) {
      return res.status(400).json({ error: "frequency must be daily, weekly, or monthly" });
    }
    if (!["stddev", "absolute"].includes(thresholdMode ?? "")) {
      return res.status(400).json({ error: "thresholdMode must be stddev or absolute" });
    }
    if (thresholdMode === "absolute" && !(typeof absoluteThreshold === "number" && absoluteThreshold > 0)) {
      return res.status(400).json({ error: "absoluteThreshold must be a positive number when thresholdMode is absolute" });
    }
    if (startDate > endDate) return res.status(400).json({ error: "startDate must be before endDate" });
    try {
      const { runBacktest } = await import("./backtest");
      const monthlyRows = await storage.getShillerCapeMonthly();
      const dailyRows = frequency === "monthly" ? [] : await storage.getSp500DailyPrices();
      if (!monthlyRows.length) {
        return res.status(409).json({ error: "Shiller PE data has not been loaded yet. Trigger a refresh first." });
      }
      const result = runBacktest(monthlyRows, dailyRows, {
        startDate,
        endDate,
        frequency: frequency as "daily" | "weekly" | "monthly",
        thresholdMode: thresholdMode as "stddev" | "absolute",
        sdMultiplier: sdMultiplier ?? 2.5,
        absoluteThreshold: absoluteThreshold ?? null,
        contributionAmount: contributionAmount ?? 100,
        trendMaMonths: trendMaMonths ?? 12,
      });
      res.json(result);
    } catch (e) {
      const err = e as Error;
      console.error("[shiller-pe-strategy backtest]", err);
      res.status(500).json({ error: err.message });
    }
  });
}
