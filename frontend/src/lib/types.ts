// Types mirror the FastAPI response shapes — keep in sync with backend/.

export interface KeywordSpec {
  key: string;
  label: string;
  query: string;
  color: string;
}

export interface Author {
  username: string;
  name: string;
  followers: number;
  profile_picture: string;
  verified: boolean;
}

export interface Engagement {
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  views: number;
}

export interface TopPost {
  id: string;
  url: string;
  text: string;
  author: Author;
  engagement: Engagement;
  sentiment: "positive" | "neutral" | "negative";
  created_at: string | null;
}

export interface Influencer {
  username: string;
  name: string;
  followers: number;
  profile_picture: string;
  verified: boolean;
  tweets: number;
  engagement: number;
}

export interface TimelinePoint {
  date: string;
  count: number;
  positive: number;
  neutral: number;
  negative: number;
}

export interface KeywordResult {
  keyword: string;
  label: string;
  color: string;
  window: { start: string; end: string };
  totals: {
    tweets: number;
    reach: number;
    engagement: number;
    likes: number;
    retweets: number;
    replies: number;
    views: number;
  };
  sentiment: { positive: number; neutral: number; negative: number };
  timeline: TimelinePoint[];
  top_posts: TopPost[];
  top_influencers: Influencer[];
  top_hashtags: { tag: string; count: number }[];
  top_words: { word: string; count: number }[];
  share_of_voice: number;
}

// --- coverage ---------------------------------------------------------------
export type CoverageStatus = "missing" | "sampled" | "complete";

export interface DayCoverage {
  day: string;          // YYYY-MM-DD
  status: CoverageStatus;
  tweets: number;
  hit_cap: boolean;
  cost: number;
}

export interface KeywordCoverage {
  keyword: string;
  days: DayCoverage[];
  totals: {
    tweets: number;
    cost_usd: number;
    missing: number;
    sampled: number;
    complete: number;
  };
}

export interface HistoryResponse {
  window: { start: string; end: string };
  results: KeywordResult[];
  coverage: Record<string, KeywordCoverage>;
}

export interface PresetsResponse {
  presets: Record<string, { label: string; color: string; query: string }>;
  default_start_date: string;
  today: string;
  max_tweets_per_keyword: number;
  price_per_tweet_usd: number;
  readonly_mode: boolean;
}

export interface BackfillSummary {
  keyword: string;
  days_total: number;
  days_scraped: number;
  tweets_added: number;
  cost_usd: number;
  per_day: {
    day: string;
    skipped: boolean;
    tweets_added: number;
    hit_cap: boolean;
    cost_usd: number;
    error?: string;
  }[];
}

export interface BackfillResponse {
  window: { start: string; end: string };
  cap: number;
  summaries: BackfillSummary[];
  total_cost_usd: number;
}
