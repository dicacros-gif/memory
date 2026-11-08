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
BARS = ROOT / "data" / "tenbagger" / "bars"
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


def sig(value, digits=6):
    value = num(value)
    return None if value is None else float(f"{value:.{digits}g}")


def earnings_dates(t) -> list[str]:
    try:
        frame = t.get_earnings_dates(limit=16)
        if frame is None or frame.empty:
            return []
        return sorted({str(index)[:10] for index in frame.index})
    except Exception:  # noqa: BLE001 - optional marker source
        return []


def write_bars(ticker: str, symbol: str, currency, t) -> bool:
    """Five years of daily adjusted OHLCV, columnar, for the detail chart (data/tenbagger/bars)."""
    daily = t.history(period="5y", interval="1d", auto_adjust=True)
    if daily is None or daily.empty:
        return False
    daily = daily.dropna(subset=["Close"])
    daily = daily[daily["Close"] > 0]
    if len(daily) < 20:
        return False
    BARS.mkdir(parents=True, exist_ok=True)
    payload = {
        "ticker": ticker, "symbol": symbol, "currency": currency, "asOf": str(daily.index[-1])[:10],
        "source": "Yahoo Finance daily bars, split/dividend adjusted (yfinance)",
        "sourceUrl": f"https://finance.yahoo.com/quote/{symbol}/history",
        "t": [str(index)[:10] for index in daily.index],
        "o": [sig(v) for v in daily["Open"]], "h": [sig(v) for v in daily["High"]],
        "l": [sig(v) for v in daily["Low"]], "c": [sig(v) for v in daily["Close"]],
        "v": [int(v) if num(v) is not None else None for v in daily["Volume"]],
        "events": {"earnings": earnings_dates(t)},
    }
    (BARS / f"{slug(ticker)}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    tail = daily.tail(20)
    dollar = [num(c) * num(v) for c, v in zip(tail["Close"], tail["Volume"]) if num(c) is not None and num(v) is not None]
    return {"avgTradedValue20d": round(sum(dollar) / len(dollar)) if dollar else None}


def collect_bars_only(ticker: str) -> bool:
    for symbol in symbols_for(ticker):
        t = yf.Ticker(symbol)
        try:
            currency = getattr(t.fast_info, "currency", None)
        except Exception:  # noqa: BLE001
            currency = None
        if write_bars(ticker, symbol, currency, t):
            return True
    return False  # noqa: RET


def holder_tickers(universe: dict) -> list[str]:
    out = []
    for sector in universe.get("sectors", []):
        for startup in sector.get("startups", []):
            for holder in startup.get("holders", []):
                for part in str(holder.get("holderTicker") or "").split("/"):
                    part = part.strip()
                    if ":" in part:
                        out.append(part)
    return list(dict.fromkeys(out))


def screen_tickers() -> list[str]:
    """The latest screen's names: clickable stocks outside the universe (bars only)."""
    out = []
    try:
        screen = json.loads(SCREEN.read_text())
        for key in ("factorLeaders", "discovery"):
            for row_ in (screen.get(key) or [])[:40]:
                exchange, _, code = str(row_.get("ticker") or "").partition(":")
                if code and exchange != "EURONEXT":  # Euronext does not say which Yahoo venue
                    out.append(f"{TV_TO_EXCHANGE.get(exchange, exchange)}:{code}")
    except Exception:  # noqa: BLE001 - first run has no screen yet
        pass
    return list(dict.fromkeys(out))


def info_of(t) -> dict:
    try:
        return t.info or {}
    except Exception:  # noqa: BLE001
        return {}


def valuation(info: dict) -> dict | None:
    """Multiples as Yahoo reports them. Forward P/E uses analysts' next-fiscal-year EPS;
    PEG is Yahoo's (P/E ÷ expected EPS growth). Kept apart from filed statements."""
    out = {
        "forwardPE": num(info.get("forwardPE")), "trailingPE": num(info.get("trailingPE")),
        "peg": num(info.get("trailingPegRatio")) if num(info.get("trailingPegRatio")) is not None else num(info.get("pegRatio")),
        "forwardEps": num(info.get("forwardEps")), "trailingEps": num(info.get("trailingEps")),
        "evToRevenue": num(info.get("enterpriseToRevenue")), "evToEbitda": num(info.get("enterpriseToEbitda")),
        "earningsGrowthPct": round(num(info.get("earningsGrowth")) * 100, 1) if num(info.get("earningsGrowth")) is not None else None,
        "analysts": info.get("numberOfAnalystOpinions"),
        "source": "Yahoo Finance (analyst consensus and reported multiples)",
    }
    # Negative or absurd multiples carry no information as a ratio.
    for key in ("forwardPE", "trailingPE", "peg", "evToRevenue", "evToEbitda"):
        if out[key] is not None and (out[key] <= 0 or out[key] > 2000):
            out[key] = None
    return out if any(out[k] is not None for k in ("forwardPE", "trailingPE", "peg", "evToRevenue")) else None


def next_earnings(dates: list[str]) -> str | None:
    today = datetime.now(timezone.utc).date().isoformat()
    future = [d for d in dates if d >= today]
    return min(future) if future else None


def short_interest(t, info: dict | None = None) -> dict | None:
    """Exchange-reported short interest as Yahoo shows it (US listings, twice monthly)."""
    info = info if info is not None else info_of(t)
    if not info:
        return None
    pct = num(info.get("shortPercentOfFloat"))
    shares = num(info.get("sharesShort"))
    if pct is None and shares is None:
        return None
    prior = num(info.get("sharesShortPriorMonth"))
    stamp = info.get("dateShortInterest")
    return {
        "pctFloat": round(pct * 100, 2) if pct is not None else None,
        "shares": shares, "priorMonthShares": prior,
        "changePct": round((shares / prior - 1) * 100, 1) if shares and prior else None,
        "date": datetime.fromtimestamp(stamp, timezone.utc).date().isoformat() if isinstance(stamp, (int, float)) else None,
        "source": "Yahoo Finance (exchange short interest)",
    }


def quarters(t) -> list[dict]:
    """Last eight quarters of revenue and free cash flow as Yahoo reports them."""
    out = {}
    try:
        inc = t.quarterly_income_stmt
        for name in ("Total Revenue", "Operating Revenue"):
            if inc is not None and not inc.empty and name in inc.index:
                for index, value in inc.loc[name].dropna().items():
                    out.setdefault(str(index)[:10], {})["revenue"] = num(value)
                break
        cf = t.quarterly_cashflow
        if cf is not None and not cf.empty and "Free Cash Flow" in cf.index:
            for index, value in cf.loc["Free Cash Flow"].dropna().items():
                out.setdefault(str(index)[:10], {})["fcf"] = num(value)
    except Exception:  # noqa: BLE001
        return []
    return [{"end": k, **v} for k, v in sorted(out.items())][-8:]


def collect(ticker: str) -> dict | None:
    for symbol in symbols_for(ticker):
        t = yf.Ticker(symbol)
        history = t.history(period="max", interval="1mo", auto_adjust=True)
        if history is None or history.empty:
            continue
        series = [{"date": str(index)[:10], "close": round(float(close), 6)}
                  for index, close in history["Close"].dropna().items() if close > 0]
        fast = t.fast_info
        info = info_of(t)
        liquidity = None
        try:
            liquidity = write_bars(ticker, symbol, getattr(fast, "currency", None), t)
        except Exception:  # noqa: BLE001 - the chart is optional
            pass
        out = {
            "symbol": symbol,
            "series": series,
            "price": num(getattr(fast, "last_price", None)),
            "currency": getattr(fast, "currency", None),
            "marketCap": num(getattr(fast, "market_cap", None)),
            # Average daily traded value over 20 sessions, in the listing currency.
            "avgTradedValue20d": (liquidity or {}).get("avgTradedValue20d"),
            "shortInterest": short_interest(t, info) if symbol.isalpha() or "-" in symbol else None,
            "valuation": valuation(info),
            "nextEarnings": next_earnings(earnings_dates(t)),
        }
        try:
            revenue, revenue_prior, revenue_end = row(t.income_stmt, "Total Revenue", "Operating Revenue")
            fcf, _, _ = row(t.cashflow, "Free Cash Flow")
            ocf, _, _ = row(t.cashflow, "Operating Cash Flow")
            cash, _, cash_end = row(t.balance_sheet, "Cash Cash Equivalents And Short Term Investments", "Cash And Cash Equivalents")
            cash_only, _, _ = row(t.balance_sheet, "Cash And Cash Equivalents")
            sti, _, _ = row(t.balance_sheet, "Other Short Term Investments")
            debt, _, _ = row(t.balance_sheet, "Total Debt")
            gross, _, _ = row(t.income_stmt, "Gross Profit")
            op_inc, _, _ = row(t.income_stmt, "Operating Income")
            out["fundamentals"] = {
                "currency": out["currency"],
                "revenueTtm": revenue, "revenueBasis": "fiscal-year" if revenue is not None else None, "revenueEnd": revenue_end,
                "revenueGrowthPct": round((revenue / revenue_prior - 1) * 100, 1) if revenue and revenue_prior and revenue_prior > 0 else None,
                "operatingCashFlowTtm": ocf, "capexTtm": None, "fcfTtm": fcf,
                "cashAndShortTermInvestments": cash, "cashEnd": cash_end,
                "cashOnly": cash_only, "shortTermInvestments": sti, "debt": debt, "fcfEnd": revenue_end,
                "grossMarginPct": round(gross / revenue * 100, 1) if gross is not None and revenue else None,
                "operatingMarginPct": round(op_inc / revenue * 100, 1) if op_inc is not None and revenue else None,
                "marketCapReported": out["marketCap"],
                "quarters": quarters(t),
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
    # Listed holders of startup stakes get prices and statements too: they are
    # the second path into each industry.
    tickers += holder_tickers(universe)
    tickers = list(dict.fromkeys(tickers))
    results, errors = {}, []
    deadline = time.time() + 13 * 60
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
        except Exception as error:  # noqa: BLE001
            errors.append(f"{ticker}: {str(error)[:120]}")
        time.sleep(0.35)
    extra, extra_deadline = 0, time.time() + 3 * 60
    for ticker in screen_tickers():
        if ticker in results or time.time() > extra_deadline:
            continue
        try:
            extra += 1 if collect_bars_only(ticker) else 0
        except Exception as error:  # noqa: BLE001
            errors.append(f"{ticker} bars: {str(error)[:100]}")
        time.sleep(0.3)
    OUT.write_text(json.dumps({"generatedAt": datetime.now(timezone.utc).isoformat(), "tickers": results, "errors": errors[:200]}, ensure_ascii=False))
    print(json.dumps({"tenbaggerYf": "written", "tickers": len(results), "requested": len(tickers), "barsOnly": extra, "errors": len(errors)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
