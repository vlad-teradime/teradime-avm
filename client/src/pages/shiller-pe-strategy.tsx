import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import AppShell from "@/components/AppShell";
import ShillerPeStrategyChart, { downsampleForChart, type ShillerPeChartPoint, type ShillerPeMarkerPoint } from "@/components/shiller-pe-strategy-chart";

const BASE = "/api/screeners/shiller-pe-strategy";

type Frequency = "daily" | "weekly" | "monthly";
type ThresholdMode = "stddev" | "absolute";

interface DataRange {
  earliestMonthlyDate: string | null;
  latestMonthlyDate: string | null;
  earliestDailyDate: string | null;
  latestDailyDate: string | null;
}

interface StrategySummary {
  finalMarketValue: number;
  totalGain: number;
  outperformanceVsBuyHold: number | null;
  outperformancePct: number | null;
}

interface BacktestPoint {
  date: string;
  price: number;
  buyHold: { marketValue: number };
  strategy2: { signal: "buy" | "hold"; shares: number; cash: number; marketValue: number };
  strategy3: { signal: "buy" | "hold"; sellSignal: "buy" | "hold" | "sell"; shares: number; cash: number; marketValue: number };
}

interface TradeEvent {
  date: string;
  type: "buy" | "sell";
  price: number;
  shares: number;
  cash: number;
  marketValue: number;
}

function buildStrategy2Events(series: BacktestPoint[]): TradeEvent[] {
  const events: TradeEvent[] = [];
  let prevSignal: "buy" | "hold" = "hold";
  for (const p of series) {
    if (p.strategy2.signal === "buy" && prevSignal !== "buy") {
      events.push({ date: p.date, type: "buy", price: p.price, shares: p.strategy2.shares, cash: p.strategy2.cash, marketValue: p.strategy2.marketValue });
    }
    prevSignal = p.strategy2.signal;
  }
  return events;
}

function buildStrategy3Events(series: BacktestPoint[]): TradeEvent[] {
  const events: TradeEvent[] = [];
  let prevSignal: "buy" | "hold" = "hold";
  for (const p of series) {
    if (p.strategy3.sellSignal === "sell") {
      events.push({ date: p.date, type: "sell", price: p.price, shares: p.strategy3.shares, cash: p.strategy3.cash, marketValue: p.strategy3.marketValue });
    } else if (p.strategy3.signal === "buy" && prevSignal !== "buy") {
      events.push({ date: p.date, type: "buy", price: p.price, shares: p.strategy3.shares, cash: p.strategy3.cash, marketValue: p.strategy3.marketValue });
    }
    prevSignal = p.strategy3.signal;
  }
  return events;
}

interface BacktestResult {
  series: BacktestPoint[];
  summary: {
    totalCapitalDeployed: number;
    buyHold: StrategySummary;
    strategy2: StrategySummary;
    strategy3: StrategySummary;
  };
}

function selectClass() {
  return "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtPercent(n: number) {
  return `${n.toFixed(1)}%`;
}

