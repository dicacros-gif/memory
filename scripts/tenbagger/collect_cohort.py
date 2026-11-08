"""Ten-bagger base rates: how often stocks with a given starting profile rose tenfold.

Population: US and Korean listings in this run's TradingView scan
(data/tenbagger/tv-cache.json), largest first up to MAX_STOCKS. Monthly
adjusted closes come from Yahoo through yfinance in batches (one request per
batch of symbols, so one market cannot starve the other).

A "start" is every January from 2011 that has a full five-year window after it.
For each start:
  - start size: today's market cap scaled by price (start close / latest close);
    share-count changes are ignored, so this is an approximation;
  - distance from the trailing 12-month high (monthly closes);
  - outcome: a close of 10x the start close within 60 months (hit) and a close
    at or below half the start close within 36 months (halved).
Revenue growth and FCF at the start are not collected historically and are
reported as no data. The population is today's listings only, so the rates
carry survivorship bias (delisted failures are missing).

Writes data/tenbagger/cohort.json (statistics only, no price series). Runs at
most once a week; pass --force to rebuild.
"""
from __future__ import annotations

import json
import math
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "tenbagger" / "tv-cache.json"
OUT = ROOT / "data" / "tenbagger" / "cohort.json"
MAX_STOCKS = {"america": 3200, "korea": 1400}
BATCH = 80
BUDGET_SECONDS = 9 * 60

SIZE_EDGES = [(3e8, "<$0.3B"), (1e9, "$0.3–1B"), (3e9, "$1–3B"), (1e10, "$3–10B"), (float("inf"), ">$10B")]
OFF_EDGES = [(-60, "고점 대비 -60% 이하"), (-30, "-60~-30%"), (-10, "-30~-10%"), (float("inf"), "고점 -10% 이내")]


def size_bucket(cap: float) -> str:
    for edge, label in SIZE_EDGES:
        if cap < edge:
            return label
    return SIZE_EDGES[-1][1]


def off_bucket(pct: float) -> str:
    for edge, label in OFF_EDGES:
        if pct <= edge:
            return label
    return OFF_EDGES[-1][1]


def yahoo_symbol(row: dict) -> list[str]:
    exchange, _, code = str(row.get("ticker") or "").partition(":")
    if not code:
        return []
    if row.get("market") == "korea" or exchange == "KRX":
        return [f"{code}.KS", f"{code}.KQ"]
    if exchange in ("NASDAQ", "NYSE", "AMEX", "NYSE ARCA", "CBOE"):
        return [code.replace(".", "-")]
    return []


