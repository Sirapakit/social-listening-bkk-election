"""Reduce a list of raw Apify tweet dicts into the metrics the dashboard needs.

Output schema (returned by `aggregate`):

```
{
  "keyword": "...",
  "label": "...",
  "color": "#...",
  "totals": {
      "tweets": int,            # buzz
      "reach": int,             # sum of author followers (de-duped per author)
      "engagement": int,        # likes + retweets + replies + quotes
      "likes": int,
      "retweets": int,
      "replies": int,
      "views": int,
  },
  "sentiment": { "positive": int, "neutral": int, "negative": int },
  "timeline": [ { "date": "YYYY-MM-DD", "count": int,
                  "positive": int, "neutral": int, "negative": int } ],
  "top_posts": [ {id, url, text, author, followers, likes, retweets,
                  replies, views, sentiment, created_at } ],
  "top_influencers": [ {username, name, followers, tweets, engagement,
                        profile_picture, verified} ],
  "top_hashtags": [ {tag, count} ],
  "top_words": [ {word, count} ]
}
```
"""
from __future__ import annotations

import logging
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

from sentiment import classify

logger = logging.getLogger(__name__)


# --- helpers ------------------------------------------------------------------
def _get(d: dict, *keys, default=None):
    """Return the first non-None value from a list of candidate keys."""
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return default


def _parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        # Try ISO 8601 first, then Twitter's legacy format.
        for parser in (
            lambda s: datetime.fromisoformat(s.replace("Z", "+00:00")),
            lambda s: datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y"),
        ):
            try:
                return parser(value)
            except (ValueError, TypeError):
                continue
    return None


def _author(tweet: dict) -> dict:
    """Extract a normalized author dict from any of Apify's nested shapes."""
    a = tweet.get("author") or tweet.get("user") or {}
    return {
        "username": _get(a, "userName", "username", "screen_name", default=""),
        "name": _get(a, "name", "fullName", default=""),
        "followers": int(_get(a, "followers", "followersCount", "followers_count", default=0) or 0),
        "profile_picture": _get(a, "profilePicture", "profile_image_url", "avatar", default=""),
        "verified": bool(_get(a, "verified", "isVerified", default=False)),
    }


def _engagement(tweet: dict) -> dict:
    return {
        "likes": int(_get(tweet, "likeCount", "favorite_count", "likes", default=0) or 0),
        "retweets": int(_get(tweet, "retweetCount", "retweet_count", "retweets", default=0) or 0),
        "replies": int(_get(tweet, "replyCount", "reply_count", "replies", default=0) or 0),
        "quotes": int(_get(tweet, "quoteCount", "quote_count", default=0) or 0),
        "views": int(_get(tweet, "viewCount", "views", "impression_count", default=0) or 0),
    }


# --- word/hashtag extraction --------------------------------------------------
_URL_RE = re.compile(r"https?://\S+")
_MENTION_RE = re.compile(r"@\w+")
_HASHTAG_RE = re.compile(r"#[\wก-๙]+", re.UNICODE)

# Thai stopwords — small curated set focused on political tweets.
_STOPWORDS = {
    "และ", "ที่", "เป็น", "ของ", "ใน", "ได้", "ไม่", "มี", "ให้", "จะ",
    "ก็", "แต่", "ว่า", "การ", "ความ", "ก็", "ไป", "มา", "นี้", "นั้น",
    "เพราะ", "หรือ", "ถ้า", "ครับ", "ค่ะ", "นะ", "อยู่", "เลย", "แล้ว",
    "กับ", "จาก", "ถึง", "บน", "ต่อ", "ตาม", "ทุก", "อย่าง", "เรา", "คุณ",
    "ผม", "เขา", "เธอ", "มัน", "พวก", "เอง", "ด้วย", "เท่า", "เพียง", "อีก",
    "ก่อน", "หลัง", "ระหว่าง", "ที่สุด", "มาก", "น้อย", "ๆ", "rt", "the",
    "a", "to", "of", "is", "in", "and", "for", "on", "this", "that", "it",
}


def _tokens(text: str) -> list[str]:
    """Tokenize Thai+English text using PyThaiNLP; fall back gracefully."""
    try:
        from pythainlp.tokenize import word_tokenize  # noqa: WPS433

        toks = word_tokenize(text, engine="newmm")
    except Exception:
        toks = re.findall(r"[ก-๙]+|[A-Za-z]+", text)
    out: list[str] = []
    for t in toks:
        t = t.strip().lower()
        if len(t) < 2:
            continue
        if t in _STOPWORDS:
            continue
        if t.startswith(("http", "@", "#")):
            continue
        if not re.search(r"[ก-๙A-Za-z]", t):
            continue
        out.append(t)
    return out


