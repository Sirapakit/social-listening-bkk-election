"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

export type Lang = "th" | "en";

// ─── Translation map ────────────────────────────────────────────────────────
const th = {
  lang: "th" as Lang,

  // Header
  subtitle:       "2026 · กระแสทวีต, การเข้าถึง & ความรู้สึก",
  loaded:         "โหลดเมื่อ",
  auto:           "อัตโนมัติ",

  // Missing-days toast
  missingDays:      (n: number) => `ขาดข้อมูล ${n} วัน —`,
  missingDaysHint:  "คลิก Backfill เพื่อดึงข้อมูล",
  backfillNow:      "เติมข้อมูลเดี๋ยวนี้",
  dismiss:          "ปิด",

  // Error banner
  errorTitle:   "เกิดข้อผิดพลาด",
  errorTip:     "ตรวจสอบว่า backend กำลังทำงานที่",
  dismissError: "ปิดข้อผิดพลาด",

  // Backfill loading indicator
  scrapingTitle: "กำลังดึงข้อมูลทีละวัน…",
  scrapingDesc:  (n: number, start: string, end: string) =>
    `${n} คีย์เวิร์ด · ตั้งแต่ ${start} ถึง ${end} — วันที่ดึงแล้วจะข้ามโดยอัตโนมัติ`,

  // Empty state
  noDataTitle:    "ยังไม่มีข้อมูลในช่วงเวลานี้",
  noDataAction:   "เติมข้อมูล",
  noDataDesc:     (start: string, end: string) =>
    `คลิกปุ่มด้านบนเพื่อดึงข้อมูลทุกวันตั้งแต่ ${start} ถึง ${end}`,

  // Footer
  footerText: "ข้อมูลจาก Apify · วิเคราะห์ความเห็นด้วย PyThaiNLP · ประวัติข้อมูลใน SQLite",

  // ControlsBar
  queryPlaceholder: "คำค้นหา X.com — รองรับ OR, @, #",
  dateFrom:         "ตั้งแต่",
  dateTo:           "ถึง",
  tweetCap:         "จำนวนทวีต / วัน",
  maxLabel:         (n: number) => `สูงสุด ${n.toLocaleString()}`,
  costPreview:      "ประมาณค่าใช้จ่าย",
  perTweet:         (n: number) => `· $${n.toFixed(5)} ต่อทวีต`,
  costPerDay:       "ต่อวัน (วันนี้)",
  costBackfill:     (n: number) => `เติมข้อมูล ${n} วัน`,
  costDaily:        "ดึงข้อมูลอัตโนมัติ",
  capNote:          (kw: number, cap: number) => `${kw} คีย์เวิร์ด × ${cap.toLocaleString()} ทวีต`,
  idempotent:       "วันที่ดึงแล้วไม่คิดค่าใช้จ่าย",
  scheduleRuns:     (h: number) => `ทำงานทุกวันเวลา ${String(h).padStart(2, "0")}:00`,
  scheduleOff:      "ปิดการกำหนดเวลา",
  scrapeTodayBtn:   "ดึงข้อมูลวันนี้",
  backfillBtn:      (n: number) => `เติมข้อมูล ${n} วัน`,
  autoNote:         "เปิดหน้าจะดึงข้อมูลใหม่อัตโนมัติ วันที่ขาดจะดึงเมื่อเปิดเว็บ",
  dailyRefresh:     (h: number) => ` รีเฟรชรายวันเวลา ${String(h).padStart(2, "0")}:00`,

  // CoverageBar
  coverageTitle:    "ความครอบคลุม",
  clickForDetails:  "คลิกวันเพื่อดูรายละเอียด",
  statusComplete:   "ครบถ้วน",
  statusSampled:    "ถึงขีดจำกัด",
  statusMissing:    "ขาดข้อมูล",
  tweetsWord:       "ทวีต",
  noDataDay:        "ยังไม่มีข้อมูลวันนี้",
  useBackfill:      "ใช้ Backfill ด้านบน",
  deepScrapeBtn:    "ดึงข้อมูลเพิ่มวันนี้",
  deepScrapeNote:   (cost: number) => `24 ช่วงเวลา · สูงสุด 12,000 ทวีต · ~$${cost.toFixed(2)}`,

  // ShareOfVoice
  shareOfVoice: "ส่วนแบ่งกระแส",
  totalTweets:  (n: number) => `${n.toLocaleString()} ทวีตทั้งหมด`,

  // BuzzTimeline
  buzzTitle:    "กระแสตามเวลา",
  tweetsPerDay: "ทวีตต่อวัน",

  // TopPosts
  topPosts:     "โพสต์ยอดนิยม",
  byEngagement: "เรียงตาม engagement",
  noPosts:      "ยังไม่มีโพสต์",
  followersAbbr:"flws",

  // TopInfluencers
  topInfluencers: "อินฟลูเอนเซอร์ยอดนิยม",
  noData:         "ไม่มีข้อมูล",
  tweetSuffix:    (n: number) => `${n} ทวีต`,

  // KeywordPanel
  buzzMetric:       "กระแส (ทวีต)",
  reachMetric:      "การเข้าถึง",
  engagementMetric: "Engagement",
  viewsMetric:      "ยอดวิว",
  sovSuffix:        "% ส่วนแบ่ง",

  // HashtagCloud
  topHashtags: "แฮชแท็กยอดนิยม",
  noHashtags:  "ไม่มีแฮชแท็ก",

  // SentimentDonut
  sentPositive: "เชิงบวก",
  sentNeutral:  "กลางๆ",
  sentNegative: "เชิงลบ",
  sentLabel:    "เชิงบวก",
};

