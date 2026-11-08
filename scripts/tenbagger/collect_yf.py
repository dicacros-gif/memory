"""Ten-bagger tracker: prices and non-SEC fundamentals through yfinance.

Plain HTTP requests to Yahoo from the Actions runner are rate-limited (HTTP
429); yfinance (installed with the terminal collector's openbb-yfinance) uses
a browser-like session that is not. Writes data/tenbagger/yf-cache.json, which
scripts/tenbagger-collect.mjs reads. Every value is what Yahoo reports; a
ticker that fails is simply absent and the Node collector carries its
previous numbers.
"""
from __future__ import annotations

import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf

ROOT = Path(__file__).resolve().parents[2]
UNIVERSE = ROOT / "data" / "tenbagger" / "universe.json"
OUT = ROOT / "data" / "tenbagger" / "yf-cache.json"
DAILY = ROOT / "data" / "tenbagger" / "daily"
SCREEN = ROOT / "data" / "tenbagger" / "screen.json"
# TradingView exchange prefixes (screen.json) -> universe-style exchange codes.
TV_TO_EXCHANGE = {"AMEX": "NYSEAMERICAN", "XETR": "XETRA", "TPEX": "TPEX", "SIX": "SWX", "TWSE": "TWSE", "ASX": "ASX",
                  "NSE": "NSE", "TASE": "TASE", "OMXSTO": "OMXSTO", "SZSE": "SZSE"}
SUFFIX = {"XETRA": ".DE", "ETR": ".DE", "TPEX": ".TWO", "ASX": ".AX", "NSE": ".NS", "TASE": ".TA", "OMXSTO": ".ST", "TYO": ".T",
          "KRX": ".KS", "KOSPI": ".KS", "KOSDAQ": ".KQ", "TSE": ".T", "HKEX": ".HK", "LSE": ".L",
          "TSX": ".TO", "TSXV": ".V", "AMS": ".AS", "SWX": ".SW", "SSE": ".SS", "SZSE": ".SZ", "TWSE": ".TW"}


def symbols_for(ticker: str) -> list[str]:
    exchange, _, code = ticker.partition(":")
    base = f"{code}{SUFFIX.get(exchange.upper(), '')}"
    if base.endswith(".KS"):
        return [base, base[:-3] + ".KQ"]
    if base.endswith(".KQ"):
        return [base, base[:-3] + ".KS"]
    return [base]


def num(value):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(value) or math.isinf(value) else value


def row(frame, *names):
    """Latest and prior annual values of the first row that exists."""
    if frame is None or getattr(frame, "empty", True):
        return None, None, None
    for name in names:
        if name in frame.index:
            series = frame.loc[name].dropna()
            if series.empty:
                continue
            series = series.sort_index(ascending=False)
            latest = num(series.iloc[0])
            prior = num(series.iloc[1]) if len(series) > 1 else None
            return latest, prior, str(series.index[0])[:10]
    return None, None, None


def slug(ticker: str) -> str:
    return ticker.replace(":", "_").replace("/", "-").replace(" ", "")


def write_daily(ticker: str, symbol: str, currency, t) -> bool:
    """Two years of daily closes for the click-through chart (data/tenbagger/daily)."""
    daily = t.history(period="2y", interval="1d", auto_adjust=True)
    if daily is None or daily.empty:
        return False
    points = [[str(index)[:10], round(float(close), 4)] for index, close in daily["Close"].dropna().items() if close > 0]
    if len(points) < 20:
        return False
    DAILY.mkdir(parents=True, exist_ok=True)
    (DAILY / f"{slug(ticker)}.json").write_text(json.dumps({
        "ticker": ticker, "symbol": symbol, "currency": currency, "asOf": points[-1][0],
        "source": "Yahoo Finance daily adjusted close (yfinance)", "sourceUrl": f"https://finance.yahoo.com/quote/{symbol}/history",
        "points": points,
    }, ensure_ascii=False, separators=(",", ":")))
    return True


def collect_daily_only(ticker: str) -> bool:
    for symbol in symbols_for(ticker):
        t = yf.Ticker(symbol)
        try:
            currency = getattr(t.fast_info, "currency", None)
        except Exception:  # noqa: BLE001
            currency = None
        if write_daily(ticker, symbol, currency, t):
            return True
    return False


