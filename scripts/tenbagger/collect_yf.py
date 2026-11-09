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
import threading
import time
from concurrent.futures import ThreadPoolExecutor
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


def _earnings_frame(t):
    """Yahoo earnings dates with estimate/actual EPS, fetched once per ticker object."""
    if not hasattr(t, "_tb_earnings"):
        try:
            t._tb_earnings = t.get_earnings_dates(limit=16)
        except Exception:  # noqa: BLE001
            t._tb_earnings = None
    return t._tb_earnings


def earnings_dates(t) -> list[str]:
    try:
        frame = _earnings_frame(t)
        if frame is None or frame.empty:
            return []
        return sorted({str(index)[:10] for index in frame.index})
    except Exception:  # noqa: BLE001 - optional marker source
        return []


def earnings_surprises(t) -> dict | None:
    """Last four reported quarters: how many beat the EPS consensus, and the mean surprise %."""
    try:
        frame = _earnings_frame(t)
        if frame is None or frame.empty or "Reported EPS" not in frame.columns or "EPS Estimate" not in frame.columns:
            return None
        rows = frame.dropna(subset=["Reported EPS", "EPS Estimate"]).sort_index(ascending=False).head(4)
        if len(rows) < 2:
            return None
        beats = int(sum(1 for _, r in rows.iterrows() if float(r["Reported EPS"]) > float(r["EPS Estimate"])))
        surprises = [num(r.get("Surprise(%)")) for _, r in rows.iterrows()]
        surprises = [s for s in surprises if s is not None and abs(s) < 1000]
        return {"quarters": len(rows), "beats": beats,
                "meanSurprisePct": round(sum(surprises) / len(surprises), 1) if surprises else None,
                "latest": str(rows.index[0])[:10]}
    except Exception:  # noqa: BLE001
        return None


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
    pct = lambda key: round(num(info.get(key)) * 100, 1) if num(info.get(key)) is not None else None  # noqa: E731
    out.update({
        # quality and profitability (trailing twelve months, Yahoo)
        "roePct": pct("returnOnEquity"), "roaPct": pct("returnOnAssets"),
        "profitMarginPct": pct("profitMargins"), "grossMarginPct": pct("grossMargins"), "operatingMarginPct": pct("operatingMargins"),
        "revenueGrowthQoqYoyPct": pct("revenueGrowth"), "earningsGrowthQoqYoyPct": pct("earningsQuarterlyGrowth"),
        # balance sheet and risk
        "debtToEquity": num(info.get("debtToEquity")), "currentRatio": num(info.get("currentRatio")), "beta": num(info.get("beta")),
        # ownership
        "insiderPct": pct("heldPercentInsiders"), "institutionPct": pct("heldPercentInstitutions"),
        # analysts
        "recommendationMean": num(info.get("recommendationMean")), "recommendationKey": info.get("recommendationKey"),
        "targetMean": num(info.get("targetMeanPrice")), "targetHigh": num(info.get("targetHighPrice")), "targetLow": num(info.get("targetLowPrice")),
        "change52wPct": pct("52WeekChange"),
        # balance-sheet totals (most recent quarter, Yahoo) — used only to cross-check filed figures
        "totalCash": num(info.get("totalCash")), "totalDebt": num(info.get("totalDebt")),
        "financialCurrency": info.get("financialCurrency"), "sector": info.get("sector"),
    })
    # Negative or absurd multiples carry no information as a ratio.
    for key in ("forwardPE", "trailingPE", "peg", "evToRevenue", "evToEbitda"):
        if out[key] is not None and (out[key] <= 0 or out[key] > 2000):
            out[key] = None
    return out if any(v is not None for k, v in out.items() if k != "source") else None


def next_earnings(dates: list[str], t=None) -> str | None:
    """Next scheduled report: the earnings-dates list first, then Yahoo's calendar."""
    today = datetime.now(timezone.utc).date().isoformat()
    future = [d for d in dates if d >= today]
    if not future and t is not None:
        try:
            cal = t.calendar or {}
            raw = cal.get("Earnings Date") if isinstance(cal, dict) else None
            for d in (raw if isinstance(raw, (list, tuple)) else [raw]):
                if d is not None and str(d)[:10] >= today:
                    future.append(str(d)[:10])
        except Exception:  # noqa: BLE001
            pass
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


def _cell(frame, period: str, column: str):
    try:
        if frame is None or getattr(frame, "empty", True) or period not in frame.index or column not in frame.columns:
            return None
        return num(frame.loc[period, column])
    except Exception:  # noqa: BLE001
        return None


