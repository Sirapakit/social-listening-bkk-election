#!/usr/bin/env python3
"""Restore the committed seed snapshot into the live DB location.

gunzips  backend/seed/snapshots.db.gz  →  backend/data/snapshots.db

Run this once after cloning, before `docker compose up`. Uses only the Python
standard library, so the deployer needs nothing installed beyond Python 3.

    python3 scripts/restore_snapshot.py          # refuses to clobber existing data
    python3 scripts/restore_snapshot.py --force  # overwrite existing snapshots.db
"""
from __future__ import annotations

import gzip
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "backend" / "seed" / "snapshots.db.gz"
DEST_DIR = ROOT / "backend" / "data"
DEST = DEST_DIR / "snapshots.db"


def main(argv: list[str]) -> int:
    force = "--force" in argv
    if not SEED.exists():
        print(f"✗ seed not found: {SEED}", file=sys.stderr)
        print("  The repo should ship backend/seed/snapshots.db.gz — re-clone or ask the sender.", file=sys.stderr)
        return 1

    DEST_DIR.mkdir(parents=True, exist_ok=True)
    if DEST.exists() and not force:
        print(f"✗ {DEST.relative_to(ROOT)} already exists.", file=sys.stderr)
        print("  Pass --force to overwrite it with the seed.", file=sys.stderr)
        return 1

    with gzip.open(SEED, "rb") as f_in, open(DEST, "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)

    mb = DEST.stat().st_size / 1048576
    print(f"✓ restored {DEST.relative_to(ROOT)} ({mb:.2f} MB)")
    print()
    print("Next:")
    print('  echo "READONLY_MODE=true" > .env')
    print("  docker compose up --build")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
