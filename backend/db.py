"""SQLite persistence for scraped tweets and scrape bookkeeping.

Schema:
- `tweets`     — one row per (tweet_id, keyword). Same tweet can match multiple
                 keywords and will be stored once per keyword.
- `scrape_log` — bookkeeping: which (keyword, day) pairs we already scraped,
                 how many tweets, cost, and whether the result hit the cap
                 (i.e. was "sampled" rather than fully covered).

Idempotency: re-scraping the same day with the same cap is free for tweets we
already have (INSERT OR REPLACE on the PK), and the scrape_log lets the
backfill loop skip days already covered.
"""
from __future__ import annotations

import hashlib
import json
import logging
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent / "data" / "snapshots.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS tweets (
    id            TEXT NOT NULL,
    keyword       TEXT NOT NULL,
    author_user   TEXT,
    author_name   TEXT,
    followers     INTEGER DEFAULT 0,
    profile_pic   TEXT,
    verified      INTEGER DEFAULT 0,
    text          TEXT,
    likes         INTEGER DEFAULT 0,
    retweets      INTEGER DEFAULT 0,
    replies       INTEGER DEFAULT 0,
    quotes        INTEGER DEFAULT 0,
    views         INTEGER DEFAULT 0,
    sentiment     TEXT,
    url           TEXT,
    created_at    TEXT,
    scraped_at    TEXT NOT NULL,
    raw_json      TEXT,
    PRIMARY KEY (id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_tweets_kw_date
    ON tweets (keyword, substr(created_at, 1, 10));

CREATE TABLE IF NOT EXISTS scrape_log (
    keyword       TEXT NOT NULL,
    day           TEXT NOT NULL,             -- 'YYYY-MM-DD'
    cap           INTEGER NOT NULL,
    tweets_added  INTEGER NOT NULL,
    cost_usd      REAL NOT NULL,
    hit_cap       INTEGER NOT NULL DEFAULT 0, -- 1 if we likely sampled
    scraped_at    TEXT NOT NULL,
    PRIMARY KEY (keyword, day)
);
"""


def init() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.executescript(_SCHEMA)
    logger.info("DB initialised at %s", DB_PATH)


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH, isolation_level=None)  # autocommit
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    try:
        yield conn
    finally:
        conn.close()


# --- writes -------------------------------------------------------------------
def _stable_id(t: dict) -> str:
    """Return a stable id for a tweet, falling back to URL or text hash."""
    for k in ("id", "id_str", "tweetId"):
        v = t.get(k)
        if v not in (None, "", "-1", -1):
            return str(v)
    url = t.get("url") or t.get("twitterUrl")
    if url:
        return f"url:{url}"
    text = (t.get("text") or t.get("fullText") or "").strip()
    return "hash:" + hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]


def insert_tweets(
    tweets: list[dict],
    *,
    keyword: str,
    sentiment_fn,
) -> int:
    """Insert tweets for a given keyword. Returns number of rows actually
    written (INSERT OR REPLACE always 'succeeds'; we count it for the log).
    """
    if not tweets:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    rows: list[tuple] = []
    for t in tweets:
        author = t.get("author") or t.get("user") or {}
        text = t.get("text") or t.get("fullText") or ""
        rows.append((
            _stable_id(t),
            keyword,
            author.get("userName") or author.get("username") or author.get("screen_name") or "",
            author.get("name") or author.get("fullName") or "",
            int(author.get("followers") or author.get("followersCount") or 0),
            author.get("profilePicture") or author.get("profile_image_url") or "",
            1 if (author.get("verified") or author.get("isVerified")) else 0,
            text,
            int(t.get("likeCount") or t.get("favorite_count") or 0),
            int(t.get("retweetCount") or t.get("retweet_count") or 0),
            int(t.get("replyCount") or t.get("reply_count") or 0),
            int(t.get("quoteCount") or t.get("quote_count") or 0),
            int(t.get("viewCount") or t.get("views") or 0),
            sentiment_fn(text),
            t.get("url") or t.get("twitterUrl") or "",
            _normalize_dt(t.get("createdAt") or t.get("created_at") or t.get("date")),
            now,
            json.dumps(t, ensure_ascii=False),
        ))

    with _connect() as conn:
        conn.executemany(
            """
            INSERT OR REPLACE INTO tweets
              (id, keyword, author_user, author_name, followers, profile_pic,
               verified, text, likes, retweets, replies, quotes, views,
               sentiment, url, created_at, scraped_at, raw_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            rows,
        )
    return len(rows)


def log_scrape(
    *,
    keyword: str,
    day: str,
    cap: int,
    tweets_added: int,
    cost_usd: float,
    hit_cap: bool,
) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO scrape_log
              (keyword, day, cap, tweets_added, cost_usd, hit_cap, scraped_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (keyword, day, cap, tweets_added, cost_usd, int(hit_cap),
             datetime.now(timezone.utc).isoformat()),
        )


# --- reads --------------------------------------------------------------------
def get_tweets(keyword: str, start: str, end: str) -> list[dict]:
    """Return raw_json dicts for one keyword within [start, end] inclusive."""
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT raw_json, sentiment FROM tweets
            WHERE keyword = ?
              AND substr(created_at, 1, 10) >= ?
              AND substr(created_at, 1, 10) <= ?
            """,
            (keyword, start, end),
        ).fetchall()
    out: list[dict] = []
    for r in rows:
        try:
            d = json.loads(r["raw_json"])
        except Exception:
            continue
        # We re-attach the cached sentiment so aggregator doesn't re-classify.
        d["_cached_sentiment"] = r["sentiment"]
        out.append(d)
    return out


def coverage(keyword: str, start: str, end: str) -> dict[str, dict]:
    """Return per-day scrape log within [start, end] inclusive."""
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT day, cap, tweets_added, hit_cap, cost_usd, scraped_at
            FROM scrape_log
            WHERE keyword = ? AND day >= ? AND day <= ?
            ORDER BY day
            """,
            (keyword, start, end),
        ).fetchall()
    return {r["day"]: dict(r) for r in rows}


def missing_days(keyword: str, start: str, end: str) -> list[str]:
    """Days in [start, end] that have no scrape_log entry."""
    have = set(coverage(keyword, start, end).keys())
    return [d.isoformat() for d in _date_range(start, end) if d.isoformat() not in have]


# --- helpers ------------------------------------------------------------------
def _normalize_dt(value: Any) -> str:
    """Return ISO-8601 string for a flexible input. Empty string if unparseable."""
    if not value:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
        except Exception:
            return ""
    if isinstance(value, str):
        for parser in (
            lambda s: datetime.fromisoformat(s.replace("Z", "+00:00")),
            lambda s: datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y"),
        ):
            try:
                return parser(value).isoformat()
            except Exception:
                continue
    return ""


def _date_range(start: str, end: str) -> Iterable[date]:
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    d = s
    while d <= e:
        yield d
        d = date.fromisoformat((datetime.combine(d, datetime.min.time()).date()).isoformat())
        d = date.fromordinal(d.toordinal() + 1)
