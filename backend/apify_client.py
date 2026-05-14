"""Thin wrapper around the Apify run-sync-get-dataset-items API.

Default actor: `kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest`
- $0.25 / 1k tweets, pay-per-result, no rate limits.
- Input field is `twitterContent` (string), NOT `searchTerms` (array).
- Date range is best expressed inside the query via Twitter's native
  `since:YYYY-MM-DD until:YYYY-MM-DD` operators — that filters server-side
  before pagination, which the actor honours.

Docs:
- https://docs.apify.com/api/v2#/reference/actors/run-actor-synchronously-and-get-dataset-items
- Actor: https://apify.com/kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from config import APIFY_ACTOR_ID, APIFY_API_TOKEN, MAX_TWEETS_PER_KEYWORD

logger = logging.getLogger(__name__)

_ACTOR_PATH = APIFY_ACTOR_ID.replace("/", "~")
_RUN_SYNC_URL = (
    f"https://api.apify.com/v2/acts/{_ACTOR_PATH}/run-sync-get-dataset-items"
)


def _build_query(query: str, start_date: str, end_date: str) -> str:
    """Inject Twitter `since:` / `until:` operators into the user query."""
    parts: list[str] = []
    if query:
        # If the user's query already has multiple OR terms, wrap so the
        # since/until apply to the whole thing.
        if " OR " in query and not (query.startswith("(") and query.endswith(")")):
            parts.append(f"({query})")
        else:
            parts.append(query)
    if start_date:
        parts.append(f"since:{start_date}")
    if end_date:
        parts.append(f"until:{end_date}")
    return " ".join(parts)


def _build_input(full_query: str, max_items: int) -> dict[str, Any]:
    return {
        "twitterContent": full_query,
        "maxItems": max_items,
        "sort": "Latest",
    }


async def fetch_tweets(
    query: str,
    start_date: str,
    end_date: str,
    max_items: int | None = None,
) -> list[dict[str, Any]]:
    """Run the actor synchronously and return real tweet dicts (sentinel
    `noResults` records are filtered out).

    Raises httpx.HTTPStatusError on non-2xx.
    """
    if not APIFY_API_TOKEN:
        raise RuntimeError(
            "APIFY_API_TOKEN missing — check the .env at project root."
        )

    cap = max_items if max_items is not None else MAX_TWEETS_PER_KEYWORD
    cap = min(cap, MAX_TWEETS_PER_KEYWORD)  # hard cost guard

    full_query = _build_query(query, start_date, end_date)
    payload = _build_input(full_query, cap)
    params = {"token": APIFY_API_TOKEN, "clean": "true"}

    logger.info("Apify call query=%r cap=%d", full_query, cap)

    # Apify sync calls can take a while for large scrapes — generous timeout.
    timeout = httpx.Timeout(connect=15.0, read=300.0, write=30.0, pool=15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(_RUN_SYNC_URL, params=params, json=payload)
        resp.raise_for_status()
        data = resp.json()

    if not isinstance(data, list):
        logger.warning("Unexpected Apify response shape: %r", data)
        return []

    real = [t for t in data if _is_real_tweet(t)]
    dropped = len(data) - len(real)
    logger.info(
        "Apify returned %d items (%d real, %d sentinel) for %r",
        len(data), len(real), dropped, full_query,
    )
    return real


# --- sentinel filtering ------------------------------------------------------
# KaitoEasyAPI's actor injects billing-notice rows when your query produces
# zero real hits — they have an empty author and identical canned text.
# Older apidojo behavior was a `{noResults: true}` flag. Drop both shapes.
_SENTINEL_TEXT_PREFIXES = (
    "from kaitoeasyapi",
    "our api pricing is based on",
)


def _is_real_tweet(t: dict[str, Any]) -> bool:
    if t.get("noResults"):
        return False
    text = (t.get("text") or t.get("fullText") or "").strip()
    if not text:
        return False
    lower = text.lower()
    if any(p in lower for p in _SENTINEL_TEXT_PREFIXES):
        return False
    # KaitoEasyAPI sentinels also have no author at all — real tweets always
    # carry an author dict with at least a username.
    author = t.get("author") or {}
    if not (author.get("userName") or author.get("username") or author.get("screen_name")):
        return False
    return True
