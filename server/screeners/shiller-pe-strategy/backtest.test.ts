import { describe, it, expect } from "vitest";
import { runBacktest } from "./backtest.js";
import type { ShillerPeMonthlyRow } from "./resample.js";
import type { BacktestParams } from "./types.js";

function monthly(rows: { periodDate: string; sp500Price: number; shillerPe: number }[]): ShillerPeMonthlyRow[] {
  return rows.map(r => ({ ...r, earningsBase: r.sp500Price / r.shillerPe }));
}

const baseParams: BacktestParams = {
  startDate: "2000-01-01",
  endDate: "2000-12-01",
  frequency: "monthly",
  thresholdMode: "stddev",
  sdMultiplier: 2.5,
  absoluteThreshold: null,
  contributionAmount: 100,
  trendMaMonths: 12,
};

describe("runBacktest — strategy 2 and buy & hold mechanics (SD threshold, no trend data)", () => {
  // pe series [10, 30, 10, 10, 30] / price [100, 110, 90, 120, 130].
  // With trendMaMonths=12 and only 5 points, the trend MA never populates,
  // so Strategy 3 degenerates to "buy only when undervalued vs. all-time mean".
  const rows = monthly([
    { periodDate: "2000-01-01", sp500Price: 100, shillerPe: 10 },
    { periodDate: "2000-02-01", sp500Price: 110, shillerPe: 30 },
    { periodDate: "2000-03-01", sp500Price: 90, shillerPe: 10 },
    { periodDate: "2000-04-01", sp500Price: 120, shillerPe: 10 },
    { periodDate: "2000-05-01", sp500Price: 130, shillerPe: 30 },
  ]);
  const params: BacktestParams = { ...baseParams, startDate: "2000-01-01", endDate: "2000-05-01" };
  const { series, summary } = runBacktest(rows, [], params);

  it("computes Buy & Hold shares/value every period regardless of signal", () => {
    expect(series[0].buyHold.shares).toBeCloseTo(1, 6);
    expect(series[0].buyHold.marketValue).toBeCloseTo(100, 6);
    expect(series[4].buyHold.invested).toBeCloseTo(500, 6);
  });

  it("Strategy 2: holds first period (PE==mean, no variance yet), then buys and drains backlog cash $100/period", () => {
    expect(series[0].strategy2.signal).toBe("hold");
    expect(series[0].strategy2.cash).toBeCloseTo(100, 6);
    expect(series[0].strategy2.marketValue).toBeCloseTo(100, 6);

    expect(series[1].strategy2.signal).toBe("buy");
    expect(series[1].strategy2.cash).toBeCloseTo(0, 6);
    expect(series[1].strategy2.shares).toBeCloseTo(100 / 110, 6);
    expect(series[1].strategy2.marketValue).toBeCloseTo(100, 6);

    expect(series[4].strategy2.shares).toBeCloseTo(100 / 110 + 100 / 90 + 100 / 120 + 100 / 130, 6);
    expect(series[4].strategy2.marketValue).toBeCloseTo(series[4].strategy2.shares * 130, 6);
  });

  it("Strategy 3 with no trend data: buys only when PE < rolling all-time mean", () => {
    expect(series[0].strategy3.signal).toBe("hold");
    expect(series[1].strategy3.signal).toBe("hold"); // pe 30 > mean 20
    expect(series[2].strategy3.signal).toBe("buy");   // pe 10 < mean 16.67
    expect(series[3].strategy3.signal).toBe("buy");   // pe 10 < mean 15
    expect(series[4].strategy3.signal).toBe("hold");  // pe 30 > mean 18

    // m1, m2 hold -> cash builds to 200; m3 buy deploys full cash lump sum + contribution
    expect(series[2].strategy3.cash).toBeCloseTo(0, 6);
    expect(series[2].strategy3.shares).toBeCloseTo(100 / 90 + 200 / 90, 6);
    expect(series[2].strategy3.marketValue).toBeCloseTo(300, 6);
  });

  it("summary totals capital deployed identically across strategies", () => {
    expect(summary.totalCapitalDeployed).toBeCloseTo(500, 6);
    expect(summary.buyHold.finalMarketValue).toBeCloseTo(series[4].buyHold.marketValue, 6);
    expect(summary.strategy2.outperformanceVsBuyHold).toBeCloseTo(
      summary.strategy2.totalGain - summary.buyHold.totalGain, 6,
    );
  });
});

describe("runBacktest — strategy 3 sell signal uses prior-period price for proceeds", () => {
  // pe [5, 5, 40] / price [100, 105, 90], absolute threshold=20, trend window=2 months.
  // m2 trend MA = avg(100,105)=102.5, price 105 > 102.5 -> uptrend -> BUY.
  // m3 trend MA = avg(105,90)=97.5, price 90 < 97.5 and PE 40 overpriced -> SELL.
  const rows = monthly([
    { periodDate: "2000-01-01", sp500Price: 100, shillerPe: 5 },
    { periodDate: "2000-02-01", sp500Price: 105, shillerPe: 5 },
    { periodDate: "2000-03-01", sp500Price: 90, shillerPe: 40 },
  ]);
  const params: BacktestParams = {
    ...baseParams,
    startDate: "2000-01-01",
    endDate: "2000-03-01",
    thresholdMode: "absolute",
    absoluteThreshold: 20,
    trendMaMonths: 2,
  };
  const { series } = runBacktest(rows, [], params);

  it("m1 holds (no trend data yet, not undervalued vs. itself)", () => {
    expect(series[0].strategy3.signal).toBe("hold");
    expect(series[0].strategy3.cash).toBeCloseTo(100, 6);
  });

  it("m2 buys with the lump-sum accumulated cash", () => {
    expect(series[1].strategy3.signal).toBe("buy");
    expect(series[1].strategy3.cash).toBeCloseTo(0, 6);
    expect(series[1].strategy3.shares).toBeCloseTo(200 / 105, 6);
  });

  it("m3 sells, converting prior shares to cash at the prior period's price (105), not the current price (90)", () => {
    expect(series[2].strategy3.sellSignal).toBe("sell");
    expect(series[2].strategy3.shares).toBeCloseTo(0, 6);
    // proceeds = shares-after-m2 (200/105) * prevPrice (105) = 200, exactly.
    expect(series[2].strategy3.cash).toBeCloseTo(100 + 200, 6);
    expect(series[2].strategy3.marketValue).toBeCloseTo(300, 6);
  });
});
