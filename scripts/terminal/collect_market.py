#!/usr/bin/env python3
"""Semiconductor terminal collector.

Runs inside the scheduled GitHub Actions refresh and gathers the market data
the static site cannot fetch from a browser: valuation multiples, analyst
consensus, earnings dates, estimate revisions, OHLCV bars, FRED macro series,
KRX listing data and a cross-market semiconductor screen.

Only sources that need no account, API key or login are used:

* OpenBB Platform (openbb-core) with its free ``yfinance`` provider
* FinanceDataReader for FRED series (fredgraph CSV) and the KRX listing cache
* TradingView-Screener without cookies (delayed public scanner data)

Every section is fail-soft. A source that fails keeps its last verified
values, marked with the time they were observed, instead of erasing them; the
Node bundle decides what is still fresh enough to show.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
SOURCE_OUT = DATA / "terminal-source.json"
OHLCV_DIR = DATA / "terminal-ohlcv"
UNIVERSE = DATA / "terminal-universe.json"
MARKET_HISTORY = DATA / "market-history.json"

NOW = datetime.now(timezone.utc)
STARTED = time.monotonic()


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def log(message: str) -> None:
    print(f"[terminal] {message}", flush=True)


def clean(value: Any) -> Any:
    """Convert pandas/numpy/pydantic values into plain JSON values."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int,)):
        return value
    if isinstance(value, float):
        return None if math.isnan(value) or math.isinf(value) else round(value, 6)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items() if clean(v) is not None}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if hasattr(value, "item"):
        try:
            return clean(value.item())
        except Exception:  # noqa: BLE001 - numpy scalars only
            pass
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:  # noqa: BLE001
            pass
    return str(value)


def read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001 - absent or partial file means "start fresh"
        return fallback


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + f".{os.getpid()}.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    temporary.replace(path)


def over_budget(budget: float) -> bool:
    return time.monotonic() - STARTED > budget


class Provider:
    """Per-source bookkeeping that ends up in the published status block."""

    def __init__(self, name: str, package: str, license_name: str, url: str):
        self.name = name
        self.status = {
            "package": package,
            "license": license_name,
            "url": url,
            "attempted": 0,
            "ok": 0,
            "failed": 0,
            "errors": [],
            "version": None,
            "startedAt": iso_now(),
        }

    def record(self, ok: bool, error: str | None = None) -> None:
        self.status["attempted"] += 1
        if ok:
            self.status["ok"] += 1
        else:
            self.status["failed"] += 1
            if error and len(self.status["errors"]) < 8:
                self.status["errors"].append(error[:240])

    def finish(self) -> dict:
        self.status["finishedAt"] = iso_now()
        attempted = self.status["attempted"]
        self.status["state"] = (
            "skipped" if attempted == 0
            else "ok" if self.status["failed"] == 0
            else "partial" if self.status["ok"] > 0
            else "failed"
        )
        return self.status


def attempt(provider: Provider, label: str, fn: Callable[[], Any]) -> Any:
    try:
        value = fn()
        if value in (None, [], {}):
            provider.record(False, f"{label}: empty response")
            return None
        provider.record(True)
        return value
    except Exception as error:  # noqa: BLE001 - every source is fail-soft
        provider.record(False, f"{label}: {type(error).__name__}: {error}")
        return None


def chunks(items: list, size: int) -> list[list]:
    return [items[index:index + size] for index in range(0, len(items), size)]


# ── Universe ────────────────────────────────────────────────────────────────

def load_universe(config: dict) -> list[dict]:
    history = read_json(MARKET_HISTORY, {"indexes": {}})
    rows = []
    for index in (history.get("indexes") or {}).values():
        symbol = str(index.get("symbol") or "").strip()
        if not symbol:
            continue
        rows.append({
            "id": index.get("id"),
            "symbol": symbol,
            "name": index.get("shortName") or index.get("label"),
            "region": index.get("region") or ("index" if symbol.startswith("^") else "global"),
            "valueChain": index.get("valueChain") or ("index" if symbol.startswith("^") else ""),
            "isIndex": symbol.startswith("^"),
        })
    known = {row["symbol"] for row in rows}
    for extra in config.get("extra") or []:
        if extra.get("symbol") and extra["symbol"] not in known:
            rows.append({**extra, "isIndex": False})
    return rows


