# 🛠️ Improvement Plan — Chadchart Social Listening

This plan walks the dashboard from a single-snapshot prototype to a serious
election-monitoring tool, ranked by impact-per-hour-of-work.

---

## 🗺️ At a glance

| Phase | Focus | Effort | Status |
|---|---|---|---|
| **1**   | Historical persistence + day-by-day backfill | ~1 day | ⏳ next |
| **1.5** | Hands-off automation (auto-catchup + scheduler) | ~2 hours | ⏳ |
| **1.6** | Deep-scrape on demand (big-news-day escape hatch) | ~1 hour | ⏳ |
| **2**   | Better sentiment (Claude Haiku 4.5) | ~3 hours | ⌛ |
| **3** | RT dedup + sentiment-over-time chart | ~2 hours | ⌛ |
| **4** | More candidates + comparison summary banner | ~2 hours | ⌛ |
| **5** | Topic / policy extraction | ~2 hours | ⌛ |
| **6** | Spike detection + alerting | ~half a day | ⌛ |
| **7** | Bot / spam scoring | ~half a day | ⌛ |
| **8** | Multi-platform (FB / Threads / TikTok) | ~1–2 days each | ⌛ |
| **9** | Polish: word cloud, CSV export, mobile, deploy | as time permits | ⌛ |

---

## 1. Historical persistence + day-by-day backfill ⭐ **start here**

### Problem

Every Refresh is independent. We can't see *"buzz on May 5 vs May 10"* without
re-scraping each day. The current dashboard also only covers the **most recent
~3 days** because at `MAX TWEETS = 500`, the actor only paginates back that far
for popular keywords.

### Solution

Persist scraped tweets in **SQLite** + scrape **one day at a time** so coverage
is deterministic across the full date range.

#### Data model (`backend/data/snapshots.db`)

```sql
-- one row per unique tweet, deduplicated by tweet id
CREATE TABLE tweets (
  id            TEXT PRIMARY KEY,        -- twitter tweet id
  keyword       TEXT NOT NULL,           -- 'chadchart' / 'drjoe' / …
  author_user   TEXT,
  author_name   TEXT,
  followers     INTEGER,
  text          TEXT,
  likes         INTEGER,
  retweets      INTEGER,
  replies       INTEGER,
  quotes        INTEGER,
  views         INTEGER,
  sentiment     TEXT,                    -- pos/neu/neg from sentiment.py
  url           TEXT,
  created_at    TEXT,                    -- ISO 8601 UTC
  scraped_at    TEXT NOT NULL
);

-- fast queries by keyword + day
CREATE INDEX idx_tweets_keyword_date ON tweets (keyword, date(created_at));

-- record of what we've already scraped, so we never re-pay for the same day
CREATE TABLE scrape_log (
  keyword       TEXT NOT NULL,
  day           TEXT NOT NULL,           -- 'YYYY-MM-DD'
  scraped_at    TEXT NOT NULL,
  tweets_added  INTEGER NOT NULL,
  cost_usd      REAL NOT NULL,
  PRIMARY KEY (keyword, day)
);
```

#### New endpoints

```
POST /api/backfill            { keyword, start_date, end_date, max_per_day }
                              → loops day-by-day, only scraping days not in scrape_log
POST /api/scrape-today        { keyword }     ← incremental, cheap, run hourly
GET  /api/history             ?keyword=…&start=…&end=…
                              → reads from SQLite, no Apify call
GET  /api/coverage            → returns which days we have data for
```

#### Scraping algorithm

```python
async def backfill(keyword, start, end, max_per_day=500):
    for day in days_between(start, end):
        if scrape_log.has(keyword, day):
            continue                              # already done, skip
        tweets = await apify.fetch(
            query=f"{keyword.query} since:{day} until:{day + 1d}",
            max_items=max_per_day,
        )
        store_tweets(tweets, keyword=keyword.key)
        scrape_log.insert(keyword, day, len(tweets))
```

Idempotent — re-running a backfill is free if the days are already covered.

### 💰 Cost analysis

You pay **per tweet returned**, not per request. Hard cap per actor call is
`MAX_TWEETS_PER_KEYWORD` in `.env`. Day-by-day means one call per (keyword, day).

#### Realistic tweets/day estimates for this race

| Keyword | Quiet day | Normal day | Big-news day (debate, scandal) |
|---|---:|---:|---:|
| `ชัชชาติ` (incumbent, high attention) | 800 | 2,000–4,000 | 10,000–30,000 |
| `ดร.โจ` (challenger) | 300 | 1,000–2,500 | 5,000–15,000 |
| Niche hashtags | 30 | 100–400 | 500–2,000 |

#### Cost by `MAX_TWEETS_PER_KEYWORD` setting

