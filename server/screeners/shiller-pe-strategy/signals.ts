// Pure BUY/HOLD/SELL signal logic for the three Shiller PE DCA strategies.
// Mirrors the reference model's column M/R/S formulas, generalized so the
// 2.5-SD threshold can be either an SD multiplier or an absolute PE value.

import type { ThresholdParams, Signal2, Signal3Main, Signal3Sell } from "./types.js";

export function thresholdValue(mean: number, stdDev: number, params: ThresholdParams): number {
  if (params.thresholdMode === "absolute" && params.absoluteThreshold != null) {
    return params.absoluteThreshold;
  }
  return mean + params.sdMultiplier * stdDev;
}

export function isOverpriced(pe: number, mean: number, stdDev: number, params: ThresholdParams): boolean {
  return pe >= thresholdValue(mean, stdDev, params);
}

// The undervaluation override always compares against the plain rolling
// all-time mean, independent of the SD multiplier / absolute threshold mode.
export function isUndervalued(pe: number, mean: number): boolean {
  return pe < mean;
}

export function strategy2Signal(pe: number, mean: number, stdDev: number, params: ThresholdParams): Signal2 {
  return isOverpriced(pe, mean, stdDev, params) ? "hold" : "buy";
}

export function strategy3MainSignal(
  pe: number,
  mean: number,
  stdDev: number,
  price: number,
  trendMa: number | null,
  params: ThresholdParams,
): Signal3Main {
  const overpriced = isOverpriced(pe, mean, stdDev, params);
  const uptrend = trendMa != null && price > trendMa;
  const undervalued = isUndervalued(pe, mean);
  return (!overpriced && uptrend) || undervalued ? "buy" : "hold";
}

export function strategy3SellSignal(
  main: Signal3Main,
  pe: number,
  mean: number,
  stdDev: number,
  price: number,
  trendMa: number | null,
  params: ThresholdParams,
): Signal3Sell {
  if (main === "hold" && trendMa != null && isOverpriced(pe, mean, stdDev, params) && price < trendMa) {
    return "sell";
  }
  return main;
}