# ── OpenBB (yfinance provider) ──────────────────────────────────────────────

def openbb_rows(result: Any) -> list[dict]:
    rows = getattr(result, "results", None)
    if rows is None:
        return []
    if not isinstance(rows, list):
        rows = [rows]
    output = []
    for row in rows:
        if hasattr(row, "model_dump"):
            output.append(clean(row.model_dump(exclude_none=True)))
        elif isinstance(row, dict):
            output.append(clean(row))
    return output


def collect_openbb(universe: list[dict], previous: dict, config: dict, budget: float) -> tuple[dict, dict, dict, dict]:
    provider = Provider("openbb", "openbb-core + openbb-yfinance", "AGPL-3.0", "https://github.com/OpenBB-finance/OpenBB")
    equities: dict[str, dict] = {}
    industry: dict[str, Any] = {}
    news: list[dict] = []
    try:
        from openbb import obb  # type: ignore
        import openbb_core  # type: ignore
        provider.status["version"] = getattr(openbb_core, "__version__", None)
    except Exception as error:  # noqa: BLE001
        provider.record(False, f"import: {error}")
        return {}, {}, [], provider.finish()

    symbols = [row["symbol"] for row in universe if not row.get("isIndex")]
    all_symbols = [row["symbol"] for row in universe]
    stamp = iso_now()

    def put(symbol: str, section: str, value: Any) -> None:
        if value in (None, [], {}):
            return
        equities.setdefault(symbol, {})[section] = {"asOf": stamp, "data": value}

    # Batched endpoints: one request covers many symbols.
    for batch in chunks(all_symbols, 25):
        if over_budget(budget):
            break
        rows = attempt(provider, f"quote {batch[0]}..", lambda: openbb_rows(obb.equity.price.quote(symbol=",".join(batch), provider="yfinance")))
        for row in rows or []:
            put(row.get("symbol"), "quote", row)
    for endpoint, section, call in [
        ("metrics", "metrics", lambda batch: obb.equity.fundamental.metrics(symbol=",".join(batch), provider="yfinance")),
        ("consensus", "consensus", lambda batch: obb.equity.estimates.consensus(symbol=",".join(batch), provider="yfinance")),
    ]:
        for batch in chunks(symbols, 20):
            if over_budget(budget):
                break
            rows = attempt(provider, f"{endpoint} {batch[0]}..", lambda batch=batch: openbb_rows(call(batch)))
            for row in rows or []:
                put(row.get("symbol"), section, row)

    # Profiles change rarely: refresh weekly, otherwise carry the last copy.
    stale_profiles = []
    for symbol in symbols:
        prior = ((previous.get("equities") or {}).get(symbol) or {}).get("profile")
        try:
            age = (NOW - datetime.fromisoformat(str(prior["asOf"]).replace("Z", "+00:00"))).days if prior else 999
        except Exception:  # noqa: BLE001
            age = 999
        if age >= 7:
            stale_profiles.append(symbol)
    for batch in chunks(stale_profiles, 20):
        if over_budget(budget):
            break
        rows = attempt(provider, f"profile {batch[0]}..", lambda batch=batch: openbb_rows(obb.equity.profile(symbol=",".join(batch), provider="yfinance")))
        for row in rows or []:
            keep = {key: row.get(key) for key in (
                "name", "sector", "industry_category", "hq_country", "employees", "company_url",
                "market_cap", "shares_outstanding", "shares_float", "shares_short", "beta", "dividend_yield",
                "exchange_timezone", "currency",
            )}
            keep["short_description"] = str(row.get("long_description") or row.get("short_description") or "")[:420]
            put(row.get("symbol"), "profile", clean(keep))

    # Per-symbol endpoints run in a small pool; Yahoo rate-limits bursts.
    focus = [row["symbol"] for row in universe if not row.get("isIndex") and row.get("region") != "china"]
    per_symbol = [
        ("calendar", lambda s: obb.yfinance.company_calendar(symbol=s, provider="yfinance"), focus),
        ("epsTrend", lambda s: obb.yfinance.estimates.eps_trend(symbol=s, provider="yfinance"), focus),
        ("epsRevisions", lambda s: obb.yfinance.estimates.eps_revisions(symbol=s, provider="yfinance"), focus),
        ("recommendations", lambda s: obb.yfinance.estimates.recommendations(symbol=s, provider="yfinance"), focus),
    ]
    jobs = [(section, call, symbol) for section, call, targets in per_symbol for symbol in targets]
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {}
        for section, call, symbol in jobs:
            if over_budget(budget):
                break
            futures[pool.submit(lambda call=call, symbol=symbol: openbb_rows(call(symbol)))] = (section, symbol)
        for future in as_completed(futures):
            section, symbol = futures[future]
            try:
                rows = future.result()
                provider.record(bool(rows), None if rows else f"{section} {symbol}: empty response")
                put(symbol, section, rows if section != "calendar" else (rows[0] if rows else None))
            except Exception as error:  # noqa: BLE001
                provider.record(False, f"{section} {symbol}: {type(error).__name__}: {error}")

    # OHLCV bars for the chart function. One file per symbol keeps the page
    # from downloading every chart at once.
    start = (NOW - timedelta(days=int(config.get("ohlcvDays") or 400))).date().isoformat()
    bars_written = 0

    def fetch_bars(row: dict) -> tuple[dict, list]:
        result = obb.equity.price.historical(symbol=row["symbol"], start_date=start, provider="yfinance", interval="1d")
        bars = []
        for item in openbb_rows(result):
            stamp_value = item.get("date")
            try:
                moment = datetime.fromisoformat(str(stamp_value)[:10]).replace(tzinfo=timezone.utc)
            except Exception:  # noqa: BLE001
                continue
            values = [item.get(key) for key in ("open", "high", "low", "close")]
            if any(value is None for value in values):
                continue
            bars.append([int(moment.timestamp() * 1000), *[round(float(value), 4) for value in values], int(item.get("volume") or 0)])
        return row, bars

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(fetch_bars, row) for row in universe if not over_budget(budget)]
        for future in as_completed(futures):
            try:
                row, bars = future.result()
            except Exception as error:  # noqa: BLE001
                provider.record(False, f"historical: {type(error).__name__}: {error}")
                continue
            if len(bars) < 20:
                provider.record(False, f"historical {row['symbol']}: {len(bars)} bars")
                continue
            provider.record(True)
            write_json(OHLCV_DIR / f"{row['id']}.json", {
                "schemaVersion": "1.0",
                "id": row["id"],
                "symbol": row["symbol"],
                "source": "OpenBB · yfinance",
                "asOf": stamp,
                "fields": ["t", "o", "h", "l", "c", "v"],
                "bars": bars,
            })
            bars_written += 1
    provider.status["ohlcvFiles"] = bars_written

    for slug in config.get("yahooIndustries") or []:
        if over_budget(budget):
            break
        block = {}
        for key, call in [
            ("overview", lambda: obb.yfinance.industry.overview(sector="technology", industry=slug, provider="yfinance")),
            ("topPerforming", lambda: obb.yfinance.industry.top_performing(sector="technology", industry=slug, provider="yfinance")),
            ("topGrowth", lambda: obb.yfinance.industry.top_growth(sector="technology", industry=slug, provider="yfinance")),
        ]:
            rows = attempt(provider, f"industry {slug} {key}", lambda call=call: openbb_rows(call()))
            if rows:
                block[key] = rows[:25]
        if block:
            industry[slug] = {"asOf": stamp, **block}

    news_symbols = [symbol for symbol in (config.get("newsSymbols") or []) if symbol]
    if news_symbols and not over_budget(budget):
        rows = attempt(provider, "news", lambda: openbb_rows(obb.news.company(symbol=",".join(news_symbols), provider="yfinance", limit=40)))
        for row in rows or []:
            if row.get("title") and row.get("url"):
                news.append({key: row.get(key) for key in ("date", "title", "url", "source", "symbols", "excerpt")})

    return equities, industry, news, provider.finish()


