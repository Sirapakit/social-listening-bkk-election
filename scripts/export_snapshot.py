#!/usr/bin/env python3
"""Export a clean, compressed snapshot of the live DB for hand-off.

Produces  backend/seed/snapshots.db.gz  — a VACUUM'd (consistent, compact,
WAL-checkpointed) copy of  backend/data/snapshots.db, gzipped so it can be
committed straight into the repo and shipped to whoever deploys.

Run this AFTER scraping, then commit the .gz:

    .venv/bin/python scripts/export_snapshot.py
    git add backend/seed/snapshots.db.gz
    git commit -m "data: refresh snapshot"
    git push

Safe to run while the dev backend is up — SQLite WAL allows a concurrent reader.
"""
from __future__ import annotations

import gzip
import shutil
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "backend" / "data" / "snapshots.db"
SEED_DIR = ROOT / "backend" / "seed"
OUT_GZ = SEED_DIR / "snapshots.db.gz"
# Transient clean copy. Lives under backend/data/ which is gitignored, so it
# can never be committed by accident even if something fails mid-run.
TMP = ROOT / "backend" / "data" / ".export.clean.db"


def main() -> int:
    if not SRC.exists():
        print(f"✗ source DB not found: {SRC}", file=sys.stderr)
        print("  Did you scrape yet? Run the backfill on the dashboard first.", file=sys.stderr)
        return 1

    SEED_DIR.mkdir(parents=True, exist_ok=True)
    if TMP.exists():
        TMP.unlink()

    # 1) Consistent, compact single-file copy (checkpoints WAL, drops free pages).
    src = sqlite3.connect(str(SRC))
    try:
        target = str(TMP).replace("'", "''")
        try:
            src.execute(f"VACUUM INTO '{target}'")
        except sqlite3.OperationalError:
            # Fallback for SQLite < 3.27 (no VACUUM INTO): online backup API.
            dst = sqlite3.connect(str(TMP))
            try:
                src.backup(dst)
            finally:
                dst.close()
    finally:
        src.close()

    # 2) Verify what's inside the clean copy.
    clean = sqlite3.connect(str(TMP))
    try:
        tweets = clean.execute("SELECT COUNT(*) FROM tweets").fetchone()[0]
        days = clean.execute("SELECT COUNT(*) FROM scrape_log").fetchone()[0]
        cost = clean.execute("SELECT COALESCE(SUM(cost_usd), 0) FROM scrape_log").fetchone()[0]
    finally:
        clean.close()

    # 3) Gzip → committable seed.
    with open(TMP, "rb") as f_in, gzip.open(OUT_GZ, "wb", compresslevel=9) as f_out:
        shutil.copyfileobj(f_in, f_out)
    TMP.unlink()

    raw_mb = SRC.stat().st_size / 1048576
    gz_mb = OUT_GZ.stat().st_size / 1048576
    print("✓ snapshot exported")
    print(f"  tweets         : {tweets:,}")
    print(f"  days logged    : {days:,}")
    print(f"  total cost (DB): ${cost:.4f}")
    print(f"  raw DB         : {raw_mb:.2f} MB")
    print(f"  seed (gzip)    : {gz_mb:.2f} MB  → {OUT_GZ.relative_to(ROOT)}")
    print()
    print("Next:")
    print("  git add backend/seed/snapshots.db.gz")
    print('  git commit -m "data: refresh snapshot"')
    print("  git push")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