Each cell assumes **2 candidates**, day-by-day scraping. *Realistic* numbers
discount busy-day saturation against quiet-day shortfall (only billed for
returned tweets).

| Cap | Coverage on a normal day | Coverage on a big-news day | 12-day backfill (max) | 12-day backfill (realistic) | Daily incremental (realistic) |
|---:|---|---|---:|---:|---:|
| **500** | most days **complete** | only last few hours | $3.00 | **~$2** | ~$0.20 / day → **~$6/mo** |
| **1,000** | nearly all days complete | last ~6 hours | $6.00 | **~$4** | ~$0.40 / day → **~$12/mo** |
| **2,000** ⭐ recommended | all normal days complete | last ~12 hours | $12.00 | **~$8** | ~$0.80 / day → **~$24/mo** |
| **5,000** | all days complete | most big days complete | $30.00 | **~$18** | ~$1.80 / day → **~$54/mo** |
| **10,000** | overkill — actor pagination caps near 2–3k anyway | same | $60.00 | ~$22 | ~$2.20 / day |

> ⚠️ **Hard ceiling:** The kaitoeasyapi actor's pagination usually fails past
> **~2,000–3,000 results per query** (Twitter search rate-limits kick in).
> Setting cap above ~3,000 won't actually return more tweets per day — you'd
> need hourly slicing (24 queries × 500 = 12,000/day) to go beyond, and that
> costs ~$3/day per keyword.

#### Per-tweet math, if you want to budget yourself

```
cost_per_day = min(actual_tweets, cap) × 2 candidates × $0.00025
             = min(actual_tweets, cap) × $0.0005
```

So **500 tweets/day each = $0.25/day**, and **2,000 tweets/day each = $1.00/day**.

> 💡 **Recommended setting:** `MAX_TWEETS_PER_KEYWORD = 2000`. Cost stays under
> $25/month and you get complete coverage on ~95% of days. Use the **"Deep
> scrape this day"** button (Phase 1.6) on big-news days where the dashboard
> warns you that sampling kicked in.

### Unlocked features (after #1 lands)

- 📈 Buzz momentum — today vs yesterday vs 7-day moving average
- 🔄 Sentiment trend — week-over-week shift per candidate
- 📊 Full-campaign timeline — every day from start of campaign to election day
- 🆕 Incremental scrapes — only fetch new tweets, never re-pay for old ones
- 🧮 Aggregations don't need re-scrape — change a keyword display label,
  redraw charts from cache, zero Apify cost
- 🔁 Replay any past day's dashboard state — useful for post-election analysis

### Deliverables

1. `backend/db.py` — SQLite setup, migrations, helpers
2. `backend/scraper.py` — day-loop wrapper around `apify_client.fetch_tweets`
3. New routes in `backend/main.py`: `/api/backfill`, `/api/scrape-today`,
   `/api/history`, `/api/coverage`
4. Frontend "Coverage" indicator showing which days we have data for, with
   ⚠️ marker on days where the cap was hit (sampled, not complete)
5. New "**Backfill**" button (does the day-by-day catch-up)
6. New "**Deep scrape this day**" button (hourly slicing on a single day)

---

## 1.5 Make scraping hands-off — automation tiers

You shouldn't have to manually click Refresh every day. There are three
ways to automate, from least effort to most reliable:

### Tier 1 — **Smart auto-catchup on dashboard load** (free, recommended)

When the dashboard loads, the frontend checks `/api/coverage` to see which
days are missing since the last scrape. If any are missing, it triggers
`/api/backfill` automatically to fill the gap.

**User experience:**
> Open the dashboard once a day → it scrapes the days you missed → done.
> If you forget for a week, the next open scrapes the past 7 days in one go.

- ✅ Zero infra. Works on plain `npm run dev`.
- ✅ User just opens the tab; never thinks about scheduling.
- ❌ Doesn't run if you never open the dashboard for a long stretch.

### Tier 2 — **APScheduler inside FastAPI** (5 min setup, robust while backend is up)

Add a background job to the backend that runs every day at 12:00 (or any
hour you like). Calls `/api/scrape-today` for every keyword.

```python
# backend/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()
scheduler.add_job(scrape_all_today, "cron", hour=12, minute=0,
                  id="daily-scrape", replace_existing=True)
scheduler.start()
```

**User experience:**
> Backend running → noon daily, all candidates auto-scrape. You see fresh
> data the next time you open the dashboard.

- ✅ Runs on a schedule, not just when you open the tab.
- ✅ Configured once in `.env`: `SCRAPE_SCHEDULE_HOUR=12`.
- ❌ Backend must be running at noon. If your Mac sleeps or you closed the
  terminal → the job is skipped.

### Tier 3 — **macOS `launchd` daily job** (15 min setup, most reliable)

