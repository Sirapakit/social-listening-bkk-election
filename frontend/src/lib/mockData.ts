import type {
  BackfillResponse,
  HistoryResponse,
  KeywordCoverage,
  KeywordResult,
  PresetsResponse,
  TimelinePoint,
  TopPost,
  Influencer,
} from "./types";

export const MOCK_PRESETS: PresetsResponse = {
  presets: {
    chadchart: { label: "ชัชชาติ", color: "#3b82f6", query: "ชัชชาติ กรุงเทพ 2026" },
    sakoltee:  { label: "สกลธี",    color: "#ef4444", query: "สกลธี กรุงเทพ 2026" },
    pol:       { label: "พล.ต.อ.วิเชียร", color: "#f59e0b", query: "วิเชียร กรุงเทพ 2026" },
    bkk2026:   { label: "เลือกตั้ง กทม.", color: "#8b5cf6", query: "เลือกตั้งกรุงเทพ 2026" },
  },
  default_start_date: "2026-05-01",
  today: "2026-05-17",
  max_tweets_per_keyword: 2000,
  price_per_tweet_usd: 0.00025,
  schedule: { hour: 12, minute: 0, enabled: true },
};

// Deterministic daily tweet counts per keyword (17 days: May 1–17)
const DAILY_COUNTS: Record<string, number[]> = {
  chadchart: [820, 910, 780, 1050, 1200, 980, 870, 1100, 1320, 1180, 990, 1400, 1550, 1300, 1420, 1600, 1750],
  sakoltee:  [430, 520, 490, 600,  710,  580, 510, 690,  770,  720,  650, 890,  950,  820,  880,  960,  1020],
  pol:       [210, 240, 195, 310,  380,  290, 260, 340,  410,  390,  330, 480,  510,  450,  490,  530,  570],
  bkk2026:   [1100, 1250, 1050, 1380, 1600, 1300, 1150, 1450, 1700, 1580, 1350, 1900, 2050, 1750, 1900, 2100, 2300],
};

const START = "2026-05-01";
const DAYS  = 17;

function genTimeline(key: string): TimelinePoint[] {
  const counts = DAILY_COUNTS[key];
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(START + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    const date  = d.toISOString().split("T")[0];
    const count = counts[i];
    // sentiment split: positive skews by keyword
    const posFrac = key === "chadchart" ? 0.52 : key === "bkk2026" ? 0.38 : 0.42;
    const negFrac = key === "sakoltee"  ? 0.30 : 0.22;
    const positive  = Math.round(count * posFrac);
    const negative  = Math.round(count * negFrac);
    const neutral   = count - positive - negative;
    return { date, count, positive, neutral, negative };
  });
}

