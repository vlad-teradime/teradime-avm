import { storage } from "../../storage";
import type { PeDailyMetric, PeQuarterlyEps } from "@shared/schema";

const analyticsUrl = () => process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:8001";

// ── Analytics-service calls (yfinance-backed) ─────────────

export async function fetchDailyPrices(symbol: string, fromDate: string, toDate: string) {
  const res = await fetch(`${analyticsUrl()}/pe-prices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker: symbol }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`pe-prices service error ${res.status} for ${symbol}: ${await res.text()}`);
  const data = (await res.json()) as { tradeDate: string; close: number; adjustedClose: number }[];
  const now = new Date().toISOString();
  return data
    .filter((d) => d.tradeDate >= fromDate && d.tradeDate <= toDate)
    .map((d) => ({
      symbol,
      tradeDate: d.tradeDate,
      close: d.close,
      adjustedClose: d.adjustedClose,
      source: "yahoo" as const,
      fetchedAt: now,
    }));
}

export async function fetchQuarterlyEps(symbol: string) {
  const res = await fetch(`${analyticsUrl()}/pe-quarterly-eps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker: symbol }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`pe-quarterly-eps service error ${res.status} for ${symbol}: ${await res.text()}`);
  const data = (await res.json()) as { fiscalPeriodEnd: string; availableDate: string; dilutedEps: number }[];
  const now = new Date().toISOString();
  return data.map((q) => ({
    symbol,
    fiscalPeriodEnd: q.fiscalPeriodEnd,
    availableDate: q.availableDate,
    eps: q.dilutedEps ?? null,
    dilutedEps: q.dilutedEps ?? null,
    source: "yahoo" as const,
    fetchedAt: now,
  }));
}

// ── PE Computation ────────────────────────────────────────

export function buildDailyPeSeries(
  symbol: string,
  prices: { tradeDate: string; close: number; adjustedClose?: number | null }[],
  quarters: PeQuarterlyEps[],
): PeDailyMetric[] {
  const sortedPrices = [...prices].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const usableQuarters = quarters
    .filter((q) => (q.dilutedEps ?? q.eps) != null)
    .sort((a, b) => a.availableDate.localeCompare(b.availableDate));

  const now = new Date().toISOString();
  const result: PeDailyMetric[] = [];

  for (const px of sortedPrices) {
    const knownQuarters = usableQuarters.filter((q) => q.availableDate <= px.tradeDate);
    const trailing4 = knownQuarters.slice(-4);

    if (trailing4.length < 4) {
      result.push({
        symbol,
        tradeDate: px.tradeDate,
        price: px.adjustedClose ?? px.close,
        epsTtm: null,
        peDaily: null,
        avgPe5y: null,
        epsWindowQuarterEnds: null,
        calculationVersion: 1,
        calculatedAt: now,
      });
      continue;
    }

    const epsTtm = trailing4.reduce((sum, q) => sum + (q.dilutedEps ?? q.eps ?? 0), 0);
    const price = px.adjustedClose ?? px.close;
    const peDaily = epsTtm > 0 ? price / epsTtm : null;

    result.push({
      symbol,
      tradeDate: px.tradeDate,
      price,
      epsTtm,
      peDaily,
      avgPe5y: null,
      epsWindowQuarterEnds: JSON.stringify(trailing4.map((q) => q.fiscalPeriodEnd)),
      calculationVersion: 1,
      calculatedAt: now,
    });
  }

  const valid = result.filter((r) => r.peDaily != null);
  const avg = valid.length ? valid.reduce((s, r) => s + (r.peDaily as number), 0) / valid.length : null;
  for (const row of result) row.avgPe5y = avg;
  return result;
}

// ── Orchestration ─────────────────────────────────────────

function isoDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(date: string, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return isoDateStr(d);
}
function subtractYears(date: string, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - years);
  return isoDateStr(d);
}

export async function fullBackfill(symbol: string): Promise<void> {
  const today = isoDateStr(new Date());
  const fiveYearsAgo = subtractYears(today, 5);

  const [prices, quarters] = await Promise.all([
    fetchDailyPrices(symbol, fiveYearsAgo, today),
    fetchQuarterlyEps(symbol),
  ]);

  await storage.upsertPeDailyPrices(prices);
  await storage.upsertPeQuarterlyEps(quarters);

  const allPrices = await storage.getPeDailyPrices(symbol);
  const allQuarters = await storage.getPeQuarterlyEps(symbol);
  const metrics = buildDailyPeSeries(symbol, allPrices, allQuarters);

  await storage.deletePeDailyMetrics(symbol);
  await storage.upsertPeDailyMetrics(metrics);

  const lastPrice = allPrices.length ? allPrices[allPrices.length - 1] : null;
  const lastQuarter = allQuarters.length ? allQuarters[allQuarters.length - 1] : null;
  await storage.upsertPeDatasetStatus(symbol, {
    windowStartDate: fiveYearsAgo,
    windowEndDate: today,
    lastPriceDateStored: lastPrice?.tradeDate ?? null,
    lastQuarterAvailableDateStored: lastQuarter?.availableDate ?? null,
    lastFullRebuildAt: new Date().toISOString(),
    dataCompletenessStatus: "complete",
    errorMessage: null,
  });

  await storage.upsertPeSecurity(symbol, { updatedAt: new Date().toISOString() });
}