A `~/Library/LaunchAgents/com.chadchart.scrape.plist` runs at noon every
day even if your terminal is closed. It can start the backend, hit the
endpoint, and stop the backend.

```xml
<key>StartCalendarInterval</key>
<dict>
  <key>Hour</key>  <integer>12</integer>
  <key>Minute</key><integer>0</integer>
</dict>
<key>ProgramArguments</key>
<array>
  <string>/bin/bash</string>
  <string>-lc</string>
  <string>cd ~/Documents/Social-Listenting-Chadchart &amp;&amp; ./scripts/daily-scrape.sh</string>
</array>
```

Where `scripts/daily-scrape.sh` does:
1. Boots `uvicorn` in the background if not already running
2. `curl -X POST http://127.0.0.1:8000/api/scrape-today` for each keyword
3. Optionally sends a LINE Notify summary

**User experience:**
> Mac is awake at noon → scrape happens silently → done. No app to open,
> no terminal to keep running.

- ✅ Runs even if you forgot the dashboard exists.
- ✅ Survives reboots (launchd reloads on login).
- ❌ Doesn't run when the Mac is asleep / closed lid. (Use Amphetamine /
  caffeinate to keep it awake at noon, or run on a cheap VPS.)
- ❌ Slightly more setup; a `make install-cron` target in the repo will
  hide the complexity.

### My recommendation — combine Tier 1 + Tier 2

| Component | Role |
|---|---|
| **Tier 1 (auto-catchup on load)** | Catches you up whenever you visit. Covers gaps from sleep / vacation. |
| **Tier 2 (APScheduler @ noon)** | Keeps data fresh on days you don't open the dashboard. |
| Tier 3 (launchd) | Only worth it if you want a fully autonomous setup (e.g. dashboard on a TV at the office). |

**Total user effort going forward: open the dashboard whenever you want
to look at numbers.** Everything else self-maintains.

### Deliverables for Phase 1.5

1. `backend/scheduler.py` — APScheduler integration, configurable via `.env`
2. Frontend boot logic: on mount, call `/api/coverage`, then auto-backfill
   missing days with a small toast notification
3. `scripts/daily-scrape.sh` + `scripts/install-launchd.sh` (optional Tier 3)
4. README section explaining the three tiers

---

## 1.6 Deep-scrape on demand (the big-news-day escape hatch)

The 2,000 cap occasionally misses tweets on heavy news days (debates,
scandals, etc.). For those days only, add a **"Deep scrape this day"** button:

- Splits the day into 24 hourly slices
- Runs 24 queries (500 each)
- Yields up to 12,000 tweets for that single day
- Costs ~$3 for two candidates

UI: appears as an action button next to any day in the timeline that's
marked ⚠️ sampled.

---

## 2. Better sentiment via Claude Haiku 4.5

### Problem

Lexicon catches obvious cases but misses:
- Sarcasm (`เก่งจังเลย คนนี้ 🙄`)
- Mixed sentiment (`ชอบนโยบายแต่ไม่ชอบคน`)
- Political context (jargon, irony, in-group references)
- Code-switching (Thai-English mixed sentences)

### Solution

Replace the body of `classify()` in `backend/sentiment.py` with a Claude Haiku
4.5 call. Same return type (`positive` / `neutral` / `negative`), so nothing
else changes.

**Bonus:** Claude can return *more than polarity* in one call:

```json
{
  "sentiment": "negative",
  "emotion": "frustration",
  "topics": ["transit", "BTS", "fares"],
  "intent": "criticism"
}
```

That feeds Phase 5 (topic extraction) for free.

### Cost

| Approach | Tokens / 50 tweets | Cost / 50 tweets | Cost / 500 tweets |
|---|---|---|---|
| One tweet per Claude call | ~200 in + 30 out | $0.005 | **$0.50** |
| **50 tweets batched + prompt caching** | ~3,000 in + 1,500 out | $0.010 | **$0.10** |
| Local lexicon (current) | — | — | $0 |

For ~$0.10 per refresh on top of Apify cost, the sentiment quality goes from
"OK-ish" to "publishable in a news article." Worth it.

### Caveat

Cache results in SQLite (`tweets.sentiment` column) so we never re-classify the
same tweet twice. After backfill, sentiment is essentially free going forward.

---

## 3. Retweet dedup + Sentiment-over-time chart

### 3a. RT / quote deduplication

**Problem:** A viral tweet retweeted 200 times shows as **200 tweets** in
"Buzz", inflating it. The reach metric is somewhat OK (followers are
de-duplicated by author), but Buzz is misleading.

**Solution:** In `aggregator.py`, group by `conversation_id` (or original tweet
id when quoted). Show:
- **Original posts** as the primary "Buzz" metric
- **Amplification** (RTs + quotes of those originals) as a secondary metric

### 3b. Sentiment-over-time chart