# --- main aggregator ---------------------------------------------------------
def aggregate(
    tweets: list[dict],
    *,
    keyword: str,
    label: str,
    color: str,
    start_date: str,
    end_date: str,
) -> dict:
    totals = {
        "tweets": 0,
        "reach": 0,
        "engagement": 0,
        "likes": 0,
        "retweets": 0,
        "replies": 0,
        "views": 0,
    }
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    timeline: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "positive": 0, "neutral": 0, "negative": 0}
    )
    influencer_stats: dict[str, dict] = defaultdict(
        lambda: {"tweets": 0, "engagement": 0}
    )
    seen_authors: dict[str, int] = {}  # username → followers (for reach dedup)
    hashtag_counter: Counter[str] = Counter()
    word_counter: Counter[str] = Counter()
    enriched: list[dict] = []

    for t in tweets:
        text = _get(t, "text", "fullText", "full_text", default="") or ""
        if not text:
            continue
        author = _author(t)
        eng = _engagement(t)
        dt = _parse_dt(_get(t, "createdAt", "created_at", "date"))
        date_key = dt.strftime("%Y-%m-%d") if dt else "unknown"

        # Prefer cached sentiment (set by db.get_tweets) to avoid re-classifying.
        senti = t.get("_cached_sentiment") or classify(text)

        totals["tweets"] += 1
        totals["engagement"] += eng["likes"] + eng["retweets"] + eng["replies"] + eng["quotes"]
        totals["likes"] += eng["likes"]
        totals["retweets"] += eng["retweets"]
        totals["replies"] += eng["replies"]
        totals["views"] += eng["views"]
        sentiment_counts[senti] += 1

        timeline[date_key]["count"] += 1
        timeline[date_key][senti] += 1

        username = author["username"]
        if username:
            # Dedup reach: count each author's followers once
            if username not in seen_authors:
                seen_authors[username] = author["followers"]
            inf = influencer_stats[username]
            inf["tweets"] += 1
            inf["engagement"] += eng["likes"] + eng["retweets"] + eng["replies"]
            inf["_author"] = author  # stash for output

        # hashtags
        for tag in _HASHTAG_RE.findall(text):
            hashtag_counter[tag.lower()] += 1
        # words
        cleaned = _URL_RE.sub(" ", _MENTION_RE.sub(" ", _HASHTAG_RE.sub(" ", text)))
        for w in _tokens(cleaned):
            word_counter[w] += 1

        enriched.append({
            "id": str(_get(t, "id", "id_str", "tweetId", default="")),
            "url": _get(t, "url", "twitterUrl", default=""),
            "text": text,
            "author": author,
            "engagement": eng,
            "sentiment": senti,
            "created_at": dt.isoformat() if dt else None,
            "_score": eng["likes"] + eng["retweets"] * 2 + eng["replies"],
        })

    totals["reach"] = sum(seen_authors.values())

    # Sort timeline by date asc
    timeline_list = [
        {"date": k, **v}
        for k, v in sorted(timeline.items(), key=lambda kv: kv[0])
        if k != "unknown"
    ]

    # Top posts: top 10 by engagement score
    top_posts = sorted(enriched, key=lambda p: p["_score"], reverse=True)[:10]
    for p in top_posts:
        p.pop("_score", None)

    # Top influencers: top 10 by engagement on their tweets
    top_influencers = []
    for username, stats in influencer_stats.items():
        author = stats.pop("_author", {})
        top_influencers.append({
            "username": username,
            "name": author.get("name", ""),
            "followers": author.get("followers", 0),
            "profile_picture": author.get("profile_picture", ""),
            "verified": author.get("verified", False),
            "tweets": stats["tweets"],
            "engagement": stats["engagement"],
        })
    top_influencers.sort(key=lambda x: x["engagement"], reverse=True)
    top_influencers = top_influencers[:10]

    return {
        "keyword": keyword,
        "label": label,
        "color": color,
        "window": {"start": start_date, "end": end_date},
        "totals": totals,
        "sentiment": sentiment_counts,
        "timeline": timeline_list,
        "top_posts": top_posts,
        "top_influencers": top_influencers,
        "top_hashtags": [
            {"tag": tag, "count": n} for tag, n in hashtag_counter.most_common(20)
        ],
        "top_words": [
            {"word": w, "count": n} for w, n in word_counter.most_common(50)
        ],
    }
