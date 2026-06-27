// Backtest orchestrator for the three Shiller PE DCA strategies.
//
// Strategy 2 and Strategy 3 cash-deployment mechanics mirror the reference
// model's spreadsheet formulas exactly (not just the design doc's narrative
// summary), since those formulas are what produced the doc's reported
// back-test numbers:
//   - Strategy 2 drips accumulated cash back in $contributionAmount-sized
//     chunks on each BUY period until the backlog is exhausted, rather than
//     deploying it all in a single lump sum.
//   - Strategy 3 deploys 100% of accumulated cash in one lump sum on BUY,
//     and on SELL converts the *prior* period's share balance to cash using
//     the *prior* period's price (a quirk of the reference spreadsheet,
//     preserved here for fidelity to the documented results).

import type {
  BacktestParams, BacktestPointResult, BacktestResult, BacktestSummary, StrategySummary,
  ThresholdParams,
} from "./types.js";
import { buildPeriodSeries, withRollingStats, withTrendMa, trendWindowPeriods, type ShillerPeMonthlyRow, type Sp500DailyPriceRow } from "./resample.js";
import { strategy2Signal, strategy3MainSignal, strategy3SellSignal } from "./signals.js";

export function runBacktest(
  monthlyRows: ShillerPeMonthlyRow[],
  dailyRows: Sp500DailyPriceRow[],
  params: BacktestParams,
): BacktestResult {
  const base = buildPeriodSeries(params.frequency, monthlyRows, dailyRows);
  const statSeries = withRollingStats(base);
  const windowPeriods = trendWindowPeriods(params.trendMaMonths, params.frequency);
  const fullSeries = withTrendMa(statSeries, windowPeriods);

  const simSeries = fullSeries.filter(p => p.date >= params.startDate && p.date <= params.endDate);

  const thresholdParams: ThresholdParams = {
    thresholdMode: params.thresholdMode,
    sdMultiplier: params.sdMultiplier,
    absoluteThreshold: params.absoluteThreshold,
  };
  const contribution = params.contributionAmount;

  const series: BacktestPointResult[] = [];

  let bhShares = 0;
  let bhInvested = 0;

  let s2Shares = 0;
  let s2Cash = 0;

  let s3Shares = 0;
  let s3Cash = 0;
  let prevPrice: number | null = null;

  for (const point of simSeries) {
    const { price, shillerPe, rollingMean, rollingStdDev, trendMa } = point;

    // Buy & Hold
    bhShares += contribution / price;
    bhInvested += contribution;
    const bhMarketValue = bhShares * price;

    // Strategy 2 — valuation-filtered DCA
    const sig2 = strategy2Signal(shillerPe, rollingMean, rollingStdDev, thresholdParams);
    if (sig2 === "hold") {
      s2Cash += contribution;
    } else {
      const drawnDown = s2Cash > 0 ? s2Cash - contribution : s2Cash;
      s2Cash = drawnDown;
      const extraShares = s2Cash > 0 ? contribution / price : 0;
      s2Shares += contribution / price + extraShares;
    }
    const s2MarketValue = s2Shares * price + s2Cash;

    // Strategy 3 — valuation + trend filtered DCA, with sell
    const sig3Main = strategy3MainSignal(shillerPe, rollingMean, rollingStdDev, price, trendMa, thresholdParams);
    const sig3Sell = strategy3SellSignal(sig3Main, shillerPe, rollingMean, rollingStdDev, price, trendMa, thresholdParams);

    if (sig3Sell === "sell") {
      const proceeds = prevPrice != null ? s3Shares * prevPrice : 0;
      s3Cash = s3Cash + contribution + proceeds;
      s3Shares = 0;
    } else if (sig3Main === "buy") {
      const extraShares = s3Cash > 0 ? s3Cash / price : 0;
      s3Shares += contribution / price + extraShares;
      s3Cash = s3Cash > 0 ? 0 : s3Cash;
    } else {
      s3Cash += contribution;
    }
    const s3MarketValue = s3Shares * price + s3Cash;

    series.push({
      date: point.date,
      shillerPe,
      rollingMean,
      rollingStdDev,
      price,
      trendMa,
      buyHold: { shares: bhShares, invested: bhInvested, marketValue: bhMarketValue },
      strategy2: { signal: sig2, shares: s2Shares, cash: s2Cash, marketValue: s2MarketValue },
      strategy3: { signal: sig3Main, sellSignal: sig3Sell, shares: s3Shares, cash: s3Cash, marketValue: s3MarketValue },
    });

    prevPrice = price;
  }

  const summary = buildSummary(series, contribution);
  return { series, summary };
}

function buildSummary(series: BacktestPointResult[], contribution: number): BacktestSummary {
  const totalCapitalDeployed = contribution * series.length;
  const last = series[series.length - 1];

  const buyHold = strategySummary(last?.buyHold.marketValue ?? 0, totalCapitalDeployed, null);
  const strategy2 = strategySummary(last?.strategy2.marketValue ?? 0, totalCapitalDeployed, buyHold);
  const strategy3 = strategySummary(last?.strategy3.marketValue ?? 0, totalCapitalDeployed, buyHold);

  return { totalCapitalDeployed, buyHold, strategy2, strategy3 };
}

function strategySummary(finalMarketValue: number, totalCapitalDeployed: number, buyHold: StrategySummary | null): StrategySummary {
  const totalGain = finalMarketValue - totalCapitalDeployed;
  if (!buyHold) {
    return { finalMarketValue, totalGain, outperformanceVsBuyHold: null, outperformancePct: null };
  }
  const outperformanceVsBuyHold = totalGain - buyHold.totalGain;
  const outperformancePct = buyHold.totalGain !== 0 ? outperformanceVsBuyHold / buyHold.totalGain : null;
  return { finalMarketValue, totalGain, outperformanceVsBuyHold, outperformancePct };
}