const MOCK_POSTS: Record<string, TopPost[]> = {
  chadchart: [
    {
      id: "mock-001",
      url: "https://x.com/i/status/mock001",
      text: "ชัชชาติลงพื้นที่ตรวจน้ำท่วมย่านลาดพร้าว พร้อมทีมงาน 200 คน วางแผนแก้ปัญหาระยะยาว 🌊 #กรุงเทพ2026",
      author: { username: "bkk_watcher", name: "Bangkok Watcher", followers: 85000, profile_picture: "", verified: true },
      engagement: { likes: 4200, retweets: 1800, replies: 320, quotes: 210, views: 180000 },
      sentiment: "positive",
      created_at: "2026-05-15T08:30:00Z",
    },
    {
      id: "mock-002",
      url: "https://x.com/i/status/mock002",
      text: "นโยบายรถไฟฟ้าฟรีของชัชชาติ ช่วยลดค่าใช้จ่ายชาวกรุงได้จริงไหม? ถกเถียงกันในทวิตเตอร์ #เลือกตั้งกทม",
      author: { username: "urban_th", name: "Urban Thailand", followers: 62000, profile_picture: "", verified: false },
      engagement: { likes: 2900, retweets: 1100, replies: 540, quotes: 180, views: 120000 },
      sentiment: "neutral",
      created_at: "2026-05-14T14:15:00Z",
    },
    {
      id: "mock-003",
      url: "https://x.com/i/status/mock003",
      text: "ผลสำรวจล่าสุด ชัชชาตินำโด่งด้วยคะแนน 48% เหนือคู่แข่งทุกคน ก่อนวันเลือกตั้งอีก 2 สัปดาห์",
      author: { username: "poll_thai", name: "Thai Poll Center", followers: 210000, profile_picture: "", verified: true },
      engagement: { likes: 6800, retweets: 3200, replies: 890, quotes: 420, views: 350000 },
      sentiment: "positive",
      created_at: "2026-05-13T09:00:00Z",
    },
  ],
  sakoltee: [
    {
      id: "mock-004",
      url: "https://x.com/i/status/mock004",
      text: "สกลธีเปิดตัวนโยบายกล้องวงจรปิด AI 50,000 จุดทั่วกรุงเทพ เพื่อความปลอดภัยของประชาชน #สกลธี",
      author: { username: "sec_news_th", name: "Security News TH", followers: 45000, profile_picture: "", verified: false },
      engagement: { likes: 1800, retweets: 720, replies: 280, quotes: 95, views: 78000 },
      sentiment: "positive",
      created_at: "2026-05-16T11:20:00Z",
    },
    {
      id: "mock-005",
      url: "https://x.com/i/status/mock005",
      text: "วิวาทะดุเดือด! สกลธีปะทะชัชชาติบนเวทีดีเบตคืนนี้ ใครเถียงชนะ? #ดีเบตกทม2026",
      author: { username: "debate_watch", name: "Debate Watch", followers: 33000, profile_picture: "", verified: false },
      engagement: { likes: 3100, retweets: 1400, replies: 960, quotes: 310, views: 145000 },
      sentiment: "neutral",
      created_at: "2026-05-12T21:45:00Z",
    },
  ],
  pol: [
    {
      id: "mock-006",
      url: "https://x.com/i/status/mock006",
      text: "พล.ต.อ.วิเชียรประกาศนโยบายตำรวจชุมชน 1 ท้องที่ 1 นายตำรวจ แก้ปัญหาความปลอดภัยกรุงเทพ",
      author: { username: "polnews_bkk", name: "Police News BKK", followers: 28000, profile_picture: "", verified: false },
      engagement: { likes: 950, retweets: 380, replies: 140, quotes: 55, views: 42000 },
      sentiment: "neutral",
      created_at: "2026-05-11T10:00:00Z",
    },
  ],
  bkk2026: [
    {
      id: "mock-007",
      url: "https://x.com/i/status/mock007",
      text: "เปิดจุดลงทะเบียนเลือกตั้งผู้ว่าฯ กทม. 2026 ทั่วกรุงเทพ ตรวจสอบสิทธิ์ได้แล้ววันนี้ #เลือกตั้งกทม2026",
      author: { username: "ect_thailand", name: "กกต. ประชาสัมพันธ์", followers: 580000, profile_picture: "", verified: true },
      engagement: { likes: 12000, retweets: 8500, replies: 1200, quotes: 850, views: 920000 },
      sentiment: "neutral",
      created_at: "2026-05-17T06:00:00Z",
    },
    {
      id: "mock-008",
      url: "https://x.com/i/status/mock008",
      text: "ทำไมการเลือกตั้งผู้ว่าฯ กทม. ครั้งนี้ถึงสำคัญที่สุดในรอบ 10 ปี? Thread 🧵 #เลือกตั้งกทม",
      author: { username: "civic_thai", name: "Civic Thailand", followers: 125000, profile_picture: "", verified: true },
      engagement: { likes: 7800, retweets: 4200, replies: 680, quotes: 390, views: 480000 },
      sentiment: "neutral",
      created_at: "2026-05-10T13:30:00Z",
    },
  ],
};

const MOCK_INFLUENCERS: Influencer[] = [
  { username: "bkk_watcher",  name: "Bangkok Watcher",       followers: 85000,  profile_picture: "", verified: true,  tweets: 28, engagement: 48200 },
  { username: "urban_th",     name: "Urban Thailand",         followers: 62000,  profile_picture: "", verified: false, tweets: 19, engagement: 31500 },
  { username: "poll_thai",    name: "Thai Poll Center",       followers: 210000, profile_picture: "", verified: true,  tweets: 12, engagement: 82000 },
  { username: "civic_thai",   name: "Civic Thailand",         followers: 125000, profile_picture: "", verified: true,  tweets: 22, engagement: 61000 },
  { username: "debate_watch", name: "Debate Watch",           followers: 33000,  profile_picture: "", verified: false, tweets: 35, engagement: 29000 },
  { username: "sec_news_th",  name: "Security News TH",       followers: 45000,  profile_picture: "", verified: false, tweets: 17, engagement: 22000 },
  { username: "ect_thailand", name: "กกต. ประชาสัมพันธ์",      followers: 580000, profile_picture: "", verified: true,  tweets: 8,  engagement: 148000 },
  { username: "polnews_bkk",  name: "Police News BKK",        followers: 28000,  profile_picture: "", verified: false, tweets: 14, engagement: 18000 },
];

