from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yfinance as yf
import pandas as pd

router = APIRouter()


class PeRequest(BaseModel):
    ticker: str


@router.post("/pe-prices")
def pe_prices(request: PeRequest):
    """5 years of daily adjusted close prices for PE Evaluator."""
    symbol = request.ticker.strip().upper()
    try:
        t = yf.Ticker(symbol)
        # auto_adjust=True means Close is already split/dividend adjusted
        hist = t.history(period="5y", auto_adjust=True)
        if hist.empty:
            return []
        results = []
        for idx, row in hist.iterrows():
            close = row.get("Close")
            if close is None or pd.isna(close):
                continue
            results.append({
                "tradeDate": idx.strftime("%Y-%m-%d"),
                "close": float(close),
                "adjustedClose": float(close),
            })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pe-quarterly-eps")
def pe_quarterly_eps(request: PeRequest):
    """
    Quarterly EPS history for PE Evaluator TTM calculation.

    Returns list of { fiscalPeriodEnd, availableDate, dilutedEps }.

    Source strategy (lower sources fill gaps left by higher ones):
    1. annual income_stmt  — 4 fiscal years always available; each year's diluted
       EPS is split evenly into 4 quarterly estimates, providing ~16 data points
       that cover the full 5-year window.  These are approximations but give the
       right long-run trend.
    2. quarterly_income_stmt — last 4 actual quarters; overwrites the annual
       estimates for the recent period with precise per-quarter values.
    3. earnings_history — announcement-date indexed actuals; overwrites anything
       older for dates where Yahoo has real earnings call data.
    """
    symbol = request.ticker.strip().upper()
    # keyed by date string; higher-priority sources overwrite lower ones
    seen: dict[str, dict] = {}

    try:
        t = yf.Ticker(symbol)

        # ── 1. Annual income statement → quarterly approximations ──────────
        # yfinance returns 4 fiscal years.  Splitting annual diluted EPS by 4
        # gives approximate per-quarter values for older history.
        try:
            annual = t.income_stmt
            if annual is not None and not annual.empty:
                for row_name in ["Diluted EPS", "Basic EPS"]:
                    if row_name in annual.index:
                        series = annual.loc[row_name].dropna()
                        for fy_end_raw, annual_eps in series.items():
                            quarterly_eps = float(annual_eps) / 4.0
                            fy_end = (
                                fy_end_raw
                                if hasattr(fy_end_raw, "strftime")
                                else pd.Timestamp(fy_end_raw)
                            )
                            # Backfill 4 quarters ending at fy_end
                            for q in range(4):
                                q_end = fy_end - pd.DateOffset(months=3 * q)
                                q_str = q_end.strftime("%Y-%m-%d")
                                seen[q_str] = {
                                    "fiscalPeriodEnd": q_str,
                                    "availableDate": q_str,
                                    "dilutedEps": quarterly_eps,
                                }
                        break
        except Exception:
            pass

        # ── 2. Quarterly income statement → precise recent quarters ────────
        try:
            stmt = t.quarterly_income_stmt
            if stmt is not None and not stmt.empty:
                for row_name in ["Diluted EPS", "Basic EPS"]:
                    if row_name in stmt.index:
                        series = stmt.loc[row_name].dropna()
                        for date_col, eps_val in series.items():
                            date_str = (
                                date_col.strftime("%Y-%m-%d")
                                if hasattr(date_col, "strftime")
                                else str(date_col)[:10]
                            )
                            seen[date_str] = {
                                "fiscalPeriodEnd": date_str,
                                "availableDate": date_str,
                                "dilutedEps": float(eps_val),
                            }
                        break
        except Exception:
            pass

        # ── 3. Earnings history → actual announcement-date EPS ─────────────
        try:
            hist = t.earnings_history
            if hist is not None and not hist.empty and "epsActual" in hist.columns:
                for idx, row in hist.iterrows():
                    if pd.notna(row["epsActual"]):
                        date_str = (
                            idx.strftime("%Y-%m-%d")
                            if hasattr(idx, "strftime")
                            else str(idx)[:10]
                        )
                        seen[date_str] = {
                            "fiscalPeriodEnd": date_str,
                            "availableDate": date_str,
                            "dilutedEps": float(row["epsActual"]),
                        }
        except Exception:
            pass

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return sorted(seen.values(), key=lambda x: x["fiscalPeriodEnd"])
