import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export interface ShillerPeChartPoint {
  date: string;
  buyHoldValue: number;
  strategy2Value: number;
  strategy3Value: number;
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

// Recharts renders every point as a DOM node; for daily backtests spanning
// decades that's tens of thousands of points, so we downsample purely for
// display while the summary table still reflects the full-resolution result.
const MAX_CHART_POINTS = 1500;

export function downsampleForChart(points: ShillerPeChartPoint[]): ShillerPeChartPoint[] {
  if (points.length <= MAX_CHART_POINTS) return points;
  const step = Math.ceil(points.length / MAX_CHART_POINTS);
  const sampled = points.filter((_, i) => i % step === 0);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

export default function ShillerPeStrategyChart({ data }: { data: ShillerPeChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={420}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" minTickGap={40} />
        <YAxis tickFormatter={formatCompactCurrency} width={70} />
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
        <Legend />
        <Line type="monotone" dataKey="buyHoldValue" name="Buy & Hold" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="strategy2Value" name="Valuation-Filtered DCA" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="strategy3Value" name="Valuation + Trend Filtered DCA" stroke="#16a34a" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
