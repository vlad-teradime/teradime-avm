import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PeSeriesPoint } from "./pe-chart";

interface PeTradeModalProps {
  symbol: string;
  orderType: "buy" | "sell";
  point: PeSeriesPoint | null;
  netShares: number;
  open: boolean;
  onClose: () => void;
  onSubmit: (orderType: "buy" | "sell", tradeDate: string, tradePrice: number, shares: number) => Promise<void>;
}

export default function PeTradeModal({ symbol, orderType, point, netShares, open, onClose, onSubmit }: PeTradeModalProps) {
  const [shares, setShares] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const price = point?.price ?? 0;
  const sharesNum = parseFloat(shares);
  const notional = !isNaN(sharesNum) && sharesNum > 0 ? sharesNum * price : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!point) return;
    if (!sharesNum || sharesNum <= 0) { setError("Enter a positive number of shares"); return; }
    if (orderType === "sell" && sharesNum > netShares) {
      setError(`Cannot sell more than ${netShares} net shares`);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(orderType, point.tradeDate, price, sharesNum);
      setShares("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit order");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) { setShares(""); setError(""); onClose(); }
  };

  const label = orderType === "buy" ? "Buy" : "Sell";
  const dateStr = point ? new Date(point.tradeDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{label} {symbol}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Date</span>
              <p className="font-medium mt-0.5">{dateStr}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Price</span>
              <p className="font-medium mt-0.5">${price.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pe-shares">Shares</Label>
            <Input
              id="pe-shares"
              type="number"
              min="0.0001"
              max={orderType === "sell" ? netShares : undefined}
              step="any"
              placeholder="e.g. 100"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              autoFocus
            />
            {orderType === "sell" && (
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShares(String(netShares))}>
                Max: {netShares} shares
              </button>
            )}
          </div>

          {notional != null && (
            <p className="text-sm text-muted-foreground">
              Notional: <span className="font-medium text-foreground">${notional.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : `${label} ${sharesNum > 0 && !isNaN(sharesNum) ? sharesNum : ""} shares`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
