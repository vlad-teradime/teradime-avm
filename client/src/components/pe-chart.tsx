import { useRef, useState, useCallback } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";

export interface PeSeriesPoint {
  tradeDate: string;
  price: number;
  peDaily: number | null;
  avgPe5y: number | null;
}

interface ContextMenu {
  x: number;
  y: number;
  point: PeSeriesPoint;
}

interface PeChartProps {
  series: PeSeriesPoint[];
  netShares: number;
  onBuy: (point: PeSeriesPoint) => void;
  onSell: (point: PeSeriesPoint) => void;
}

function thinSeries(series: PeSeriesPoint[], maxPoints = 1000) {
  if (series.length <= maxPoints) return series;
  const step = Math.ceil(series.length / maxPoints);
  return series.filter((_, i) => i % step === 0 || i === series.length - 1);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function PeChart({ series, netShares, onBuy, onSell }: PeChartProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastActivePayload = useRef<PeSeriesPoint | null>(null);

  const displaySeries = thinSeries(series);

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!lastActivePayload.current) return;
    setContextMenu({ x: e.clientX, y: e.clientY, point: lastActivePayload.current });
  }, []);

  const handleTooltipActive = (data: any) => {
    if (data?.activePayload?.[0]?.payload) {
      lastActivePayload.current = data.activePayload[0].payload;
    }
  };

  const closeMenu = () => setContextMenu(null);

  const avgPe5y = series.find((p) => p.avgPe5y != null)?.avgPe5y ?? null;

  const xTickFormatter = (val: string) => {
    if (!val) return "";
    const d = new Date(val + "T00:00:00");
    if (d.getMonth() === 0) return String(d.getFullYear());
    return "";
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p: PeSeriesPoint = payload[0]?.payload;
    if (!p) return null;
    return (
      <div className="bg-background border border-border rounded-md p-3 shadow-md text-xs space-y-1">
        <div className="font-semibold">{formatDate(p.tradeDate)}</div>
        <div>Price: <span className="font-medium">${p.price?.toFixed(2)}</span></div>
        <div>Daily P/E: <span className="font-medium">{p.peDaily != null ? p.peDaily.toFixed(2) : "—"}</span></div>
        <div>5Y Avg P/E: <span className="font-medium">{p.avgPe5y != null ? p.avgPe5y.toFixed(2) : "—"}</span></div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative select-none" onContextMenu={handleRightClick}>
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={displaySeries} margin={{ top: 8, right: 24, left: 0, bottom: 8 }} onMouseMove={handleTooltipActive}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="tradeDate" tickFormatter={xTickFormatter} tick={{ fontSize: 11 }} tickLine={false} interval="preserveStartEnd" minTickGap={60} />
          <YAxis tickFormatter={(v: number) => v.toFixed(1)} tick={{ fontSize: 11 }} tickLine={false} width={48} domain={["auto", "auto"]} />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(value) => (value === "avgPe5y" ? "5Y Avg P/E" : "Daily P/E")} wrapperStyle={{ fontSize: 12 }} />
          {avgPe5y != null && (
            <ReferenceLine
              y={avgPe5y}
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              label={{ value: `Avg ${avgPe5y.toFixed(1)}`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--primary))" }}
            />
          )}
          <Line type="monotone" dataKey="avgPe5y" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} activeDot={false} name="avgPe5y" connectNulls />
          <Line type="monotone" dataKey="peDaily" stroke="hsl(var(--chart-2))" strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} name="peDaily" connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
          <div className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[120px]" style={{ top: contextMenu.y, left: contextMenu.x }}>
            <div className="px-3 py-1 text-xs text-muted-foreground border-b border-border mb-1">
              {formatDate(contextMenu.point.tradeDate)}<br />
              ${contextMenu.point.price?.toFixed(2)}
            </div>
            <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors" onClick={() => { onBuy(contextMenu.point); closeMenu(); }}>
              Buy
            </button>
            {netShares > 0 && (
              <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors" onClick={() => { onSell(contextMenu.point); closeMenu(); }}>
                Sell
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