def extra_tickers(universe: dict) -> list[str]:
    """Holders of startup stakes and the latest screen's names: clickable stocks outside the universe."""
    out = []
    for sector in universe.get("sectors", []):
        for startup in sector.get("startups", []):
            for holder in startup.get("holders", []):
                for part in str(holder.get("holderTicker") or "").split("/"):
                    part = part.strip()
                    if ":" in part:
                        out.append(part)
    try:
        screen = json.loads(SCREEN.read_text())
        for key in ("factorLeaders", "discovery"):
            for row_ in (screen.get(key) or [])[:60]:
                exchange, _, code = str(row_.get("ticker") or "").partition(":")
                if code and exchange != "EURONEXT":  # Euronext does not say which Yahoo venue
                    out.append(f"{TV_TO_EXCHANGE.get(exchange, exchange)}:{code}")
    except Exception:  # noqa: BLE001 - first run has no screen yet
        pass
    return list(dict.fromkeys(out))


def collect(ticker: str) -> dict | None:
    for symbol in symbols_for(ticker):
        t = yf.Ticker(symbol)
        history = t.history(period="max", interval="1mo", auto_adjust=True)
        if history is None or history.empty:
            continue
        series = [{"date": str(index)[:10], "close": round(float(close), 6)}
                  for index, close in history["Close"].dropna().items() if close > 0]
        fast = t.fast_info
        try:
            write_daily(ticker, symbol, getattr(fast, "currency", None), t)
        except Exception:  # noqa: BLE001 - the chart is optional
            pass
        out = {
            "symbol": symbol,
            "series": series,
            "price": num(getattr(fast, "last_price", None)),
            "currency": getattr(fast, "currency", None),
            "marketCap": num(getattr(fast, "market_cap", None)),
        }
        try:
            revenue, revenue_prior, revenue_end = row(t.income_stmt, "Total Revenue", "Operating Revenue")
            fcf, _, _ = row(t.cashflow, "Free Cash Flow")
            ocf, _, _ = row(t.cashflow, "Operating Cash Flow")
            cash, _, cash_end = row(t.balance_sheet, "Cash Cash Equivalents And Short Term Investments", "Cash And Cash Equivalents")
            out["fundamentals"] = {
                "currency": out["currency"],
                "revenueTtm": revenue, "revenueBasis": "fiscal-year" if revenue is not None else None, "revenueEnd": revenue_end,
                "revenueGrowthPct": round((revenue / revenue_prior - 1) * 100, 1) if revenue and revenue_prior and revenue_prior > 0 else None,
                "operatingCashFlowTtm": ocf, "capexTtm": None, "fcfTtm": fcf,
                "cashAndShortTermInvestments": cash, "cashEnd": cash_end,
                "marketCapReported": out["marketCap"],
                "source": "Yahoo Finance annual statements (yfinance)",
                "sourceUrl": f"https://finance.yahoo.com/quote/{symbol}/financials",
            }
        except Exception as error:  # statements are optional; prices still count
            out["fundamentalsError"] = str(error)[:160]
        return out
    return None


def main() -> int:
    universe = json.loads(UNIVERSE.read_text())
    tickers = []
    for sector in universe.get("sectors", []):
        tickers += [c["ticker"] for c in sector.get("publicCompanies", [])]
    tickers += [c["ticker"] for c in universe.get("history", {}).get("cases", [])]
    tickers = list(dict.fromkeys(tickers))
    results, errors = {}, []
    started = time.time()
    deadline = started + 11 * 60
    for ticker in tickers:
        if time.time() > deadline:
            errors.append("time budget reached")
            break
        try:
            row_ = collect(ticker)
            if row_:
                results[ticker] = row_
            else:
                errors.append(f"{ticker}: no price history")
        except Exception as error:
            errors.append(f"{ticker}: {str(error)[:120]}")
        time.sleep(0.4)
    daily_extra = 0
    extra_deadline = time.time() + 4 * 60
    for ticker in extra_tickers(universe):
        if ticker in results or time.time() > extra_deadline:
            continue
        try:
            daily_extra += 1 if collect_daily_only(ticker) else 0
        except Exception as error:  # noqa: BLE001
            errors.append(f"{ticker} daily: {str(error)[:100]}")
        time.sleep(0.3)
    print(json.dumps({"tenbaggerDailyExtra": daily_extra}))
    OUT.write_text(json.dumps({"generatedAt": datetime.now(timezone.utc).isoformat(), "tickers": results, "errors": errors[:200]}, ensure_ascii=False))
    print(json.dumps({"tenbaggerYf": "written", "tickers": len(results), "requested": len(tickers), "errors": len(errors)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
