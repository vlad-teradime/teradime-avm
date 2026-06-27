// Builds the period-level (daily/weekly/monthly) price + Shiller PE series
// used to drive the backtest, including no-lookahead rolling mean/stddev
// and a price trend moving average.

import type { Frequency, PeriodPoint } from "./types.js";

export interface ShillerPeMonthlyRow {
  periodDate: string;
  sp500Price: number;
  shillerPe: number;
  earningsBase: number;
}

export interface Sp500DailyPriceRow {
  tradeDate: string;
  close: number;
}

export function buildMonthlySeries(monthlyRows: ShillerPeMonthlyRow[]): PeriodPoint[] {
  return monthlyRows
    .slice()
    .sort((a, b) => a.periodDate.localeCompare(b.periodDate))
    .map(r => ({ date: r.periodDate, price: r.sp500Price, shillerPe: r.shillerPe }));
}

// Daily Shiller PE = today's S&P close / the most recently published month's
// earnings base (sp500Price / shillerPe at that month). This is the same
// derivation multpl.com uses to publish a "daily" CAPE between official
// monthly updates.
export function buildDailyDerivedSeries(
  dailyPrices: Sp500DailyPriceRow[],
  monthlyRows: ShillerPeMonthlyRow[],
): PeriodPoint[] {
  const sortedMonthly = monthlyRows.slice().sort((a, b) => a.periodDate.localeCompare(b.periodDate));
  const sortedDaily = dailyPrices.slice().sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));

  const result: PeriodPoint[] = [];
  let mi = -1;
  for (const d of sortedDaily) {
    while (mi + 1 < sortedMonthly.length && sortedMonthly[mi + 1].periodDate <= d.tradeDate) mi++;
    if (mi < 0) continue;
    const base = sortedMonthly[mi].earningsBase;
    if (!(base > 0)) continue;
    result.push({ date: d.tradeDate, price: d.close, shillerPe: d.close / base });
  }
  return result;
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// One point per ISO week: the last trading day available that week.
export function resampleWeekly(dailySeries: PeriodPoint[]): PeriodPoint[] {
  const byWeek = new Map<string, PeriodPoint>();
  for (const p of dailySeries) {
    byWeek.set(isoWeekKey(p.date), p);
  }
  return Array.from(byWeek.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function buildPeriodSeries(
  frequency: Frequency,
  monthlyRows: ShillerPeMonthlyRow[],
  dailyRows: Sp500DailyPriceRow[],
): PeriodPoint[] {
  if (frequency === "monthly") return buildMonthlySeries(monthlyRows);
  const daily = buildDailyDerivedSeries(dailyRows, monthlyRows);
  return frequency === "daily" ? daily : resampleWeekly(daily);
}

export interface WithRollingStats extends PeriodPoint {
  rollingMean: number;
  rollingStdDev: number;
}

// Cumulative population mean/stddev using only data up to and including
// each point — no lookahead, matching AVERAGE($C$3:Cn) / STDEV.P($C$3:Cn).
export function withRollingStats(series: PeriodPoint[]): WithRollingStats[] {
  let sum = 0;
  let sumSq = 0;
  const out: WithRollingStats[] = [];
  for (let i = 0; i < series.length; i++) {
    const pe = series[i].shillerPe;
    sum += pe;
    sumSq += pe * pe;
    const n = i + 1;
    const mean = sum / n;
    const variance = Math.max(0, sumSq / n - mean * mean);
    out.push({ ...series[i], rollingMean: mean, rollingStdDev: Math.sqrt(variance) });
  }
  return out;
}

export function periodsPerMonth(frequency: Frequency): number {
  switch (frequency) {
    case "monthly": return 1;
    case "weekly": return 52 / 12;
    case "daily": return 21;
  }
}

export function trendWindowPeriods(trendMaMonths: number, frequency: Frequency): number {
  return Math.max(1, Math.round(trendMaMonths * periodsPerMonth(frequency)));
}

export interface WithTrendMa {
  trendMa: number | null;
}

export function withTrendMa<T extends PeriodPoint>(series: T[], windowPeriods: number): (T & WithTrendMa)[] {
  const out: (T & WithTrendMa)[] = [];
  let windowSum = 0;
  for (let i = 0; i < series.length; i++) {
    windowSum += series[i].price;
    if (i >= windowPeriods) windowSum -= series[i - windowPeriods].price;
    const trendMa = i >= windowPeriods - 1 ? windowSum / windowPeriods : null;
    out.push({ ...series[i], trendMa });
  }
  return out;
}
