import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, RotateCcw, TrendingUp } from "lucide-react";
import PeChart, { type PeSeriesPoint } from "@/components/pe-chart";
import PeTradeModal from "@/components/pe-trade-modal";
import AppShell from "@/components/AppShell";

const BASE = "/api/screeners/pe-evaluator";

interface SeriesResponse {
  symbol: string;
  latestPrice: number | null;
  latestPe: number | null;
  avgPe5y: number | null;
  series: PeSeriesPoint[];
}

interface PlSummary {
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

function fmt(n: number | null, decimals = 2, prefix = "") {
  if (n == null) return "—";
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${n < 0 ? "-" : ""}${prefix}${s}`;
}

function plClass(n: number | null) {
  if (n == null || n === 0) return "";
  return n > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

export default function PeEvaluatorPage() {
  const qc = useQueryClient();
  const [inputSymbol, setInputSymbol] = useState("");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [tradePoint, setTradePoint] = useState<PeSeriesPoint | null>(null);

  const { data: seriesData, isLoading: seriesLoading } = useQuery<SeriesResponse>({
    queryKey: [`${BASE}/series`, activeSymbol],
    queryFn: async () => {
      const res = await fetch(`${BASE}/${encodeURIComponent(activeSymbol!)}/series`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!activeSymbol,
    staleTime: 60_000,
  });

  const { data: plData, isLoading: plLoading } = useQuery<PlSummary>({
    queryKey: [`${BASE}/orders/summary`, activeSymbol],
    queryFn: async () => {
      const res = await fetch(`${BASE}/${encodeURIComponent(activeSymbol!)}/orders/summary`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!activeSymbol,
  });

  const recalcMutation = useMutation({
    mutationFn: async ({ symbol, mode }: { symbol: string; mode: "incremental" | "full" }) => {
      const res = await fetch(`${BASE}/${encodeURIComponent(symbol)}/recalculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [`${BASE}/series`, vars.symbol] });
    },
  });

  const orderMutation = useMutation({
    mutationFn: async ({ orderType, tradeDate, tradePrice, shares }: { orderType: string; tradeDate: string; tradePrice: number; shares: number }) => {
      const res = await fetch(`${BASE}/${encodeURIComponent(activeSymbol!)}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderType, tradeDate, tradePrice, shares }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${BASE}/orders/summary`, activeSymbol] });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`${BASE}/${encodeURIComponent(activeSymbol!)}/orders/${orderId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${BASE}/orders/summary`, activeSymbol] });
    },
  });

  const handleLoad = async () => {
    const sym = inputSymbol.trim().toUpperCase();
    if (!sym) return;
    setLoadError(null);
    try {
      const res = await fetch(`${BASE}/${encodeURIComponent(sym)}/recalculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "incremental" }),
      });
      if (!res.ok) throw new Error(await res.text());
      setActiveSymbol(sym);
      qc.invalidateQueries({ queryKey: [`${BASE}/series`, sym] });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load symbol");
    }
  };

  const handleRecalculate = () => {
    if (!activeSymbol) return;
    recalcMutation.mutate({ symbol: activeSymbol, mode: "incremental" });
  };

  const handleFullRefresh = () => {
    if (!activeSymbol) return;
    recalcMutation.mutate({ symbol: activeSymbol, mode: "full" });
  };

  const handleBuy = (point: PeSeriesPoint) => {
    setTradeType("buy");
    setTradePoint(point);
    setTradeModalOpen(true);
  };

  const handleSell = (point: PeSeriesPoint) => {
    setTradeType("sell");
    setTradePoint(point);
    setTradeModalOpen(true);
  };

  const handleOrderSubmit = async (orderType: "buy" | "sell", tradeDate: string, tradePrice: number, shares: number) => {
    await orderMutation.mutateAsync({ orderType, tradeDate, tradePrice, shares });
  };

  const isRecalcing = recalcMutation.isPending;
  const hasData = seriesData && seriesData.series.length > 0;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">PE Evaluator</h2>
          <p className="text-sm text-muted-foreground mt-0.5">5-year historical P/E analysis with hypothetical trade tracking</p>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label htmlFor="pe-symbol">Ticker Symbol</Label>
            <Input
              id="pe-symbol"
              className="w-36 uppercase"
              placeholder="e.g. AAPL"
              value={inputSymbol}
              onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") handleLoad(); }}
            />
          </div>
          <Button onClick={handleLoad} disabled={!inputSymbol.trim() || recalcMutation.isPending}>
            Load
          </Button>
          {activeSymbol && (
            <Button variant="outline" onClick={handleRecalculate} disabled={isRecalcing}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isRecalcing ? "animate-spin" : ""}`} />
              Recalculate
            </Button>
          )}
          {activeSymbol && (
            <Button variant="ghost" size="sm" onClick={handleFullRefresh} disabled={isRecalcing} title="Wipe stored data and rebuild from scratch" className="text-muted-foreground hover:text-foreground">
              <RotateCcw className={`w-4 h-4 mr-1.5 ${isRecalcing ? "animate-spin" : ""}`} />
              Full Refresh
            </Button>
          )}
          <span className="text-xs text-muted-foreground self-center">5-year window</span>
        </div>

        {loadError && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {recalcMutation.isError && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{(recalcMutation.error as Error)?.message ?? "Recalculation failed"}</span>
          </div>
        )}

        {!activeSymbol && !loadError && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-2">
            <TrendingUp className="w-10 h-10 opacity-30" />
            <p className="text-sm">Enter a ticker symbol and click Load to view 5-year P/E history.</p>
          </div>
        )}

        {activeSymbol && (
          <>
            {seriesLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : seriesData && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border border-border p-4 space-y-0.5">
                  <p className="text-xs text-muted-foreground">Latest Price</p>
                  <p className="text-xl font-semibold">{seriesData.latestPrice != null ? `$${seriesData.latestPrice.toFixed(2)}` : "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-0.5">
                  <p className="text-xs text-muted-foreground">Latest Daily P/E</p>
                  <p className="text-xl font-semibold">{seriesData.latestPe != null ? seriesData.latestPe.toFixed(2) : "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-0.5">
                  <p className="text-xs text-muted-foreground">5-Year Avg P/E</p>
                  <p className="text-xl font-semibold">{seriesData.avgPe5y != null ? seriesData.avgPe5y.toFixed(2) : "—"}</p>
                </div>
              </div>
            )}

            {seriesLoading ? (
              <Skeleton className="h-96 w-full rounded-lg" />
            ) : hasData ? (
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium mb-3">
                  {activeSymbol} — P/E Ratio (5 Years)
                  {recalcMutation.isSuccess && <span className="text-xs text-muted-foreground ml-2">Updated</span>}
                </p>
                <PeChart series={seriesData!.series} netShares={plData?.netShares ?? 0} onBuy={handleBuy} onSell={handleSell} />
                <p className="text-xs text-muted-foreground mt-2">Right-click the chart to record a hypothetical buy or sell at any date.</p>
              </div>
            ) : seriesData && seriesData.series.length === 0 ? (
              <div className="rounded-lg border border-border p-8 text-center text-muted-foreground text-sm">
                No P/E data available for <strong>{activeSymbol}</strong>. This may be an ETF or fund without meaningful EPS-based P/E.
              </div>
            ) : null}

            {plLoading ? (
              <Skeleton className="h-32 rounded-lg" />
            ) : plData && (
              <div className="rounded-lg border border-border p-4 space-y-4">
                <h3 className="text-sm font-semibold">Hypothetical Trades — {activeSymbol}</h3>

                {plData.orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hypothetical trades recorded. Right-click the chart to buy or sell.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Net Shares</p>
                        <p className="font-semibold">{plData.netShares.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Cost</p>
                        <p className="font-semibold">{fmt(plData.avgCostRemaining, 2, "$")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Realized P/L</p>
                        <p className={`font-semibold ${plClass(plData.realizedPlDollar)}`}>
                          {fmt(plData.realizedPlDollar, 2, "$")}
                          {plData.realizedPlPercent != null && <span className="text-xs ml-1">({fmt(plData.realizedPlPercent, 1)}%)</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Unrealized P/L</p>
                        <p className={`font-semibold ${plClass(plData.unrealizedPlDollar)}`}>
                          {fmt(plData.unrealizedPlDollar, 2, "$")}
                          {plData.unrealizedPlPercent != null && <span className="text-xs ml-1">({fmt(plData.unrealizedPlPercent, 1)}%)</span>}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border flex items-center justify-between">
                      <div>
                        <span className="text-xs text-muted-foreground">Total P/L: </span>
                        <span className={`font-bold text-base ${plClass(plData.totalPlDollar)}`}>
                          {fmt(plData.totalPlDollar, 2, "$")}
                          {plData.totalPlPercent != null && <span className="text-sm font-medium ml-1.5">({fmt(plData.totalPlPercent, 1)}%)</span>}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Order Log</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left py-1 pr-3">Type</th>
                              <th className="text-left py-1 pr-3">Date</th>
                              <th className="text-right py-1 pr-3">Price</th>
                              <th className="text-right py-1 pr-3">Shares</th>
                              <th className="text-right py-1 pr-3">Notional</th>
                              <th className="py-1"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {plData.orders.map((o) => (
                              <tr key={o.orderId} className="border-b border-border/50 last:border-0 hover:bg-muted/40">
                                <td className={`py-1 pr-3 font-medium capitalize ${o.orderType === "buy" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{o.orderType}</td>
                                <td className="py-1 pr-3">{new Date(o.tradeDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                                <td className="text-right py-1 pr-3">${o.tradePrice.toFixed(2)}</td>
                                <td className="text-right py-1 pr-3">{o.shares.toLocaleString("en-US", { maximumFractionDigits: 4 })}</td>
                                <td className="text-right py-1 pr-3">${o.notional.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="py-1 text-right">
                                  <button className="text-muted-foreground hover:text-destructive transition-colors" onClick={() => deleteOrderMutation.mutate(o.orderId)} title="Delete order">
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        <PeTradeModal
          symbol={activeSymbol ?? ""}
          orderType={tradeType}
          point={tradePoint}
          netShares={plData?.netShares ?? 0}
          open={tradeModalOpen}
          onClose={() => setTradeModalOpen(false)}
          onSubmit={handleOrderSubmit}
        />
      </main>
    </AppShell>
  );
}
