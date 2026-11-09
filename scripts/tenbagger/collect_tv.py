"""Ten-bagger tracker: market-wide growth scan through the TradingView scanner.

The semiconductor terminal already collects its peer screen through the
public TradingView scanner (scripts/terminal/collect_market.py, package
tradingview-screener, MIT). This reuses that source for three things the
curated universe cannot give on its own:

* a measured revenue-growth map of every industry (not a forecast),
* fast growers outside the curated universe, and
* stocks that already rose tenfold in five years, for the pattern study.

It also returns TradingView's row for every universe ticker so the Node
collector can cross-check SEC/Yahoo figures against an independent source.

Writes data/tenbagger/tv-cache.json (not committed). Values are exactly what
the scanner returns; scripts/tenbagger-screen.mjs turns them into the
published data/tenbagger/screen.json. Market cap from a multi-market scan is
in US dollars (checked against the terminal's KRX and TWSE rows).
"""
from __future__ import annotations

import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UNIVERSE = ROOT / "data" / "tenbagger" / "universe.json"
OUT = ROOT / "data" / "tenbagger" / "tv-cache.json"

# Universe exchange code -> TradingView exchange prefix.
TV_PREFIX = {"KOSDAQ": "KRX", "KOSPI": "KRX", "NYSEAMERICAN": "AMEX", "AMS": "EURONEXT", "SWX": "SIX"}
MARKETS = ["america", "korea", "japan", "hongkong", "taiwan", "china", "uk", "germany", "canada",
           "netherlands", "switzerland", "france", "sweden", "israel", "australia", "india"]
CORE = ["name", "description", "exchange", "country", "currency", "sector", "industry", "close", "market_cap_basic"]
OPTIONAL = ["total_revenue_ttm", "total_revenue_yoy_growth_ttm", "free_cash_flow_ttm", "gross_margin",
            "cash_n_short_term_invest_fq", "fundamental_currency_code", "Perf.Y", "Perf.5Y", "Perf.All",
            "price_52_week_high", "price_book_fq", "operating_margin", "price_free_cash_flow_ttm",
            "price_revenue_ttm", "price_earnings_ttm", "return_on_equity", "debt_to_equity", "current_ratio",
            "beta_1_year", "earnings_release_next_date", "RSI", "price_52_week_low"]
MIN_CAP_USD = 5e7
LIMIT = 9000
BUDGET_SECONDS = 420


def num(value):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(value) or math.isinf(value) else value


def clean(record: dict) -> dict:
    out = {}
    for key, value in record.items():
        if isinstance(value, float):
            value = num(value)
        out[key] = value
    return out


def tv_ticker(ticker: str) -> str:
    exchange, _, code = ticker.partition(":")
    return f"{TV_PREFIX.get(exchange.upper(), exchange.upper())}:{code}"


def main() -> int:
    started = time.time()
    try:
        from tradingview_screener import Query, col  # type: ignore
    except Exception as error:  # noqa: BLE001
        print(f"::warning::tradingview-screener unavailable: {error}")
        return 1

    def scan(fields, markets, limit, *filters, order="market_cap_basic"):
        query = Query().set_markets(*markets).select(*fields)
        if filters:
            query = query.where(*filters)
        count, frame = query.order_by(order, ascending=False).limit(limit).get_scanner_data()
        return count, [clean(r) for r in frame.to_dict("records")]

    # A column the scanner does not know fails the whole request, so each
    # optional column is probed alone first and dropped if refused.
    fields = list(CORE)
    for name in OPTIONAL:
        try:
            scan(CORE + [name], ["america"], 1)
            fields.append(name)
        except Exception as error:  # noqa: BLE001
            print(f"::notice::scanner column {name} refused: {str(error)[:120]}")
    print(f"tradingview columns: {', '.join(fields)}")

    rows, errors, total = [], [], 0
    for market in MARKETS:
        if time.time() - started > BUDGET_SECONDS:
            errors.append(f"{market}: skipped, time budget spent")
            continue
        try:
            count, part = scan(fields, [market], LIMIT, col("market_cap_basic") > MIN_CAP_USD, col("type") == "stock")
        except Exception as error:  # noqa: BLE001
            try:  # the type filter is the least certain part; retry without it
                count, part = scan(fields, [market], LIMIT, col("market_cap_basic") > MIN_CAP_USD)
            except Exception as error2:  # noqa: BLE001
                errors.append(f"{market}: {str(error2)[:160]}")
                continue
        for record in part:
            record["market"] = market
        rows.extend(part)
        total += count or 0
        print(f"tradingview {market}: {len(part)} of {count}")
        time.sleep(0.5)

    # Universe tickers the market scans missed (small caps, odd listings).
    universe = json.loads(UNIVERSE.read_text())
    wanted = sorted({tv_ticker(c["ticker"]) for s in universe["sectors"] for c in s["publicCompanies"]})
    have = {r.get("ticker") for r in rows}
    missing = [t for t in wanted if t not in have]
    if missing and hasattr(Query, "set_tickers"):
        try:
            query = Query().select(*fields).set_tickers(*missing)
            _, frame = query.limit(len(missing) + 5).get_scanner_data()
            extra = [clean(r) for r in frame.to_dict("records")]
            for record in extra:
                record["market"] = "lookup"
            rows.extend(extra)
            print(f"tradingview lookup: {len(extra)} of {len(missing)} missing universe tickers")
        except Exception as error:  # noqa: BLE001
            errors.append(f"lookup: {str(error)[:160]}")

    if not rows:
        print("::warning::tradingview returned no rows; previous screen kept")
        return 1
    OUT.write_text(json.dumps({
        "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "TradingView public scanner via tradingview-screener (delayed, no login)",
        "sourceUrl": "https://www.tradingview.com/screener/",
        "markets": MARKETS,
        "minMarketCapUsd": MIN_CAP_USD,
        "fields": fields,
        "reportedTotal": total,
        "errors": errors,
        "rows": rows,
    }, ensure_ascii=False))
    print(f"tradingview rows={len(rows)} errors={len(errors)} in {time.time() - started:.0f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