# ── FinanceDataReader (FRED + KRX listing cache) ────────────────────────────

def collect_fdr(config: dict, krx_codes: dict[str, str], budget: float) -> tuple[dict, dict, dict]:
    provider = Provider("financeDataReader", "finance-datareader", "MIT", "https://github.com/FinanceData/FinanceDataReader")
    macro: dict[str, Any] = {}
    krx: dict[str, Any] = {}
    try:
        import FinanceDataReader as fdr  # type: ignore
        provider.status["version"] = getattr(fdr, "__version__", None)
    except Exception as error:  # noqa: BLE001
        provider.record(False, f"import: {error}")
        return {}, {}, provider.finish()

    start = (NOW - timedelta(days=760)).date().isoformat()
    for series in config.get("fred") or []:
        if over_budget(budget):
            break

        def read(series=series):
            frame = fdr.DataReader(f"FRED:{series['id']}", start)
            if frame is None or frame.empty:
                raise ValueError("empty series")
            column = frame.columns[0]
            points = []
            for stamp, value in frame[column].dropna().items():
                points.append([str(stamp)[:10], round(float(value), 4)])
            return points

        points = attempt(provider, f"FRED {series['id']}", read)
        if points:
            macro[series["id"]] = {
                "label": series.get("label"),
                "unit": series.get("unit"),
                "source": "FRED via FinanceDataReader",
                "url": f"https://fred.stlouisfed.org/series/{series['id']}",
                "asOf": iso_now(),
                "points": points[-520:],
            }

    if krx_codes and not over_budget(budget):
        def listing():
            frame = fdr.StockListing("KRX")
            if frame is None or frame.empty:
                raise ValueError("empty listing")
            frame = frame.rename(columns={column: str(column) for column in frame.columns})
            code_column = next((c for c in ("Code", "Symbol") if c in frame.columns), None)
            if not code_column:
                raise ValueError(f"no code column in {list(frame.columns)[:8]}")
            wanted = set(krx_codes.values())
            rows = {}
            for record in frame[frame[code_column].astype(str).isin(wanted)].to_dict("records"):
                code = str(record.get(code_column))
                rows[code] = clean({
                    "name": record.get("Name"),
                    "market": record.get("Market"),
                    "close": record.get("Close"),
                    "changePct": record.get("ChagesRatio", record.get("ChangesRatio")),
                    "marcap": record.get("Marcap"),
                    "shares": record.get("Stocks"),
                    "volume": record.get("Volume"),
                    "amount": record.get("Amount"),
                })
            return rows

        rows = attempt(provider, "KRX listing", listing)
        if rows:
            krx = {"asOf": iso_now(), "source": "KRX listing via FinanceDataReader", "rows": rows}
    return macro, krx, provider.finish()


