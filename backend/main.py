"""FastAPI entrypoint for the Bangkok-election social-listening dashboard.

Endpoints:
- GET  /api/health
- GET  /api/presets               — preset candidates, defaults, cost info
- GET  /api/history               — read aggregated metrics from SQLite (fast, no Apify)
- GET  /api/coverage              — per-day scrape log status for a date range
- POST /api/backfill              — scrape every day in a range (idempotent)
- POST /api/scrape-today          — scrape today only (force-refresh)
- POST /api/deep-scrape           — hourly slicing on a single day

Run locally:
    uvicorn main:app --reload --host 127.0.0.1 --port 8000
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import date
from typing import Any

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import db
import scheduler
import scraper
from aggregator import aggregate
from config import (
    BACKEND_HOST,
    BACKEND_PORT,
    CANDIDATE_PRESETS,
    DEFAULT_START_DATE,
    MAX_TWEETS_PER_KEYWORD,
    PRICE_PER_TWEET_USD,
    READONLY_MODE,
    SCRAPE_SCHEDULE_HOUR,
    SCRAPE_SCHEDULE_MIN,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("dashboard")

if READONLY_MODE:
    logger.info("READONLY_MODE=true — all scraping endpoints are disabled")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init()
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="Chadchart Social Listening",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # Allow any localhost port — dev preview servers sometimes pick a fresh one.
    # Also allow any origin for Docker deployments behind a reverse proxy.
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- read-only guard ---------------------------------------------------------
async def require_write_mode() -> None:
    """FastAPI dependency: raises 403 when READONLY_MODE=true."""
    if READONLY_MODE:
        raise HTTPException(
            status_code=403,
            detail="Read-only mode — scraping is disabled on this instance.",
        )


# --- models ------------------------------------------------------------------
class KeywordSpec(BaseModel):
    key: str
    label: str
    query: str
    color: str = "#0F3B1F"


class HistoryQuery(BaseModel):
    keywords: list[KeywordSpec] = Field(..., min_length=1, max_length=6)
    start_date: str = Field(default_factory=lambda: DEFAULT_START_DATE)
    end_date: str = Field(default_factory=lambda: date.today().isoformat())


class BackfillRequest(BaseModel):
    keywords: list[KeywordSpec] = Field(..., min_length=1, max_length=6)
    start_date: str
    end_date: str
    cap: int | None = Field(default=None, ge=10, le=MAX_TWEETS_PER_KEYWORD)
    force: bool = False             # re-scrape even days already covered


class ScrapeTodayRequest(BaseModel):
    keywords: list[KeywordSpec] = Field(..., min_length=1, max_length=6)
    cap: int | None = Field(default=None, ge=10, le=MAX_TWEETS_PER_KEYWORD)


class DeepScrapeRequest(BaseModel):
    keywords: list[KeywordSpec] = Field(..., min_length=1, max_length=6)
    day: str
    per_hour_cap: int = Field(default=500, ge=50, le=1000)


# --- helpers -----------------------------------------------------------------
def _aggregate_keyword(spec: KeywordSpec, start: str, end: str) -> dict:
    tweets = db.get_tweets(spec.key, start, end)
    return aggregate(
        tweets,
        keyword=spec.key,
        label=spec.label,
        color=spec.color,
        start_date=start,
        end_date=end,
    )


def _coverage_block(keyword_key: str, start: str, end: str) -> dict:
    """Per-day status: 'missing' | 'sampled' | 'complete', plus totals."""
    have = db.coverage(keyword_key, start, end)
    days: list[dict] = []
    cur = date.fromisoformat(start)
    last = date.fromisoformat(end)
    while cur <= last:
        d = cur.isoformat()
        e = have.get(d)
        if e is None:
            days.append({"day": d, "status": "missing", "tweets": 0,
                         "hit_cap": False, "cost": 0.0})
        else:
            days.append({
                "day": d,
                "status": "sampled" if e["hit_cap"] else "complete",
                "tweets": e["tweets_added"],
                "hit_cap": bool(e["hit_cap"]),
                "cost": float(e["cost_usd"]),
            })
        cur = date.fromordinal(cur.toordinal() + 1)

    total_tweets = sum(d["tweets"] for d in days)
    total_cost = sum(d["cost"] for d in days)
    missing = sum(1 for d in days if d["status"] == "missing")
    sampled = sum(1 for d in days if d["status"] == "sampled")
    return {
        "keyword": keyword_key,
        "days": days,
        "totals": {
            "tweets": total_tweets,
            "cost_usd": round(total_cost, 4),
            "missing": missing,
            "sampled": sampled,
            "complete": len(days) - missing - sampled,
        },
    }


# --- routes ------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "readonly": READONLY_MODE}


@app.get("/api/presets")
async def presets():
    return {
        "presets": CANDIDATE_PRESETS,
        "default_start_date": DEFAULT_START_DATE,
        "today": date.today().isoformat(),
        "max_tweets_per_keyword": MAX_TWEETS_PER_KEYWORD,
        "price_per_tweet_usd": PRICE_PER_TWEET_USD,
        "readonly_mode": READONLY_MODE,
        "schedule": {
            "hour": SCRAPE_SCHEDULE_HOUR,
            "minute": SCRAPE_SCHEDULE_MIN,
            "enabled": SCRAPE_SCHEDULE_HOUR >= 0 and not READONLY_MODE,
        },
    }


@app.post("/api/history")
async def history(req: HistoryQuery):
    """Return aggregated metrics from SQLite. No Apify call. Fast."""
    results = [_aggregate_keyword(k, req.start_date, req.end_date) for k in req.keywords]
    total = sum(r["totals"]["tweets"] for r in results) or 1
    for r in results:
        r["share_of_voice"] = round(r["totals"]["tweets"] * 100 / total, 1)
    coverage = {k.key: _coverage_block(k.key, req.start_date, req.end_date) for k in req.keywords}
    return {
        "window": {"start": req.start_date, "end": req.end_date},
        "results": results,
        "coverage": coverage,
    }


@app.get("/api/coverage")
async def coverage_endpoint(keyword: str, start: str, end: str):
    return _coverage_block(keyword, start, end)


@app.post("/api/backfill", dependencies=[Depends(require_write_mode)])
async def backfill(req: BackfillRequest):
    cap = req.cap or MAX_TWEETS_PER_KEYWORD
    summaries = []
    for spec in req.keywords:
        try:
            r = await scraper.backfill(
                keyword_key=spec.key, query=spec.query,
                start=req.start_date, end=req.end_date,
                cap=cap, force=req.force,
            )
            summaries.append(r)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Apify error for '{spec.label}': {e}") from e
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"Backfill failed for '{spec.label}': {e}") from e
    return {
        "window": {"start": req.start_date, "end": req.end_date},
        "cap": cap,
        "summaries": summaries,
        "total_cost_usd": round(sum(s["cost_usd"] for s in summaries), 4),
    }


@app.post("/api/scrape-today", dependencies=[Depends(require_write_mode)])
async def scrape_today(req: ScrapeTodayRequest):
    cap = req.cap or MAX_TWEETS_PER_KEYWORD
    today = date.today().isoformat()
    summaries = []
    for spec in req.keywords:
        r = await scraper.backfill(
            keyword_key=spec.key, query=spec.query,
            start=today, end=today, cap=cap, force=True,
        )
        summaries.append(r)
    return {
        "day": today,
        "cap": cap,
        "summaries": summaries,
        "total_cost_usd": round(sum(s["cost_usd"] for s in summaries), 4),
    }


@app.post("/api/deep-scrape", dependencies=[Depends(require_write_mode)])
async def deep_scrape(req: DeepScrapeRequest):
    summaries = []
    for spec in req.keywords:
        r = await scraper.deep_scrape_day(
            keyword_key=spec.key, query=spec.query,
            day=req.day, per_hour_cap=req.per_hour_cap,
        )
        summaries.append(r)
    return {
        "day": req.day,
        "per_hour_cap": req.per_hour_cap,
        "summaries": summaries,
        "total_cost_usd": round(sum(s["cost_usd"] for s in summaries), 4),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=BACKEND_HOST, port=BACKEND_PORT, reload=True)
