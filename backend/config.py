"""Application configuration loaded from .env."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the project root (one level up from backend/)
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


APIFY_API_TOKEN: str = os.getenv("APIFY_API_TOKEN", "")
APIFY_ACTOR_ID: str = os.getenv("APIFY_ACTOR_ID", "apidojo/tweet-scraper")
MAX_TWEETS_PER_KEYWORD: int = int(os.getenv("MAX_TWEETS_PER_KEYWORD", "2000"))
DEFAULT_START_DATE: str = os.getenv("DEFAULT_START_DATE", "2026-05-01")
BACKEND_HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))

# kaitoeasyapi pricing: $0.25 per 1k tweets returned.
PRICE_PER_TWEET_USD: float = float(os.getenv("PRICE_PER_TWEET_USD", "0.00025"))

# Read-only mode: disables all scraping endpoints and the scheduler.
# Set READONLY_MODE=true to let external users view the dashboard without
# being able to trigger Apify runs (no API token required in this mode).
READONLY_MODE: bool = os.getenv("READONLY_MODE", "false").lower() == "true"


# Pre-defined candidate keyword bundles. The frontend will use these by default
# but the API accepts any string, so users can edit on the fly.
CANDIDATE_PRESETS: dict[str, dict] = {
    "chadchart": {
        "label": "ชัชชาติ",
        "color": "#0F3B1F",  # dark chadchart green
        "query": 'ชัชชาติ OR "ชัชชาติ สิทธิพันธุ์" OR @chadchart_trip OR #ชัชชาติ',
    },
    "drjoe": {
        "label": "ดร.โจ ชัยวัฒน์",
        "color": "#F26B2C",  # orange accent
        "query": '"ดร.โจ" OR "ชัยวัฒน์ สถาวรวิจิตร" OR @ChaiwatPublic OR #ดรโจ',
    },
}
