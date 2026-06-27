export type Frequency = "daily" | "weekly" | "monthly";
export type ThresholdMode = "stddev" | "absolute";

export interface ThresholdParams {
  thresholdMode: ThresholdMode;
  sdMultiplier: number;
  absoluteThreshold: number | null;
}

export interface BacktestParams {
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  frequency: Frequency;
  thresholdMode: ThresholdMode;
  sdMultiplier: number;
  absoluteThreshold: number | null;
  contributionAmount: number;
  trendMaMonths: number;
}

export interface PeriodPoint {
  date: string;
  price: number;
  shillerPe: number;
}

export type Signal2 = "buy" | "hold";
export type Signal3Main = "buy" | "hold";
export type Signal3Sell = "buy" | "hold" | "sell";

export interface BacktestPointResult {
  date: string;
  shillerPe: number;
  rollingMean: number;
  rollingStdDev: number;
  price: number;
  trendMa: number | null;
  buyHold: { shares: number; invested: number; marketValue: number };
  strategy2: { signal: Signal2; shares: number; cash: number; marketValue: number };
  strategy3: { signal: Signal3Main; sellSignal: Signal3Sell; shares: number; cash: number; marketValue: number };
}

export interface StrategySummary {
  finalMarketValue: number;
  totalGain: number;
  outperformanceVsBuyHold: number | null;
  outperformancePct: number | null;
}

export interface BacktestSummary {
  totalCapitalDeployed: number;
  buyHold: StrategySummary;
  strategy2: StrategySummary;
  strategy3: StrategySummary;
}

export interface BacktestResult {
  series: BacktestPointResult[];
  summary: BacktestSummary;
}
