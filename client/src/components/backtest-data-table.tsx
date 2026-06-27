import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Maximize2, SlidersHorizontal } from "lucide-react";

export type Signal = "buy" | "hold";
export type SellSignal = "buy" | "hold" | "sell";

export interface BacktestSeriesPoint {
  date: string;
  shillerPe: number;
  rollingMean: number;
  rollingStdDev: number;
  price: number;
  trendMa: number | null;
  buyHold: { shares: number; invested: number; marketValue: number };
  strategy2: { signal: Signal; shares: number; cash: number; marketValue: number };
  strategy3: { signal: Signal; sellSignal: SellSignal; shares: number; cash: number; marketValue: number };
}

interface Row extends BacktestSeriesPoint {
  bhProfitLoss: number;
  s2Additional: number;
  s3Additional: number;
}

type GroupId = "market" | "buyHold" | "strategy2" | "strategy3";

const GROUP_LABELS: Record<GroupId, string> = {
  market: "Market Data",
  buyHold: "Buy & Hold",
  strategy2: "Valuation-Filtered DCA",
  strategy3: "Valuation + Trend Filtered DCA",
};
const GROUP_ORDER: GroupId[] = ["market", "buyHold", "strategy2", "strategy3"];

// Opaque, theme-fixed palette colors (not the app's semantic /<alpha-value>
// tokens) so each strategy's columns stay visually identified — with a solid,
// non-translucent fill — across both sticky header rows and every body row,
// independent of scroll position or which columns are currently hidden.
const GROUP_HEADER_BG: Record<GroupId, string> = {
  market: "bg-slate-200 dark:bg-slate-800",
  buyHold: "bg-zinc-200 dark:bg-zinc-800",
  strategy2: "bg-blue-100 dark:bg-blue-950",
  strategy3: "bg-emerald-100 dark:bg-emerald-950",
};
const GROUP_BODY_TINT: Record<GroupId, string> = {
  market: "",
  buyHold: "bg-zinc-500/5",
  strategy2: "bg-blue-500/5",
  strategy3: "bg-emerald-500/5",
};

