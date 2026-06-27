// Fetches/seeds/refreshes the Shiller PE Strategy Screener's two source
// series via the analytics-service: the monthly Shiller CAPE dataset
// (back to 1881) and daily S&P 500 (^GSPC) prices (back to 1927).

import { storage } from "../../storage";

const analyticsUrl = () => process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:8001";

export async function fetchShillerCape(): Promise<{ periodDate: string; sp500Price: number; shillerPe: number }[]> {
  const res = await fetch(`${analyticsUrl()}/shiller-cape`, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`shiller-cape service error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function fetchSp500DailyPrices(period: string = "max"): Promise<{ tradeDate: string; close: number }[]> {
  const res = await fetch(`${analyticsUrl()}/index-daily-prices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker: "^GSPC", period }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`index-daily-prices service error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function fullBackfill(): Promise<void> {
  const now = new Date().toISOString();
  const [capeRows, priceRows] = await Promise.all([
    fetchShillerCape(),
    fetchSp500DailyPrices("max"),
  ]);

  const monthlyRows = capeRows.map((r) => ({
    periodDate: r.periodDate,
    sp500Price: r.sp500Price,
    shillerPe: r.shillerPe,
    earningsBase: r.sp500Price / r.shillerPe,
    source: "shiller_dataset",
    fetchedAt: now,
  }));
  await storage.upsertShillerCapeMonthly(monthlyRows);

  const dailyRows = priceRows.map((r) => ({
    tradeDate: r.tradeDate,
    close: r.close,
    source: "yfinance",
    fetchedAt: now,
  }));
  await storage.upsertSp500DailyPrices(dailyRows);

  const lastMonth = monthlyRows.length ? monthlyRows[monthlyRows.length - 1].periodDate : null;
  const lastPriceDate = dailyRows.length ? dailyRows[dailyRows.length - 1].tradeDate : null;

  await storage.upsertShillerDatasetStatus({
    lastShillerMonthStored: lastMonth,
    lastPriceDateStored: lastPriceDate,
    lastFullRebuildAt: now,
    dataCompletenessStatus: "complete",
    errorMessage: null,
  });
}

export async function incrementalRefresh(): Promise<void> {
  const status = await storage.getShillerDatasetStatus();
  if (!status?.lastShillerMonthStored || !status?.lastPriceDateStored) {
    return fullBackfill();
  }

  // The Shiller dataset and ^GSPC history are both small enough (a few
  // thousand rows) that re-fetching and upserting the full series on every
  // refresh is simpler and more robust than computing a date-bounded diff —
  // upserts are idempotent and cheap at this volume.
  return fullBackfill();
}

export async function getDataRange(): Promise<{
  earliestMonthlyDate: string | null;
  latestMonthlyDate: string | null;
  earliestDailyDate: string | null;
  latestDailyDate: string | null;
  status: Awaited<ReturnType<typeof storage.getShillerDatasetStatus>>;
}> {
  const [monthly, daily, status] = await Promise.all([
    storage.getShillerCapeMonthly(),
    storage.getSp500DailyPrices(),
    storage.getShillerDatasetStatus(),
  ]);
  return {
    earliestMonthlyDate: monthly.length ? monthly[0].periodDate : null,
    latestMonthlyDate: monthly.length ? monthly[monthly.length - 1].periodDate : null,
    earliestDailyDate: daily.length ? daily[0].tradeDate : null,
    latestDailyDate: daily.length ? daily[daily.length - 1].tradeDate : null,
    status,
  };
}