# ── TradingView-Screener (public scanner, no cookies) ───────────────────────

RICH_FIELDS = [
    "name", "description", "exchange", "country", "currency", "industry", "close", "change",
    "market_cap_basic", "price_earnings_ttm", "enterprise_value_ebitda_ttm", "price_book_fq",
    "gross_margin", "dividend_yield_recent", "RSI", "Recommend.All", "Perf.W", "Perf.1M",
    "Perf.3M", "Perf.YTD", "Perf.Y", "relative_volume_10d_calc",
]
CORE_FIELDS = [
    "name", "description", "exchange", "country", "currency", "industry", "close", "change",
    "market_cap_basic", "price_earnings_ttm", "RSI", "Recommend.All", "Perf.1M", "Perf.YTD", "Perf.Y",
]


def collect_tradingview(config: dict, budget: float) -> tuple[dict, dict]:
    provider = Provider("tradingviewScreener", "tradingview-screener", "MIT", "https://github.com/shner-elmo/TradingView-Screener")
    screen = config.get("screener") or {}
    try:
        import tradingview_screener as tvs  # type: ignore
        from tradingview_screener import Query, col  # type: ignore
        provider.status["version"] = getattr(tvs, "__version__", None)
    except Exception as error:  # noqa: BLE001
        provider.record(False, f"import: {error}")
        return {}, provider.finish()
    if over_budget(budget):
        return {}, provider.finish()

    def run(fields: list[str]):
        query = (
            Query()
            .set_markets(*(screen.get("markets") or ["america"]))
            .select(*fields)
            .where(
                col("industry").isin(screen.get("industries") or ["Semiconductors"]),
                col("market_cap_basic") > float(screen.get("minimumMarketCapUsd") or 2e9),
            )
            .order_by("market_cap_basic", ascending=False)
            .limit(int(screen.get("limit") or 150))
        )
        count, frame = query.get_scanner_data()
        return count, [clean(record) for record in frame.to_dict("records")]

    result = attempt(provider, "scan rich", lambda: run(RICH_FIELDS))
    fields = RICH_FIELDS
    if result is None:
        result = attempt(provider, "scan core", lambda: run(CORE_FIELDS))
        fields = CORE_FIELDS
    if not result:
        return {}, provider.finish()
    count, rows = result
    return {
        "asOf": iso_now(),
        "source": "TradingView public scanner via TradingView-Screener (delayed)",
        "total": count,
        "fields": fields,
        "rows": rows,
    }, provider.finish()