interface ColumnDef {
  id: string;
  group: GroupId;
  label: string;
  align: "left" | "right";
  display: (row: Row) => string;
  // Shorter rendering used in the full-screen popup, where every column has
  // to fit on screen at once without a horizontal scrollbar.
  displayCompact?: (row: Row) => string;
  csv: (row: Row) => string | number;
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function fmtCurrencyCompact(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const COLUMNS: ColumnDef[] = [
  { id: "date", group: "market", label: "Date", align: "left", display: (r) => r.date, csv: (r) => r.date },
  { id: "shillerPe", group: "market", label: "Shiller PE", align: "right", display: (r) => r.shillerPe.toFixed(2), csv: (r) => r.shillerPe.toFixed(2) },
  { id: "rollingMean", group: "market", label: "Mean of Shiller PE", align: "right", display: (r) => r.rollingMean.toFixed(2), csv: (r) => r.rollingMean.toFixed(2) },
  { id: "rollingStdDev", group: "market", label: "Std Dev of Shiller PE", align: "right", display: (r) => r.rollingStdDev.toFixed(2), csv: (r) => r.rollingStdDev.toFixed(2) },
  { id: "price", group: "market", label: "Price", align: "right", display: (r) => fmtCurrency(r.price), displayCompact: (r) => fmtCurrencyCompact(r.price), csv: (r) => r.price.toFixed(2) },
  { id: "trendMa", group: "market", label: "Trend MA", align: "right", display: (r) => (r.trendMa == null ? "—" : fmtCurrency(r.trendMa)), displayCompact: (r) => (r.trendMa == null ? "—" : fmtCurrencyCompact(r.trendMa)), csv: (r) => (r.trendMa == null ? "" : r.trendMa.toFixed(2)) },

  { id: "bhShares", group: "buyHold", label: "# of Shares Invested", align: "right", display: (r) => r.buyHold.shares.toFixed(3), displayCompact: (r) => r.buyHold.shares.toFixed(1), csv: (r) => r.buyHold.shares.toFixed(6) },
  { id: "bhInvested", group: "buyHold", label: "Invested Amount", align: "right", display: (r) => fmtCurrency(r.buyHold.invested), displayCompact: (r) => fmtCurrencyCompact(r.buyHold.invested), csv: (r) => r.buyHold.invested.toFixed(2) },
  { id: "bhMarketValue", group: "buyHold", label: "Market Value", align: "right", display: (r) => fmtCurrency(r.buyHold.marketValue), displayCompact: (r) => fmtCurrencyCompact(r.buyHold.marketValue), csv: (r) => r.buyHold.marketValue.toFixed(2) },
  { id: "bhProfitLoss", group: "buyHold", label: "Profit/Loss", align: "right", display: (r) => fmtCurrency(r.bhProfitLoss), displayCompact: (r) => fmtCurrencyCompact(r.bhProfitLoss), csv: (r) => r.bhProfitLoss.toFixed(2) },

  { id: "s2Signal", group: "strategy2", label: "Signal", align: "left", display: (r) => capitalize(r.strategy2.signal), csv: (r) => r.strategy2.signal },
  { id: "s2Shares", group: "strategy2", label: "# of Shares Invested", align: "right", display: (r) => r.strategy2.shares.toFixed(3), displayCompact: (r) => r.strategy2.shares.toFixed(1), csv: (r) => r.strategy2.shares.toFixed(6) },
  { id: "s2Cash", group: "strategy2", label: "Cash", align: "right", display: (r) => fmtCurrency(r.strategy2.cash), displayCompact: (r) => fmtCurrencyCompact(r.strategy2.cash), csv: (r) => r.strategy2.cash.toFixed(2) },
  { id: "s2Additional", group: "strategy2", label: "Additional Shares Bought", align: "right", display: (r) => (r.s2Additional > 0 ? r.s2Additional.toFixed(3) : "—"), displayCompact: (r) => (r.s2Additional > 0 ? r.s2Additional.toFixed(1) : "—"), csv: (r) => r.s2Additional.toFixed(6) },
  { id: "s2MarketValue", group: "strategy2", label: "Market Value", align: "right", display: (r) => fmtCurrency(r.strategy2.marketValue), displayCompact: (r) => fmtCurrencyCompact(r.strategy2.marketValue), csv: (r) => r.strategy2.marketValue.toFixed(2) },

  { id: "s3Signal", group: "strategy3", label: "Signal", align: "left", display: (r) => capitalize(r.strategy3.signal), csv: (r) => r.strategy3.signal },
  { id: "s3SellSignal", group: "strategy3", label: "Sell Signal", align: "left", display: (r) => capitalize(r.strategy3.sellSignal), csv: (r) => r.strategy3.sellSignal },
  { id: "s3Shares", group: "strategy3", label: "# of Shares Invested", align: "right", display: (r) => r.strategy3.shares.toFixed(3), displayCompact: (r) => r.strategy3.shares.toFixed(1), csv: (r) => r.strategy3.shares.toFixed(6) },
  { id: "s3Cash", group: "strategy3", label: "Cash", align: "right", display: (r) => fmtCurrency(r.strategy3.cash), displayCompact: (r) => fmtCurrencyCompact(r.strategy3.cash), csv: (r) => r.strategy3.cash.toFixed(2) },
  { id: "s3Additional", group: "strategy3", label: "Additional Shares Bought", align: "right", display: (r) => (r.s3Additional > 0 ? r.s3Additional.toFixed(3) : "—"), displayCompact: (r) => (r.s3Additional > 0 ? r.s3Additional.toFixed(1) : "—"), csv: (r) => r.s3Additional.toFixed(6) },
  { id: "s3MarketValue", group: "strategy3", label: "Market Value", align: "right", display: (r) => fmtCurrency(r.strategy3.marketValue), displayCompact: (r) => fmtCurrencyCompact(r.strategy3.marketValue), csv: (r) => r.strategy3.marketValue.toFixed(2) },
];

function buildRows(series: BacktestSeriesPoint[], contributionAmount: number): Row[] {
  const rows: Row[] = [];
  let prevS2Shares = 0;
  let prevS3Shares = 0;
  for (const p of series) {
    const baseShares = p.price > 0 ? contributionAmount / p.price : 0;

    let s2Additional = 0;
    if (p.strategy2.signal === "buy") {
      s2Additional = Math.max(0, p.strategy2.shares - prevS2Shares - baseShares);
    }

    let s3Additional = 0;
    if (p.strategy3.sellSignal !== "sell" && p.strategy3.signal === "buy") {
      s3Additional = Math.max(0, p.strategy3.shares - prevS3Shares - baseShares);
    }

    rows.push({ ...p, bhProfitLoss: p.buyHold.marketValue - p.buyHold.invested, s2Additional, s3Additional });

    prevS2Shares = p.strategy2.shares;
    prevS3Shares = p.strategy3.shares;
  }
  return rows;
}

function csvHeaderFor(col: ColumnDef) {
  return col.group === "market" ? col.label : `${GROUP_LABELS[col.group]} ${col.label}`;
}

function escapeCsvCell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(columns: ColumnDef[], rows: Row[]) {
  const header = columns.map(csvHeaderFor);
  const lines = [header, ...rows.map((r) => columns.map((c) => c.csv(r)))];
  const csv = lines.map((line) => line.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shiller-pe-backtest-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function cellContent(c: ColumnDef, r: Row, compact: boolean) {
  const text = compact && c.displayCompact ? c.displayCompact(r) : c.display(r);
  if ((c.id === "s2Signal" && r.strategy2.signal === "buy") || (c.id === "s3Signal" && r.strategy3.signal === "buy")) {
    return <span className="text-green-600 dark:text-green-400 font-medium">{text}</span>;
  }
  if (c.id === "s3SellSignal" && r.strategy3.sellSignal === "sell") {
    return <span className="text-red-600 dark:text-red-400 font-medium">{text}</span>;
  }
  return text;
}

function DataGrid({
  visibleColumns,
  rows,
  compact = false,
  maxHeight = "32rem",
}: {
  visibleColumns: ColumnDef[];
  rows: Row[];
  compact?: boolean;
  maxHeight?: string;
}) {
  const [groupRowHeight, setGroupRowHeight] = useState(36);
  const groupRowRef = useRef<HTMLTableRowElement>(null);

  // Measure the actual rendered height of the group-header row rather than
  // assuming a fixed value, so the column-header row's sticky offset never
  // drifts out of sync with it (a mismatch there is what let body rows show
  // through behind the headers on scroll).
  useLayoutEffect(() => {
    if (!groupRowRef.current) return;
    const update = () => setGroupRowHeight(groupRowRef.current?.getBoundingClientRect().height ?? 36);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(groupRowRef.current);
    return () => observer.disconnect();
  }, [compact]);

  const visibleGroups = useMemo(
    () =>
      GROUP_ORDER.map((g) => ({ id: g, count: visibleColumns.filter((c) => c.group === g).length })).filter((g) => g.count > 0),
    [visibleColumns],
  );

  const headerHeight = compact ? "h-7" : "h-9";
  const headerPad = compact ? "px-1.5" : "px-2";
  const cellPad = compact ? "px-1.5 py-1" : "px-2 py-1.5";
  const textSize = compact ? "text-xs" : "text-sm";
  // In the popup, headers are allowed to wrap onto two lines so columns can
  // be narrower than their label, which is what lets every column fit on
  // screen at once without a horizontal scrollbar.
  const headerWrap = compact ? "leading-tight" : "whitespace-nowrap";

  return (
    <div className="overflow-auto border border-border/50 rounded-md" style={{ maxHeight, height: compact ? maxHeight : undefined }}>
      <table className={`w-full ${textSize} border-collapse`}>
        <thead>
          <tr ref={groupRowRef}>
            {visibleGroups.map((g, gi) => (
              <th
                key={g.id}
                colSpan={g.count}
                className={`sticky top-0 z-20 ${headerHeight} ${GROUP_HEADER_BG[g.id]} text-center text-xs font-semibold border-b border-border whitespace-nowrap ${headerPad} ${gi > 0 ? "border-l-2 border-l-border" : ""}`}
              >
                {GROUP_LABELS[g.id]}
              </th>
            ))}
          </tr>
          <tr>
            {visibleColumns.map((c, i) => {
              const isGroupStart = i === 0 || visibleColumns[i - 1].group !== c.group;
              return (
                <th
                  key={c.id}
                  style={{ top: groupRowHeight }}
                  className={`sticky z-10 ${GROUP_HEADER_BG[c.group]} text-muted-foreground font-medium border-b border-border ${headerWrap} ${headerPad} py-1 ${c.align === "left" ? "text-left" : "text-right"} ${isGroupStart ? "border-l-2 border-l-border" : ""}`}
                >
                  {c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.date}-${i}`} className="border-b border-border/30 odd:bg-muted/20">
              {visibleColumns.map((c, ci) => {
                const isGroupStart = ci === 0 || visibleColumns[ci - 1].group !== c.group;
                return (
                  <td
                    key={c.id}
                    className={`${cellPad} whitespace-nowrap ${GROUP_BODY_TINT[c.group]} ${c.align === "left" ? "text-left" : "text-right"} ${isGroupStart ? "border-l-2 border-l-border" : ""}`}
                  >
                    {cellContent(c, r, compact)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BacktestDataTable({ series, contributionAmount }: { series: BacktestSeriesPoint[]; contributionAmount: number }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);

  const rows = useMemo(() => buildRows(series, contributionAmount), [series, contributionAmount]);
  const visibleColumns = useMemo(() => COLUMNS.filter((c) => !hiddenIds.has(c.id)), [hiddenIds]);

  function toggleColumn(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const columnsButton = (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setColumnsPanelOpen((o) => !o)}>
        <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
        Columns
      </Button>
      {columnsPanelOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setColumnsPanelOpen(false)} />
          <div className="absolute right-0 mt-1 z-[70] w-72 max-h-96 overflow-y-auto rounded-md border border-border bg-popover p-3 shadow-lg space-y-3">
            {GROUP_ORDER.map((g) => (
              <div key={g}>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{GROUP_LABELS[g]}</p>
                <div className="space-y-1">
                  {COLUMNS.filter((c) => c.group === g).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={!hiddenIds.has(c.id)} onChange={() => toggleColumn(c.id)} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const downloadButton = (
    <Button size="sm" variant="outline" onClick={() => downloadCsv(visibleColumns, rows)}>
      <Download className="w-3.5 h-3.5 mr-1.5" />
      Download CSV
    </Button>
  );

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Full Backtest Data</h3>
        <div className="flex items-center gap-2">
          {columnsButton}
          <Button size="sm" variant="outline" onClick={() => setExpandOpen(true)}>
            <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
            Expand
          </Button>
          {downloadButton}
        </div>
      </div>

      <DataGrid visibleColumns={visibleColumns} rows={rows} />

      <p className="text-xs text-muted-foreground">
        {rows.length.toLocaleString()} periods. Use Columns to show/hide fields, Expand to see every column at once, or Download CSV to export the table as-shown to a spreadsheet.
      </p>

      <Dialog open={expandOpen} onOpenChange={setExpandOpen}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[92vh] sm:max-w-[98vw] top-[4vh] translate-y-0 flex flex-col gap-3 p-4">
          <DialogHeader className="flex-row items-center justify-between space-y-0 pr-8">
            <DialogTitle>Full Backtest Data</DialogTitle>
            <div className="flex items-center gap-2">
              {columnsButton}
              {downloadButton}
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <DataGrid visibleColumns={visibleColumns} rows={rows} compact maxHeight="100%" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
