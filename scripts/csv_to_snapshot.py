#!/usr/bin/env python3
"""Build snapshots_done.db.gz from processed_results.csv.

Reads processed_results.csv (already sentiment-classified), creates a fresh
SQLite DB with the same schema as snapshots.db, inserts all rows, then gzips
the result to backend/seed/snapshots_done.db.gz.

Usage:
    .venv/bin/python scripts/csv_to_snapshot.py

To commit the output:
    git add backend/seed/snapshots_done.db.gz
    git commit -m "data: add processed snapshot"
"""
from __future__ import annotations

import gzip
import shutil
import sqlite3
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CSV_IN = ROOT / "processed_results.csv"
SEED_DIR = ROOT / "backend" / "seed"
SEED_GZ = SEED_DIR / "snapshots.db.gz"
OUT_GZ = SEED_DIR / "snapshots_done.db.gz"
TMP = ROOT / "backend" / "data" / ".processed.tmp.db"
TMP_SEED = ROOT / "backend" / "data" / ".seed.tmp.db"

DDL = """
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
CREATE TABLE IF NOT EXISTS scrape_log (
    keyword       TEXT NOT NULL,
    day           TEXT NOT NULL,
    cap           INTEGER NOT NULL,
    tweets_added  INTEGER NOT NULL,
    cost_usd      REAL NOT NULL,
    hit_cap       INTEGER NOT NULL DEFAULT 0,
    scraped_at    TEXT NOT NULL,
    PRIMARY KEY (keyword, day)
);
CREATE INDEX IF NOT EXISTS idx_tweets_kw_date
    ON tweets (keyword, substr(created_at, 1, 10));
"""

TWEET_COLS = [
    "id", "keyword", "author_user", "author_name", "followers", "profile_pic",
    "verified", "text", "likes", "retweets", "replies", "quotes", "views",
    "sentiment", "url", "created_at", "scraped_at", "raw_json",
]


def main() -> int:
    if not CSV_IN.exists():
        print(f"✗ CSV not found: {CSV_IN}", file=sys.stderr)
        return 1
    if not SEED_GZ.exists():
        print(f"✗ seed snapshot not found: {SEED_GZ}", file=sys.stderr)
        return 1

    SEED_DIR.mkdir(parents=True, exist_ok=True)
    TMP.parent.mkdir(parents=True, exist_ok=True)
    for p in (TMP, TMP_SEED):
        if p.exists():
            p.unlink()

    # Decompress the seed DB so we can read scrape_log from it.
    with gzip.open(SEED_GZ, "rb") as f_in, open(TMP_SEED, "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)

    df = pd.read_csv(CSV_IN, dtype=str).fillna("")
    missing = [c for c in TWEET_COLS if c not in df.columns]
    if missing:
        print(f"✗ CSV is missing columns: {missing}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(TMP))
    try:
        conn.executescript(DDL)

        # tweets table — from processed CSV
        df[TWEET_COLS].to_sql(
            "tweets", conn,
            if_exists="replace",
            index=False,
            method="multi",
            chunksize=500,
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS pk_tweets ON tweets (id, keyword)"
        )

        # scrape_log table — copied from existing seed DB
        seed = sqlite3.connect(str(TMP_SEED))
        try:
            log_rows = seed.execute("SELECT * FROM scrape_log").fetchall()
        finally:
            seed.close()

        conn.executemany(
            "INSERT OR REPLACE INTO scrape_log "
            "(keyword, day, cap, tweets_added, cost_usd, hit_cap, scraped_at) "
            "VALUES (?,?,?,?,?,?,?)",
            log_rows,
        )
        conn.commit()

        tweet_count = conn.execute("SELECT COUNT(*) FROM tweets").fetchone()[0]
        log_count = conn.execute("SELECT COUNT(*) FROM scrape_log").fetchone()[0]
    finally:
        conn.close()

    TMP_SEED.unlink()

    with open(TMP, "rb") as f_in, gzip.open(OUT_GZ, "wb", compresslevel=9) as f_out:
        shutil.copyfileobj(f_in, f_out)
    TMP.unlink()

    gz_mb = OUT_GZ.stat().st_size / 1048576
    print("✓ snapshot exported")
    print(f"  tweets     : {tweet_count:,}")
    print(f"  scrape_log : {log_count:,}")
    print(f"  gzip       : {gz_mb:.2f} MB  → {OUT_GZ.relative_to(ROOT)}")
    print()
    print("Next:")
    print("  git add backend/seed/snapshots_done.db.gz")
    print('  git commit -m "data: add processed snapshot"')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