Add a small stacked-area chart per candidate showing how positive/neutral/negative
shifted day-by-day. **The data already exists** in `timeline[].positive/neutral/negative`
— just one new Recharts component.

Killer feature for election coverage:
> *"ดร.โจ's positive sentiment dropped 18% the day after the debate."*

---

## 4. Multiple candidates + Summary banner

### 4a. Support 3–5 candidates

Bangkok 2026 has more than two candidates (พรรคเพื่อไทย, ก้าวหน้า, อิสระ, …).
- Backend already accepts up to 4 keywords; bump to 6.
- Frontend: render keyword cards in a list with "**+ Add candidate**" /
  "**× Remove**" controls.

### 4b. Comparison summary banner

A one-line headline strip at the top of the dashboard:

> **ชัชชาติ** leads engagement by **34%** · **ดร.โจ** has **2×** more positive sentiment · `#เลือกตั้งกทม` spiked **+280%** today

Pulls from data already computed; just a new component.

---

## 5. Topic / policy extraction

What policies are people talking about per candidate?

- Transit / BTS / fares
- Flooding
- Housing
- Air quality (PM2.5)
- Corruption / transparency

Approach: same Claude Haiku call as Phase 2 returns `topics: [...]` per tweet.
Aggregate per candidate → "Top topics this week" panel.

Free upgrade once Phase 2 is in place.

---

## 6. Spike & anomaly detection + alerting

### Spike detection

Detect when a candidate's daily volume or sentiment swings >3σ vs 7-day mean.
Surface the **trigger tweet** that caused it (most-engaged tweet from that hour).

Requires Phase 1 (history).

### Alerting

LINE Notify / Discord webhook on spike events. Most useful in the final week
before election day.

---

## 7. Bot / spam scoring

Flag suspicious authors:
- Account created < 30 days ago
- Default profile pic / no profile pic
- Repetitive identical posts
- Follower / following ratio extremes
- All tweets posted within narrow time windows (cron-like)

Then:
- Filter them out of the "real reach" metric
- Show **"Share of voice from suspicious accounts"** as a separate panel
- Tag suspicious tweets in the top-posts list

Critical for election integrity coverage.

---

## 8. Multi-platform

X.com is one slice. Bangkok election conversations also live on:

| Platform | How to get data | Approx cost |
|---|---|---|
| **Facebook pages** | Apify `apify/facebook-pages-scraper` | $0.50 / 1k posts |
| **Threads** | Apify `apify/threads-scraper` | similar |
| **TikTok comments** | Apify `clockworks/tiktok-comments-scraper` | $0.50 / 1k |
| **YouTube comments** | YouTube Data API (free quota) | $0 |

Each platform = its own scraper + adapter in `backend/sources/<platform>.py`.
Reuse the same aggregator / sentiment / SQLite layer.

---

## 9. Polish & operations

### 9a. Word cloud
You already collect `top_words`. Render as a real sized cloud
(`react-wordcloud` or custom SVG). Easy visual win.

### 9b. CSV / JSON export
"Download" button per candidate → exports raw tweets + aggregates. For
journalists / analysts.

### 9c. Mobile responsive pass
Currently desktop-first. Test phone breakpoints, fix grid stacking.

### 9d. Docker compose
One `docker-compose up` runs frontend + backend + scheduler + SQLite volume.

### 9e. Public deploy
- Frontend → Vercel
- Backend → Railway / Fly.io
- GitHub OAuth so the team can view but only owners can refresh

### 9f. Auto-scheduled scrapes
APScheduler in backend OR cron-call to `/api/scrape-today` every 30 min.
Needed for live dashboards in the final election week.

### 9g. Better error handling
- Retry Apify on transient 5xx
- Partial-success indication if 1 of N keywords fails
- "Last successful scrape: X minutes ago" indicator

---

## 📅 Suggested execution order

```
Sprint 1 (1–2 days)
├── #1   Historical persistence + day-by-day backfill
├── #1.5 Auto-catchup on load + APScheduler @ noon
├── #1.6 Deep-scrape on demand
├── #2   Claude Haiku sentiment (with caching)
└── #3b  Sentiment-over-time chart          ← payoff visible in UI

Sprint 2 (1 day)
├── #3a RT dedup
├── #4  Multi-candidate + summary banner
└── #5  Topic extraction (free with #2 done)

Sprint 3 (1–2 days)
├── #6  Spike detection + LINE alerts
├── #7  Bot/spam scoring
└── #9f Auto-scheduled scrapes

Later
├── #8  Multi-platform (one platform per week)
└── #9  Polish + deploy
```

---

## 🎯 If you only have an afternoon

Do **Phase 1**. Persistence unlocks every other phase, and a one-shot ~$3
backfill of May 1–12 instantly turns your dashboard from "snapshot of last 3
days" into "full campaign history."
