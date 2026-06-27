from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests
import xlrd
import io
import yfinance as yf
import pandas as pd

router = APIRouter()

# Robert Shiller's published "Irrational Exuberance" dataset (monthly S&P
# Composite price + CAPE/P-E10), hosted at shillerdata.com. The download URL
# carries a cache-busting `ver` query param that changes whenever Shiller
# updates the file, but the page itself is stable, so we resolve it at
# request time instead of hardcoding the versioned link.
SHILLER_PAGE_URL = "https://shillerdata.com"


def _resolve_ie_data_url() -> str:
    resp = requests.get(SHILLER_PAGE_URL, timeout=20)
    resp.raise_for_status()
    html = resp.text
    marker = "ie_data.xls"
    # The page mentions "ie_data.xls" descriptively earlier in the text too;
    # the actual download link is the last occurrence, inside an href.
    idx = html.rfind(marker)
    if idx == -1:
        raise RuntimeError("could not locate ie_data.xls link on shillerdata.com")
    start = html.rfind('href="', 0, idx)
    if start == -1:
        raise RuntimeError("could not locate href for ie_data.xls link")
    start += len('href="')
    end = html.find('"', start)
    url = html[start:end]
    if url.startswith("//"):
        url = "https:" + url
    return url


@router.get("/shiller-cape")
def shiller_cape():
    """
    Monthly S&P 500 nominal price + Shiller CAPE (P/E10) ratio, back to 1871.

    Source: Robert Shiller's "Irrational Exuberance" dataset (ie_data.xls),
    Data sheet. Column B is the nominal S&P Composite price, column M is
    CAPE. Rows before ~1881 have CAPE = "NA" (insufficient trailing 10-year
    earnings history) and are skipped.
    """
    try:
        url = _resolve_ie_data_url()
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        book = xlrd.open_workbook(file_contents=resp.content)
        sheet = book.sheet_by_name("Data")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"failed to fetch/parse Shiller dataset: {e}")

    results = []
    for r in range(8, sheet.nrows):
        date_val = sheet.cell_value(r, 0)
        price_val = sheet.cell_value(r, 1)
        cape_val = sheet.cell_value(r, 12)

        if not isinstance(date_val, (int, float)) or date_val == "":
            continue
        if not isinstance(cape_val, (int, float)):
            continue
        if not isinstance(price_val, (int, float)):
            continue

        # Date is encoded as YYYY.MM (e.g. 1871.01, 1871.1 for October).
        year = int(date_val)
        month_frac = round((date_val - year) * 100)
        month = month_frac if month_frac >= 1 else 1
        if month > 12:
            continue
        period_date = f"{year:04d}-{month:02d}-01"

        results.append({
            "periodDate": period_date,
            "sp500Price": float(price_val),
            "shillerPe": float(cape_val),
        })

    return results


class IndexPricesRequest(BaseModel):
    ticker: str
    period: str = "max"


@router.post("/index-daily-prices")
def index_daily_prices(request: IndexPricesRequest):
    """
    Full daily price history for an index ticker (e.g. ^GSPC), used to
    resample the Shiller PE screener to daily/weekly trading frequency.
    yfinance's ^GSPC history starts 1927-12-30.
    """
    symbol = request.ticker.strip().upper()
    try:
        hist = yf.Ticker(symbol).history(period=request.period, auto_adjust=True)
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
            })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
