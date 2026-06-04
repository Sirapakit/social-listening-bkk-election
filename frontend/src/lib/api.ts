import type {
  BackfillResponse,
  HistoryResponse,
  KeywordSpec,
  PresetsResponse,
} from "./types";
import { MOCK_BACKFILL, MOCK_HISTORY, MOCK_PRESETS } from "./mockData";

export const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_DATA === "true";

const BASE = "";

export async function getPresets(): Promise<PresetsResponse> {
  if (IS_MOCK) return MOCK_PRESETS;
  const r = await fetch(`${BASE}/api/presets`, { cache: "no-store" });
  if (!r.ok) throw new Error(`presets failed: ${r.status}`);
  return r.json();
}

export interface HistoryParams {
  keywords: KeywordSpec[];
  start_date: string;
  end_date: string;
}

export async function getHistory(p: HistoryParams): Promise<HistoryResponse> {
  if (IS_MOCK) return MOCK_HISTORY;
  const r = await fetch(`${BASE}/api/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`history failed: ${r.status} ${await r.text().catch(() => "")}`);
  return r.json();
}

export interface BackfillParams extends HistoryParams {
  cap?: number;
  force?: boolean;
}

export async function backfill(p: BackfillParams): Promise<BackfillResponse> {
  if (IS_MOCK) return MOCK_BACKFILL;
  const r = await fetch(`${BASE}/api/backfill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`backfill failed: ${r.status} ${await r.text().catch(() => "")}`);
  return r.json();
}

export async function scrapeToday(
  keywords: KeywordSpec[],
  cap?: number,
): Promise<BackfillResponse> {
  if (IS_MOCK) return MOCK_BACKFILL;
  const r = await fetch(`${BASE}/api/scrape-today`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords, cap }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`scrape-today failed: ${r.status} ${await r.text().catch(() => "")}`);
  return r.json();
}

export async function deepScrape(
  keywords: KeywordSpec[],
  day: string,
  per_hour_cap = 500,
): Promise<BackfillResponse> {
  if (IS_MOCK) return MOCK_BACKFILL;
  const r = await fetch(`${BASE}/api/deep-scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords, day, per_hour_cap }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`deep-scrape failed: ${r.status} ${await r.text().catch(() => "")}`);
  return r.json();
}

// --- helpers -----------------------------------------------------------------
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

export function daysBetween(start: string, end: string): number {
  const a = new Date(start + "T00:00:00Z").getTime();
  const b = new Date(end + "T00:00:00Z").getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86400000) + 1);
}

/** Cost helpers — single source of truth for the UI dollar previews. */
export function costForDay(cap: number, keywords: number, pricePerTweet: number) {
  return cap * keywords * pricePerTweet;
}

export function costForBackfill(cap: number, keywords: number, days: number, pricePerTweet: number) {
  return cap * keywords * days * pricePerTweet;
}

/** Realistic ≈ ~60% of max-cap cost (most days don't hit the ceiling). */
export function realisticCost(maxCost: number): number {
  return maxCost * 0.6;
}