# ── Merge with the last verified collection ─────────────────────────────────

def merge_equities(previous: dict, current: dict) -> dict:
    merged = {symbol: dict(sections) for symbol, sections in (previous or {}).items()}
    for symbol, sections in current.items():
        merged.setdefault(symbol, {}).update(sections)
    return merged


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--budget", type=float, default=float(os.getenv("TERMINAL_BUDGET_SECONDS", "720")))
    parser.add_argument("--offline", action="store_true", help="skip network sources; rewrite the merged file only")
    args = parser.parse_args()

    config = read_json(UNIVERSE, {})
    previous = read_json(SOURCE_OUT, {})
    universe = load_universe(config)
    krx_codes = dict(config.get("krxCodes") or {})
    for extra in config.get("extra") or []:
        if extra.get("krx"):
            krx_codes[extra["id"]] = extra["krx"]
    log(f"universe {len(universe)} symbols · budget {args.budget:.0f}s · offline={args.offline}")

    providers = dict(previous.get("providers") or {})
    equities, industry, news, macro, krx, screener = {}, {}, [], {}, {}, {}
    if not args.offline:
        equities, industry, news, providers["openbb"] = collect_openbb(universe, previous, config, args.budget)
        log(f"openbb {providers['openbb'].get('state')} ok={providers['openbb'].get('ok')} failed={providers['openbb'].get('failed')}")
        macro, krx, providers["financeDataReader"] = collect_fdr(config, krx_codes, args.budget + 120)
        log(f"fdr {providers['financeDataReader'].get('state')} ok={providers['financeDataReader'].get('ok')}")
        screener, providers["tradingviewScreener"] = collect_tradingview(config, args.budget + 180)
        log(f"tradingview {providers['tradingviewScreener'].get('state')} rows={len(screener.get('rows') or [])}")

    payload = {
        "schemaVersion": "1.0",
        "generatedAt": iso_now(),
        "durationSec": round(time.monotonic() - STARTED, 1),
        "excludedSources": [
            {"name": "OpenBB Workspace", "reason": "엔터프라이즈 UI · 구독 필요"},
            {"name": "pykrx", "reason": "KRX 데이터 포털 로그인(KRX_ID·KRX_PW) 필요"},
            {"name": "TradingView-API (Mathieu2301)", "reason": "프리미엄 기능은 계정 세션 필요"},
            {"name": "tvdatafeed", "reason": "비공식 웹소켓 · 캔들만 제공 · OpenBB OHLCV와 중복"},
            {"name": "QuantConnect LEAN", "reason": "실행 엔진 · 데이터 구독 필요 · 정적 사이트 배포 불가"},
            {"name": "Fincept Terminal", "reason": "설치형 데스크톱 앱 · 기능 구성만 참고"},
            {"name": "TradingView Lightweight Charts", "reason": "지표 부족 · KLineChart로 대체"},
        ],
        "providers": providers,
        "universe": universe,
        "equities": merge_equities(previous.get("equities") or {}, equities),
        "industry": industry or previous.get("industry") or {},
        "news": news or previous.get("news") or [],
        "macro": {**(previous.get("macro") or {}), **macro},
        "krx": krx or previous.get("krx") or {},
        "screener": screener or previous.get("screener") or {},
    }
    write_json(SOURCE_OUT, payload)
    log(f"wrote {SOURCE_OUT.relative_to(ROOT)} · {len(payload['equities'])} equities · {payload['durationSec']}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