const en: typeof th = {
  lang: "en" as Lang,

  subtitle:      "2026 · X.com buzz, reach & sentiment",
  loaded:        "Loaded",
  auto:          "Auto",

  missingDays:      (n) => `${n} day${n === 1 ? "" : "s"} missing across keywords —`,
  missingDaysHint:  "click Backfill to fetch (idempotent).",
  backfillNow:      "Backfill now",
  dismiss:          "Dismiss",

  errorTitle:   "Something went wrong",
  errorTip:     "Tip: ensure the backend is running on",
  dismissError: "Dismiss error",

  scrapingTitle: "Scraping day-by-day…",
  scrapingDesc:  (n, start, end) =>
    `${n} keyword${n === 1 ? "" : "s"} · from ${start} to ${end}. Already-scraped days are skipped automatically.`,

  noDataTitle:  "No data yet for this window",
  noDataAction: "Backfill",
  noDataDesc:   (start, end) =>
    `above to scrape every day from ${start} to ${end}.`,

  footerText: "Data via Apify · Sentiment via lexicon on PyThaiNLP tokenizer · SQLite-backed history",

  queryPlaceholder: "X.com search query — supports OR, @, #",
  dateFrom:         "From",
  dateTo:           "To",
  tweetCap:         "Tweet cap / day",
  maxLabel:         (n) => `max ${n.toLocaleString()}`,
  costPreview:      "Cost preview",
  perTweet:         (n) => `· $${n.toFixed(5)} per tweet`,
  costPerDay:       "Per day (Scrape today)",
  costBackfill:     (n) => `Backfill ${n} day${n === 1 ? "" : "s"}`,
  costDaily:        "Daily auto-scrape",
  capNote:          (kw, cap) => `${kw} keywords × ${cap.toLocaleString()} cap`,
  idempotent:       "Idempotent — already-scraped days are free.",
  scheduleRuns:     (h) => `Runs at ${String(h).padStart(2, "0")}:00 every day`,
  scheduleOff:      "Schedule disabled",
  scrapeTodayBtn:   "Scrape today",
  backfillBtn:      (n) => `Backfill ${n} day${n === 1 ? "" : "s"}`,
  autoNote:         "Opens to fresh data automatically. Missing days are scraped on visit.",
  dailyRefresh:     (h) => ` Daily refresh at ${String(h).padStart(2, "0")}:00.`,

  coverageTitle:    "Coverage",
  clickForDetails:  "click a day for details",
  statusComplete:   "complete",
  statusSampled:    "sampled (hit cap)",
  statusMissing:    "missing",
  tweetsWord:       "tweets",
  noDataDay:        "No data yet for this day.",
  useBackfill:      "Use Backfill above.",
  deepScrapeBtn:    "Deep-scrape this day",
  deepScrapeNote:   (cost) => `24 hourly slices · up to 12,000 tweets · ~$${cost.toFixed(2)}`,

  shareOfVoice: "Share of voice",
  totalTweets:  (n) => `${n.toLocaleString()} total tweets`,

  buzzTitle:    "Buzz over time",
  tweetsPerDay: "tweets per day",

  topPosts:     "Top posts",
  byEngagement: "by engagement",
  noPosts:      "No posts yet",
  followersAbbr:"flws",

  topInfluencers: "Top influencers",
  noData:         "No data",
  tweetSuffix:    (n) => `tweet${n > 1 ? "s" : ""}`,

  buzzMetric:       "Buzz (tweets)",
  reachMetric:      "Reach (followers)",
  engagementMetric: "Engagement",
  viewsMetric:      "Views",
  sovSuffix:        "% SoV",

  topHashtags: "Top hashtags",
  noHashtags:  "No hashtags",

  sentPositive: "Positive",
  sentNeutral:  "Neutral",
  sentNegative: "Negative",
  sentLabel:    "positive",
};

export type Translations = typeof th;

// ─── Context ────────────────────────────────────────────────────────────────
const LangCtx = createContext<{
  t: Translations;
  lang: Lang;
  toggle: () => void;
}>({ t: th, lang: "th", toggle: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("th");
  const toggle = () => setLang((l) => (l === "th" ? "en" : "th"));
  const t = lang === "th" ? th : en;
  return <LangCtx.Provider value={{ t, lang, toggle }}>{children}</LangCtx.Provider>;
}

export function useT() {
  return useContext(LangCtx);
}