export default function ShillerPeStrategyPage() {
  const qc = useQueryClient();

  const { data: dataRange, refetch: refetchDataRange } = useQuery<DataRange>({
    queryKey: [`${BASE}/data-range`],
    queryFn: async () => {
      const res = await fetch(`${BASE}/data-range`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const [startDate, setStartDate] = useState("1971-01-01");
  const [endDate, setEndDate] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [thresholdMode, setThresholdMode] = useState<ThresholdMode>("stddev");
  const [sdMultiplier, setSdMultiplier] = useState("2.5");
  const [absoluteThreshold, setAbsoluteThreshold] = useState("30");
  const [contributionAmount, setContributionAmount] = useState("100");
  const [trendMaMonths, setTrendMaMonths] = useState("12");
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  useEffect(() => {
    if (dataRange?.latestMonthlyDate && !endDate) setEndDate(dataRange.latestMonthlyDate);
  }, [dataRange, endDate]);

  const backtestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          frequency,
          thresholdMode,
          sdMultiplier: parseFloat(sdMultiplier),
          absoluteThreshold: thresholdMode === "absolute" ? parseFloat(absoluteThreshold) : null,
          contributionAmount: parseFloat(contributionAmount),
          trendMaMonths: parseFloat(trendMaMonths),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `${res.status}`);
      }
      return res.json() as Promise<BacktestResult>;
    },
    onMutate: () => setBacktestError(null),
    onSuccess: setResult,
    onError: (err: Error) => setBacktestError(err.message),
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "incremental" }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      refetchDataRange();
      qc.invalidateQueries({ queryKey: [`${BASE}/data-range`] });
    },
  });

  const chartData: ShillerPeChartPoint[] = useMemo(() => {
    if (!result) return [];
    return downsampleForChart(result.series.map((p) => ({
      date: p.date,
      buyHoldValue: p.buyHold.marketValue,
      strategy2Value: p.strategy2.marketValue,
      strategy3Value: p.strategy3.marketValue,
    })));
  }, [result]);

  const strategy2Events = useMemo(() => (result ? buildStrategy2Events(result.series) : []), [result]);
  const strategy3Events = useMemo(() => (result ? buildStrategy3Events(result.series) : []), [result]);

  const strategy2Buys: ShillerPeMarkerPoint[] = useMemo(
    () => strategy2Events.filter((e) => e.type === "buy").map((e) => ({ date: e.date, marketValue: e.marketValue })),
    [strategy2Events],
  );
  const strategy3Buys: ShillerPeMarkerPoint[] = useMemo(
    () => strategy3Events.filter((e) => e.type === "buy").map((e) => ({ date: e.date, marketValue: e.marketValue })),
    [strategy3Events],
  );
  const strategy3Sells: ShillerPeMarkerPoint[] = useMemo(
    () => strategy3Events.filter((e) => e.type === "sell").map((e) => ({ date: e.date, marketValue: e.marketValue })),
    [strategy3Events],
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Shiller PE DCA Strategy Screener</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Backtest dollar-cost-averaging into the S&amp;P 500 with Shiller PE valuation and price-trend filters,
            against a plain Buy &amp; Hold baseline.
          </p>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Parameters</h3>
            <Button size="sm" variant="outline" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
              {refreshMutation.isPending ? "Refreshing data…" : "Refresh market data"}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input
                type="date"
                className="dark:[color-scheme:dark]"
                value={startDate}
                min={dataRange?.earliestMonthlyDate ?? undefined}
                max={dataRange?.latestMonthlyDate ?? undefined}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input
                type="date"
                className="dark:[color-scheme:dark]"
                value={endDate}
                min={dataRange?.earliestMonthlyDate ?? undefined}
                max={dataRange?.latestMonthlyDate ?? undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Trading frequency</Label>
              <select className={selectClass()} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Contribution per period</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input type="number" min="1" className="pl-6" value={contributionAmount} onChange={(e) => setContributionAmount(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Overvaluation threshold</Label>
              <select className={selectClass()} value={thresholdMode} onChange={(e) => setThresholdMode(e.target.value as ThresholdMode)}>
                <option value="stddev">Std. deviations above mean</option>
                <option value="absolute">Absolute Shiller PE value</option>
              </select>
            </div>
            {thresholdMode === "stddev" ? (
              <div className="space-y-1.5">
                <Label>Std. deviation multiplier</Label>
                <Input type="number" step="0.1" min="0" value={sdMultiplier} onChange={(e) => setSdMultiplier(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Absolute Shiller PE threshold</Label>
                <Input type="number" step="0.5" min="1" value={absoluteThreshold} onChange={(e) => setAbsoluteThreshold(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Trend MA window (months)</Label>
              <Input type="number" min="1" value={trendMaMonths} onChange={(e) => setTrendMaMonths(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={() => backtestMutation.mutate()} disabled={backtestMutation.isPending || !startDate || !endDate}>
                {backtestMutation.isPending ? "Running…" : "Run Backtest"}
              </Button>
            </div>
          </div>

          {dataRange && (
            <p className="text-xs text-muted-foreground">
              Data available {dataRange.earliestMonthlyDate ?? "—"} to {dataRange.latestMonthlyDate ?? "—"} (monthly Shiller PE)
              {dataRange.earliestDailyDate && `, ${dataRange.earliestDailyDate} to ${dataRange.latestDailyDate} (daily price)`}.
            </p>
          )}

          {backtestError && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{backtestError}</span>
            </div>
          )}
        </div>

        {result && (
          <>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium mb-3">Portfolio Value Over Time</p>
              <ShillerPeStrategyChart
                data={chartData}
                strategy2Buys={strategy2Buys}
                strategy3Buys={strategy3Buys}
                strategy3Sells={strategy3Sells}
              />
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Results Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4 font-medium">Metric</th>
                      <th className="py-2 pr-4 font-medium">Buy &amp; Hold</th>
                      <th className="py-2 pr-4 font-medium">Valuation-Filtered DCA</th>
                      <th className="py-2 pr-4 font-medium">Valuation + Trend Filtered DCA</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-4">Total Capital Deployed</td>
                      <td className="py-2 pr-4" colSpan={3}>{fmtCurrency(result.summary.totalCapitalDeployed)}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-4">Final Market Value</td>
                      <td className="py-2 pr-4">{fmtCurrency(result.summary.buyHold.finalMarketValue)}</td>
                      <td className="py-2 pr-4">{fmtCurrency(result.summary.strategy2.finalMarketValue)}</td>
                      <td className="py-2 pr-4">{fmtCurrency(result.summary.strategy3.finalMarketValue)}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-4">Total Gain</td>
                      <td className="py-2 pr-4">{fmtCurrency(result.summary.buyHold.totalGain)}</td>
                      <td className="py-2 pr-4">{fmtCurrency(result.summary.strategy2.totalGain)}</td>
                      <td className="py-2 pr-4">{fmtCurrency(result.summary.strategy3.totalGain)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Outperformance vs. Buy &amp; Hold</td>
                      <td className="py-2 pr-4 text-muted-foreground">Baseline</td>
                      <td className="py-2 pr-4">
                        {result.summary.strategy2.outperformanceVsBuyHold != null && (
                          <>{fmtCurrency(result.summary.strategy2.outperformanceVsBuyHold)} ({fmtPercent((result.summary.strategy2.outperformancePct ?? 0) * 100)})</>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {result.summary.strategy3.outperformanceVsBuyHold != null && (
                          <>{fmtCurrency(result.summary.strategy3.outperformanceVsBuyHold)} ({fmtPercent((result.summary.strategy3.outperformancePct ?? 0) * 100)})</>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Back-tested performance does not guarantee future results. This model does not account for
                transaction costs, taxes, or bid-ask spreads.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <TradeLog title="Valuation-Filtered DCA — Buys" events={strategy2Events} />
              <TradeLog title="Valuation + Trend Filtered DCA — Buys & Sells" events={strategy3Events} />
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}

function TradeLog({ title, events }: { title: string; events: TradeEvent[] }) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No buy or sell transitions in this period.</p>
      ) : (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="sticky top-0 z-10 bg-background py-2 pr-4 font-medium border-b border-border">Date</th>
                <th className="sticky top-0 z-10 bg-background py-2 pr-4 font-medium border-b border-border">Type</th>
                <th className="sticky top-0 z-10 bg-background py-2 pr-4 font-medium border-b border-border">Price</th>
                <th className="sticky top-0 z-10 bg-background py-2 pr-4 font-medium border-b border-border">Shares (rolling)</th>
                <th className="sticky top-0 z-10 bg-background py-2 pr-4 font-medium border-b border-border">Cash (rolling)</th>
                <th className="sticky top-0 z-10 bg-background py-2 pr-4 font-medium border-b border-border">Market Value (rolling)</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={`${e.date}-${i}`} className="border-b border-border/50">
                  <td className="py-2 pr-4">{e.date}</td>
                  <td className={`py-2 pr-4 font-medium capitalize ${e.type === "buy" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {e.type}
                  </td>
                  <td className="py-2 pr-4">{fmtCurrency(e.price)}</td>
                  <td className="py-2 pr-4">{e.shares.toFixed(2)}</td>
                  <td className="py-2 pr-4">{fmtCurrency(e.cash)}</td>
                  <td className="py-2 pr-4">{fmtCurrency(e.marketValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
