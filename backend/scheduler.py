"""Daily auto-scrape via APScheduler. Wired into FastAPI's lifespan in main.py.

Reads the configured candidate presets and triggers `scraper.backfill` for
today only, so the dashboard always has fresh "today" data without the user
having to click anything.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

import scraper
from config import (
    CANDIDATE_PRESETS,
    MAX_TWEETS_PER_KEYWORD,
    SCRAPE_SCHEDULE_HOUR,
    SCRAPE_SCHEDULE_MIN,
)

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _scrape_all_today() -> None:
    today = date.today().isoformat()
    logger.info("[cron] starting daily scrape for %s", today)
    for key, preset in CANDIDATE_PRESETS.items():
        try:
            r = await scraper.backfill(
                keyword_key=key,
                query=preset["query"],
                start=today,
                end=today,
                cap=MAX_TWEETS_PER_KEYWORD,
                force=True,                          # always refresh today
            )
            logger.info("[cron] %s: +%d tweets ($%.4f)",
                        key, r["tweets_added"], r["cost_usd"])
        except Exception:
            logger.exception("[cron] failed for %s", key)


def start() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    if SCRAPE_SCHEDULE_HOUR < 0:
        logger.info("SCRAPE_SCHEDULE_HOUR=-1 → daily scrape disabled")
        return
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _scrape_all_today,
        CronTrigger(hour=SCRAPE_SCHEDULE_HOUR, minute=SCRAPE_SCHEDULE_MIN),
        id="daily-scrape",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Daily scrape scheduled at %02d:%02d local time",
                SCRAPE_SCHEDULE_HOUR, SCRAPE_SCHEDULE_MIN)


def shutdown() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