def main() -> int:
    force = "--force" in sys.argv
    try:
        previous = json.loads(OUT.read_text())
        age = datetime.now(timezone.utc) - datetime.fromisoformat(previous["generatedAt"])
        if not force and age < timedelta(days=6, hours=12):
            print(json.dumps({"tenbaggerCohort": "fresh", "ageHours": round(age.total_seconds() / 3600, 1)}))
            return 0
    except Exception:  # noqa: BLE001 - first run
        pass
    try:
        import yfinance as yf  # type: ignore
        cache = json.loads(CACHE.read_text())
    except Exception as error:  # noqa: BLE001
        print(f"::warning::cohort skipped: {error}")
        return 1

    started = time.time()
    rows = {}
    for market, limit in MAX_STOCKS.items():
        part = [r for r in cache.get("rows", []) if r.get("market") == market and (r.get("market_cap_basic") or 0) > 0]
        part.sort(key=lambda r: r.get("market_cap_basic") or 0, reverse=True)
        for r in part[:limit]:
            rows[r["ticker"]] = r

    series = {}
    errors = []
    for market in MAX_STOCKS:
        members = [r for r in rows.values() if r.get("market") == market]
        for attempt in (0, 1):  # Korea: .KS first, then .KQ for codes that returned nothing
            pending = [r for r in members if r["ticker"] not in series]
            symbols = {}
            for r in pending:
                options = yahoo_symbol(r)
                if len(options) > attempt:
                    symbols[options[attempt]] = r["ticker"]
            names = list(symbols)
            for i in range(0, len(names), BATCH):
                if time.time() - started > BUDGET_SECONDS:
                    errors.append(f"{market}: time budget reached at {len(series)} series")
                    break
                batch = names[i:i + BATCH]
                try:
                    frame = yf.download(batch, period="16y", interval="1mo", auto_adjust=True, progress=False, group_by="ticker", threads=True)
                except Exception as error:  # noqa: BLE001
                    errors.append(f"{market} batch {i}: {str(error)[:100]}")
                    continue
                for symbol in batch:
                    try:
                        closes = frame[symbol]["Close"].dropna() if len(batch) > 1 else frame["Close"].dropna()
                    except Exception:  # noqa: BLE001
                        continue
                    points = [(str(k)[:7], float(v)) for k, v in closes.items() if v and v > 0 and not math.isnan(v)]
                    if len(points) >= 24:
                        series[symbols[symbol]] = points
                time.sleep(1.0)
            if market != "korea":
                break

    now_year = datetime.now(timezone.utc).year
    cells = defaultdict(lambda: {"n": 0, "hits": 0, "halved": 0})
    base = {"n": 0, "hits": 0, "halved": 0}
    profiles = {"winners": defaultdict(int), "others": defaultdict(int)}
    off_values = {"winners": [], "others": []}
    examples, graduates = [], []
    for ticker, points in series.items():
        r = rows[ticker]
        cap_now = r.get("market_cap_basic") or 0
        last = points[-1][1]
        market = "US" if r.get("market") == "america" else "KR"
        industry = r.get("industry") or "기타"
        index = {month: i for i, (month, _) in enumerate(points)}
        for year in range(2011, now_year - 4):
            i = index.get(f"{year}-01")
            if i is None or i < 12 or i + 60 >= len(points):
                continue
            close = points[i][1]
            start_cap = cap_now * close / last
            high12 = max(p for _, p in points[i - 12:i + 1])
            off = (close / high12 - 1) * 100
            window = points[i + 1:i + 61]
            hit_at = next((k for k, (_, p) in enumerate(window) if p >= 10 * close), None)
            halved = any(p <= 0.5 * close for _, p in points[i + 1:i + 37])
            s, o = size_bucket(start_cap), off_bucket(off)
            for key in (f"size|{s}", f"off|{o}", f"size·off|{s}|{o}", f"size·off·mkt|{s}|{o}|{market}", f"ind·size|{industry}|{s}", f"mkt|{market}"):
                c = cells[key]
                c["n"] += 1
                c["hits"] += 1 if hit_at is not None else 0
                c["halved"] += 1 if halved else 0
            base["n"] += 1
            base["hits"] += 1 if hit_at is not None else 0
            base["halved"] += 1 if halved else 0
            group = "winners" if hit_at is not None else "others"
            profiles[group][f"size|{s}"] += 1
            profiles[group][f"off|{o}"] += 1
            profiles[group]["n"] += 1
            off_values[group].append(off)
            if hit_at is not None:
                examples.append({"ticker": ticker, "name": r.get("description") or r.get("name"), "market": market, "industry": industry,
                                 "startMonth": points[i][0], "hitMonth": window[hit_at][0], "months": hit_at + 1,
                                 "startCapUsd": round(start_cap), "startOffHighPct": round(off, 1), "halvedWithin3y": halved})
        # Recent graduates: a 10x from a low in the last five years to a close in the last two.
        recent = points[-60:]
        if len(recent) >= 24:
            low_i = min(range(len(recent) - 1), key=lambda k: recent[k][1])
            peak_i = max(range(low_i + 1, len(recent)), key=lambda k: recent[k][1])
            multiple = recent[peak_i][1] / recent[low_i][1]
            if multiple >= 10 and peak_i >= len(recent) - 24:
                graduates.append({"ticker": ticker, "name": r.get("description") or r.get("name"), "market": market, "industry": industry,
                                  "lowMonth": recent[low_i][0], "peakMonth": recent[peak_i][0], "multiple": round(multiple, 1),
                                  "fromPeakPct": round((last / recent[peak_i][1] - 1) * 100, 1), "marketCapUsd": round(cap_now)})

    def median(values):
        values = sorted(values)
        if not values:
            return None
        m = len(values) // 2
        return round(values[m] if len(values) % 2 else (values[m - 1] + values[m]) / 2, 1)

    def shares(group):
        n = profiles[group].get("n", 0) or 1
        return {k: round(v / n * 100, 1) for k, v in profiles[group].items() if k != "n"}

    examples.sort(key=lambda e: (e["months"], e["startMonth"]))
    graduates.sort(key=lambda g: -g["multiple"])
    OUT.write_text(json.dumps({
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Yahoo Finance monthly adjusted closes (yfinance); population and today's market caps from the TradingView scan",
        "method": {
            "starts": "매년 1월, 이후 60개월이 모두 있는 시점",
            "hit": "시작 종가의 10배 이상 월말 종가가 60개월 안에 나옴",
            "halved": "36개월 안에 시작 종가의 절반 이하 월말 종가",
            "startSize": "오늘 시가총액 × (시작 종가 ÷ 최근 종가) — 주식 수 변화 무시한 근사",
            "offHigh": "시작 시점 직전 12개월 월말 종가 최고치 대비",
            "noData": "시작 시점의 매출 성장률·FCF는 과거 재무를 수집하지 않아 없음",
            "bias": "현재 상장 종목만 포함 — 상장폐지 실패 사례가 빠진 생존 편향",
        },
        "sizeBuckets": [label for _, label in SIZE_EDGES],
        "offBuckets": [label for _, label in OFF_EDGES][::-1],
        "population": {"stocks": len(series), "requested": len(rows), "starts": base["n"]},
        "base": base,
        "cells": dict(cells),
        "profiles": {
            "winners": {"n": profiles["winners"].get("n", 0), "shares": shares("winners"), "medianOffHighPct": median(off_values["winners"])},
            "others": {"n": profiles["others"].get("n", 0), "shares": shares("others"), "medianOffHighPct": median(off_values["others"])},
        },
        "examples": examples[:150],
        "graduates": graduates[:80],
        "errors": errors[:50],
    }, ensure_ascii=False))
    print(json.dumps({"tenbaggerCohort": "written", "stocks": len(series), "starts": base["n"], "hits": base["hits"], "seconds": round(time.time() - started)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