function buildKeywordResult(
  key: string,
  label: string,
  color: string,
): KeywordResult {
  const timeline = genTimeline(key);
  const totalTweets    = timeline.reduce((s, p) => s + p.count, 0);
  const totalPositive  = timeline.reduce((s, p) => s + p.positive, 0);
  const totalNeutral   = timeline.reduce((s, p) => s + p.neutral, 0);
  const totalNegative  = timeline.reduce((s, p) => s + p.negative, 0);

  const reachMult = key === "bkk2026" ? 320 : key === "chadchart" ? 280 : 190;
  const totalReach = totalTweets * reachMult;

  const shareMap: Record<string, number> = { chadchart: 0.42, sakoltee: 0.22, pol: 0.09, bkk2026: 0.27 };

  return {
    keyword: key,
    label,
    color,
    window: { start: START, end: "2026-05-17" },
    totals: {
      tweets:     totalTweets,
      reach:      totalReach,
      engagement: Math.round(totalTweets * 4.2),
      likes:      Math.round(totalTweets * 2.8),
      retweets:   Math.round(totalTweets * 0.9),
      replies:    Math.round(totalTweets * 0.4),
      views:      totalReach * 3,
    },
    sentiment: { positive: totalPositive, neutral: totalNeutral, negative: totalNegative },
    timeline,
    top_posts:        MOCK_POSTS[key] ?? [],
    top_influencers:  MOCK_INFLUENCERS.slice(0, 6),
    top_hashtags: [
      { tag: `#${label.replace(/\s/g, "")}`,   count: Math.round(totalTweets * 0.35) },
      { tag: "#เลือกตั้งกทม",                    count: Math.round(totalTweets * 0.28) },
      { tag: "#กรุงเทพ2026",                     count: Math.round(totalTweets * 0.22) },
      { tag: "#ผู้ว่าฯกทม",                      count: Math.round(totalTweets * 0.18) },
      { tag: "#ดีเบตกทม2026",                    count: Math.round(totalTweets * 0.12) },
      { tag: "#BangkokElection",                count: Math.round(totalTweets * 0.09) },
    ],
    top_words: [
      { word: "กรุงเทพ",   count: Math.round(totalTweets * 0.68) },
      { word: "นโยบาย",    count: Math.round(totalTweets * 0.55) },
      { word: "เลือกตั้ง", count: Math.round(totalTweets * 0.48) },
      { word: "ผู้ว่าฯ",   count: Math.round(totalTweets * 0.42) },
      { word: label,        count: Math.round(totalTweets * 0.38) },
    ],
    share_of_voice: shareMap[key] ?? 0,
  };
}

const KEYWORDS = [
  { key: "chadchart", label: "ชัชชาติ",           color: "#3b82f6" },
  { key: "sakoltee",  label: "สกลธี",              color: "#ef4444" },
  { key: "pol",       label: "พล.ต.อ.วิเชียร",    color: "#f59e0b" },
  { key: "bkk2026",   label: "เลือกตั้ง กทม.",     color: "#8b5cf6" },
];

function buildCoverage(): Record<string, KeywordCoverage> {
  const result: Record<string, KeywordCoverage> = {};
  for (const { key } of KEYWORDS) {
    const counts = DAILY_COUNTS[key];
    const days = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(START + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      const day    = d.toISOString().split("T")[0];
      const tweets = counts[i];
      // last 2 days sampled, rest complete
      const status = i >= DAYS - 2 ? "sampled" : "complete";
      return { day, status: status as "complete" | "sampled", tweets, hit_cap: tweets >= 1900, cost: tweets * 0.00025 };
    });
    const totals = {
      tweets:   days.reduce((s, d) => s + d.tweets, 0),
      cost_usd: days.reduce((s, d) => s + d.cost, 0),
      missing:  0,
      sampled:  2,
      complete: DAYS - 2,
    };
    result[key] = { keyword: key, days, totals };
  }
  return result;
}

export const MOCK_HISTORY: HistoryResponse = {
  window:   { start: START, end: "2026-05-17" },
  results:  KEYWORDS.map(({ key, label, color }) => buildKeywordResult(key, label, color)),
  coverage: buildCoverage(),
};

export const MOCK_BACKFILL: BackfillResponse = {
  window: { start: START, end: "2026-05-17" },
  cap: 2000,
  summaries: KEYWORDS.map(({ key, label }) => ({
    keyword:      label,
    days_total:   DAYS,
    days_scraped: DAYS,
    tweets_added: DAILY_COUNTS[key].reduce((s, n) => s + n, 0),
    cost_usd:     DAILY_COUNTS[key].reduce((s, n) => s + n * 0.00025, 0),
    per_day: [],
  })),
  total_cost_usd: 4.8,
};