def estimates(t) -> dict | None:
    """Analyst consensus from Yahoo: revenue growth for this and next fiscal year,
    and how the EPS estimate moved over 30 and 90 days (revision momentum)."""
    out = {}
    try:
        rev = t.revenue_estimate
        for period, key in (("0y", "revenueGrowthFy0Pct"), ("+1y", "revenueGrowthFy1Pct")):
            g = _cell(rev, period, "growth")
            out[key] = round(g * 100, 1) if g is not None and abs(g) < 20 else None
        out["revenueAnalysts"] = _cell(rev, "+1y", "numberOfAnalysts") or _cell(rev, "0y", "numberOfAnalysts")
    except Exception:  # noqa: BLE001
        pass
    try:
        trend = t.eps_trend
        period = "+1y" if _cell(trend, "+1y", "current") is not None else "0y"
        cur = _cell(trend, period, "current")
        for col, key in (("30daysAgo", "epsRevision30dPct"), ("90daysAgo", "epsRevision90dPct")):
            past = _cell(trend, period, col)
            out[key] = round((cur / past - 1) * 100, 1) if cur is not None and past not in (None, 0) and past > 0 and cur > 0 else None
        out["epsTrendPeriod"] = period
    except Exception:  # noqa: BLE001
        pass
    try:
        rv = t.eps_revisions
        period = "+1y" if _cell(rv, "+1y", "upLast30days") is not None else "0y"
        out["epsUp30d"] = _cell(rv, period, "upLast30days")
        out["epsDown30d"] = _cell(rv, period, "downLast30days")
    except Exception:  # noqa: BLE001
        pass
    return out if any(v is not None for k, v in out.items() if k != "epsTrendPeriod") else None


def splits_of(t) -> list:
    """Stock splits as [{date, ratio}] (2.0 = 2-for-1, 0.1 = 1-for-10), last 10 years."""
    try:
        s = t.splits
        if s is None or getattr(s, "empty", True):
            return []
        cutoff = datetime.now(timezone.utc).year - 10
        return [{"date": str(i)[:10], "ratio": float(v)} for i, v in s.items() if num(v) and float(v) > 0 and int(str(i)[:4]) >= cutoff]
    except Exception:  # noqa: BLE001
        return []


WANT_ESTIMATES: set[str] = set()
ESTIMATE_DEADLINE = {"t": float("inf")}


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
            "nextEarnings": next_earnings(earnings_dates(t), t),
            "splits": splits_of(t),
            "surprises": earnings_surprises(t),
        }
        # Consensus estimates for the research universe only, and only while the budget allows.
        if ticker in WANT_ESTIMATES and time.time() < ESTIMATE_DEADLINE["t"]:
            try:
                out["estimates"] = estimates(t)
            except Exception:  # noqa: BLE001
                out["estimates"] = None
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
            assets, assets_prior, assets_end = row(t.balance_sheet, "Total Assets")
            ebitda, ebitda_prior, _ = row(t.income_stmt, "EBITDA", "Normalized EBITDA")
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
                # Investment inputs (two fiscal years) for asset growth vs EBITDA growth and gross profitability.
                "investment": {"assets": assets, "assetsPrior": assets_prior, "ebitda": ebitda, "ebitdaPrior": ebitda_prior,
                               "grossProfit": gross, "end": assets_end},
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
    WANT_ESTIMATES.update(c["ticker"] for sector in universe.get("sectors", []) for c in sector.get("publicCompanies", []))
    results, errors = {}, []
    deadline = time.time() + 15 * 60
    ESTIMATE_DEADLINE["t"] = time.time() + 11 * 60  # estimates add three calls per ticker; stop them first
    lock = threading.Lock()
    cooldown = {"until": 0.0, "pause": 0.6}
    limited: list[str] = []

    def rate_limited(error: Exception) -> bool:
        text = str(error).lower()
        return "429" in text or "too many requests" in text or "rate limit" in text or "ratelimit" in type(error).__name__.lower()

    def work(ticker: str) -> None:
        # One shared cool-down: when any worker is refused, every worker waits.
        while time.time() < cooldown["until"]:
            time.sleep(1)
        if time.time() > deadline:
            with lock:
                errors.append(f"{ticker}: time budget reached")
            return
        try:
            row_ = collect(ticker)
            with lock:
                cooldown["pause"] = max(0.6, cooldown["pause"] * 0.95)  # relax again after successes
                if row_:
                    results[ticker] = row_
                else:
                    errors.append(f"{ticker}: no price history")
        except Exception as error:  # noqa: BLE001
            with lock:
                if rate_limited(error):
                    # One 15-second window per burst (refusals inside it do not extend it),
                    # and slower spacing from then on.
                    if time.time() >= cooldown["until"]:
                        cooldown["until"] = time.time() + 15
                    cooldown["pause"] = min(2.0, cooldown["pause"] * 1.5)
                    limited.append(ticker)
                else:
                    errors.append(f"{ticker}: {str(error)[:120]}")
        time.sleep(cooldown["pause"])

    # Two workers with a shared cool-down; three without one drew more 429s than they saved.
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(work, tickers))
    # Rate-limited tickers: one more sequential pass while the budget lasts.
    retry, limited[:] = list(dict.fromkeys(limited)), []
    for ticker in retry:
        work(ticker)
    errors.extend(f"{t}: rate limited (HTTP 429), previous values kept" for t in dict.fromkeys(limited))
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
