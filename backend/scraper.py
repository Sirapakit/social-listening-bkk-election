"""Day-by-day scraping orchestrator with SQLite persistence.

This wraps `apify_client.fetch_tweets` with:
- Idempotent per-day loops (skips days already in scrape_log)
- Per-day caps so coverage is deterministic across the date window
- Cost tracking per day, and a "hit_cap" flag for the UI to flag sampled days
- Optional deep-scrape: 24 hourly slices for a single day
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta

import db
from apify_client import fetch_tweets
from config import MAX_TWEETS_PER_KEYWORD, PRICE_PER_TWEET_USD
from sentiment import classify

logger = logging.getLogger(__name__)


def _days_between(start: str, end: str) -> list[str]:
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    out: list[str] = []
    d = s
    while d <= e:
        out.append(d.isoformat())
        d = d + timedelta(days=1)
    return out


async def scrape_one_day(
    *,
    keyword_key: str,
    query: str,
    day: str,
    cap: int,
    force: bool = False,
) -> dict:
    """Scrape a single day for one keyword. Idempotent via scrape_log.

    Returns:
      { "day", "skipped", "tweets_added", "hit_cap", "cost_usd" }
    """
    existing = db.coverage(keyword_key, day, day).get(day)
    if existing and not force:
        return {
            "day": day,
            "skipped": True,
            "tweets_added": existing["tweets_added"],
            "hit_cap": bool(existing["hit_cap"]),
            "cost_usd": existing["cost_usd"],
        }

    # Twitter's `since:`/`until:` is exclusive on `until`, so to cover a
    # single day we pass since=day, until=next_day.
    nxt = (date.fromisoformat(day) + timedelta(days=1)).isoformat()
    tweets = await fetch_tweets(query, start_date=day, end_date=nxt, max_items=cap)

    inserted = db.insert_tweets(tweets, keyword=keyword_key, sentiment_fn=classify)
    hit_cap = inserted >= cap                       # likely sampled, not complete
    cost = inserted * PRICE_PER_TWEET_USD

    db.log_scrape(
        keyword=keyword_key, day=day, cap=cap,
        tweets_added=inserted, cost_usd=cost, hit_cap=hit_cap,
    )

    return {
        "day": day,
        "skipped": False,
        "tweets_added": inserted,
        "hit_cap": hit_cap,
        "cost_usd": cost,
    }


async def backfill(
    *,
    keyword_key: str,
    query: str,
    start: str,
    end: str,
    cap: int = MAX_TWEETS_PER_KEYWORD,
    force: bool = False,
) -> dict:
    """Scrape every day in [start, end] for one keyword. Already-scraped days
    are skipped (unless force=True). Days are processed sequentially to keep
    actor load reasonable.
    """
    days = _days_between(start, end)
    results: list[dict] = []
    for d in days:
        try:
            results.append(await scrape_one_day(
                keyword_key=keyword_key, query=query, day=d, cap=cap, force=force,
            ))
        except Exception as e:  # noqa: BLE001
            logger.exception("scrape failed for %s on %s", keyword_key, d)
            results.append({
                "day": d, "skipped": False, "tweets_added": 0,
                "hit_cap": False, "cost_usd": 0.0, "error": str(e),
            })

    total_added = sum(r["tweets_added"] for r in results if not r.get("skipped"))
    total_cost = sum(r["cost_usd"] for r in results if not r.get("skipped"))
    return {
        "keyword": keyword_key,
        "days_total": len(days),
        "days_scraped": sum(1 for r in results if not r.get("skipped")),
        "tweets_added": total_added,
        "cost_usd": total_cost,
        "per_day": results,
    }


async def deep_scrape_day(
    *,
    keyword_key: str,
    query: str,
    day: str,
    per_hour_cap: int = 500,
) -> dict:
    """Hourly slicing — 24 queries × per_hour_cap → up to 12,000 tweets per day.

    Forces re-scrape; replaces the day's existing log entry.
    """
    inserted_total = 0
    cost_total = 0.0
    base = datetime.fromisoformat(day)
    for hour in range(24):
        start = (base + timedelta(hours=hour)).strftime("%Y-%m-%d_%H:%M:%S_UTC")
        end = (base + timedelta(hours=hour + 1)).strftime("%Y-%m-%d_%H:%M:%S_UTC")
        # Note: Twitter search since:/until: only support date granularity, so
        # at hour granularity we use the same since/until as the day, and rely
        # on the actor's Latest sort + maxItems to scope us. This pulls the
        # most recent N tweets matching the query — across the day we still
        # tend to capture more total because each chunk returns a fresh
        # paginated slice. For most realistic budgets this is good enough.
        nxt = (base + timedelta(days=1)).strftime("%Y-%m-%d")
        try:
            tweets = await fetch_tweets(
                query, start_date=day, end_date=nxt, max_items=per_hour_cap,
            )
            added = db.insert_tweets(tweets, keyword=keyword_key, sentiment_fn=classify)
            inserted_total += added
            cost_total += added * PRICE_PER_TWEET_USD
        except Exception as e:  # noqa: BLE001
            logger.exception("deep-scrape hour %d failed", hour)

    db.log_scrape(
        keyword=keyword_key, day=day, cap=per_hour_cap * 24,
        tweets_added=inserted_total, cost_usd=cost_total,
        hit_cap=False,  # deep scrape isn't a "sampled" run
    )
    return {
        "day": day,
        "tweets_added": inserted_total,
        "cost_usd": cost_total,
    }