export async function incrementalRefresh(symbol: string): Promise<void> {
  const status = await storage.getPeDatasetStatus(symbol);
  if (!status?.lastPriceDateStored) {
    return fullBackfill(symbol);
  }

  const today = isoDateStr(new Date());
  const fromDate = addDays(status.lastPriceDateStored, 1);

  const [newPrices, allNewQuarters] = await Promise.all([
    fromDate <= today ? fetchDailyPrices(symbol, fromDate, today) : Promise.resolve([]),
    fetchQuarterlyEps(symbol),
  ]);

  if (newPrices.length > 0) {
    await storage.upsertPeDailyPrices(newPrices);
  }
  const insertedQuarterDates = await storage.upsertPeQuarterlyEps(allNewQuarters);

  const allPrices = await storage.getPeDailyPrices(symbol);
  const allQuarters = await storage.getPeQuarterlyEps(symbol);

  let recalcFromDate: string;
  if (insertedQuarterDates.length > 0) {
    recalcFromDate = insertedQuarterDates.sort()[0];
  } else if (newPrices.length > 0) {
    recalcFromDate = newPrices.map((p) => p.tradeDate).sort()[0];
  } else {
    return;
  }

  const affectedPrices = allPrices.filter((p) => p.tradeDate >= recalcFromDate);
  const partialMetrics = buildDailyPeSeries(symbol, affectedPrices, allQuarters);

  const existingMetrics = await storage.getPeDailyMetrics(symbol);
  const unaffected = existingMetrics.filter((m) => m.tradeDate < recalcFromDate);
  const merged = [...unaffected, ...partialMetrics].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const valid = merged.filter((m) => m.peDaily != null);
  const avg = valid.length ? valid.reduce((s, m) => s + (m.peDaily as number), 0) / valid.length : null;
  for (const row of merged) row.avgPe5y = avg;

  await storage.upsertPeDailyMetrics(merged);

  const lastPriceStored = allPrices.length ? allPrices[allPrices.length - 1].tradeDate : status.lastPriceDateStored;
  const lastQuarter = allQuarters.length ? allQuarters[allQuarters.length - 1] : null;
  await storage.upsertPeDatasetStatus(symbol, {
    windowEndDate: today,
    lastPriceDateStored: lastPriceStored,
    lastQuarterAvailableDateStored: lastQuarter?.availableDate ?? status.lastQuarterAvailableDateStored,
    lastIncrementalRefreshAt: new Date().toISOString(),
    dataCompletenessStatus: "complete",
    errorMessage: null,
  });
}

// ── P/L Calculation ───────────────────────────────────────

export interface PlSummary {
  orders: { orderId: string; orderType: string; tradeDate: string; tradePrice: number; shares: number; notional: number }[];
  totalBuyShares: number;
  totalSellShares: number;
  netShares: number;
  avgCostRemaining: number | null;
  realizedPlDollar: number;
  realizedPlPercent: number | null;
  unrealizedPlDollar: number;
  unrealizedPlPercent: number | null;
  totalPlDollar: number;
  totalPlPercent: number | null;
  latestPrice: number | null;
}

export function computePlSummary(
  orders: { orderId: string; orderType: string; tradeDate: string; tradePrice: number; shares: number; notional: number }[],
  latestPrice: number | null,
): PlSummary {
  let totalBuyShares = 0;
  let totalBuyCost = 0;
  let totalSellShares = 0;
  let realizedPl = 0;

  let remainingShares = 0;
  let remainingCost = 0;

  for (const o of orders.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))) {
    if (o.orderType === "buy") {
      totalBuyShares += o.shares;
      totalBuyCost += o.notional;
      remainingShares += o.shares;
      remainingCost += o.notional;
    } else {
      totalSellShares += o.shares;
      const avgCost = remainingShares > 0 ? remainingCost / remainingShares : 0;
      const costAllocated = avgCost * o.shares;
      realizedPl += o.notional - costAllocated;
      remainingShares = Math.max(0, remainingShares - o.shares);
      remainingCost = Math.max(0, remainingCost - costAllocated);
    }
  }

  const avgCostRemaining = remainingShares > 0 ? remainingCost / remainingShares : null;
  const unrealizedPl = latestPrice != null && avgCostRemaining != null ? remainingShares * (latestPrice - avgCostRemaining) : 0;
  const totalPl = realizedPl + unrealizedPl;

  const investedCapital = totalBuyCost;
  const realizedPlPercent =
    investedCapital > 0 ? (realizedPl / (totalSellShares * (avgCostRemaining ?? (totalBuyCost / totalBuyShares || 1)))) * 100 : null;
  const unrealizedPlPercent = remainingCost > 0 ? (unrealizedPl / remainingCost) * 100 : null;
  const totalPlPercent = investedCapital > 0 ? (totalPl / investedCapital) * 100 : null;

  return {
    orders: orders.map((o) => ({ orderId: o.orderId, orderType: o.orderType, tradeDate: o.tradeDate, tradePrice: o.tradePrice, shares: o.shares, notional: o.notional })),
    totalBuyShares,
    totalSellShares,
    netShares: remainingShares,
    avgCostRemaining,
    realizedPlDollar: realizedPl,
    realizedPlPercent,
    unrealizedPlDollar: unrealizedPl,
    unrealizedPlPercent,
    totalPlDollar: totalPl,
    totalPlPercent,
    latestPrice,
  };
}
