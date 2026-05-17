"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, Sparkles, X, Search } from "lucide-react";
import { backfill, formatNumber, getHistory, getPresets, IS_MOCK, scrapeToday } from "@/lib/api";
import type { HistoryResponse, KeywordSpec, PresetsResponse } from "@/lib/types";
import { ControlsBar } from "@/components/ControlsBar";
import { CoverageBar } from "@/components/CoverageBar";
import { BuzzTimeline } from "@/components/BuzzTimeline";
import { ShareOfVoice } from "@/components/ShareOfVoice";
import { KeywordPanel } from "@/components/KeywordPanel";
import { LanguageProvider, useT } from "@/lib/i18n";

// ── KPI sparkline ─────────────────────────────────────────────────────────────
function Sparkline({ data, color = "currentColor" }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) {
    return <svg width={72} height={28} />;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 72; const h = 26;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

// ── Aggregate KPI card ────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  delta,
  sparkline,
  deltaColor,
  index = 0,
}: {
  label: string;
  value: string;
  delta?: string;
  sparkline?: number[];
  deltaColor?: string;
  index?: number;
}) {
  return (
    <div
      className="card p-5 flex flex-col gap-3 slide-in"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="text-[32px] sm:text-[40px] font-bold tracking-tight tabular leading-none">
        {value}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="slash-label">{label}</div>
          {delta && (
            <div
              className="text-xs font-mono mt-1 tabular font-semibold"
              style={{ color: deltaColor ?? "var(--pos)" }}
            >
              {delta}
            </div>
          )}
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={deltaColor ?? "var(--pos)"} />
        )}
      </div>
    </div>
  );
}

// ── Inner dashboard ────────────────────────────────────────────────────────────
function DashboardInner() {
  const { t, lang, toggle } = useT();

  const [presets, setPresets]           = useState<PresetsResponse | null>(null);
  const [keywords, setKeywords]         = useState<KeywordSpec[]>([]);
  const [startDate, setStartDate]       = useState("");
  const [endDate, setEndDate]           = useState("");
  const [cap, setCap]                   = useState(2000);
  const [data, setData]                 = useState<HistoryResponse | null>(null);
  const [loadingBackfill, setLoadingBackfill] = useState(false);
  const [loadingToday, setLoadingToday]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);
  const [toastDismissed, setToastDismissed]   = useState(false);

  const refetchHistory = useCallback(async () => {
    if (!keywords.length || !startDate || !endDate) return;
    try {
      const res = await getHistory({ keywords, start_date: startDate, end_date: endDate });
      setData(res);
      setLastUpdated(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [keywords, startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getPresets();
        if (cancelled) return;
        setPresets(p);
        const seed: KeywordSpec[] = Object.entries(p.presets).map(([k, v]) => ({
          key: k, label: v.label, color: v.color, query: v.query,
        }));
        setKeywords(seed);
        setStartDate(p.default_start_date);
        setEndDate(p.today);
        setCap(Math.min(2000, p.max_tweets_per_keyword));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { refetchHistory(); }, [refetchHistory]);

  // ── Aggregate metrics ──────────────────────────────────────────────────────
  const agg = useMemo(() => {
    if (!data) return null;
    const totalTweets = data.results.reduce((s, r) => s + r.totals.tweets, 0);
    const totalReach  = data.results.reduce((s, r) => s + r.totals.reach, 0);

    let totalPos = 0; let totalNeg = 0; let totalNeu = 0;
    for (const r of data.results) {
      totalPos += r.sentiment.positive;
      totalNeg += r.sentiment.negative;
      totalNeu += r.sentiment.neutral;
    }
    const totalSent   = totalPos + totalNeg + totalNeu || 1;
    const posPct      = Math.round((totalPos / totalSent) * 100);
    const negPct      = Math.round((totalNeg / totalSent) * 100);

    // Coverage %: count complete days vs total
    let totalDays = 0; let completeDays = 0;
    for (const cov of Object.values(data.coverage)) {
      for (const d of cov.days) {
        totalDays++;
        if (d.status === "complete") completeDays++;
      }
    }
    const coveragePct = totalDays ? Math.round((completeDays / totalDays) * 100) : 0;

    // Sparklines: combine timelines
    const byDate: Record<string, number> = {};
    for (const r of data.results) {
      for (const p of r.timeline) {
        byDate[p.date] = (byDate[p.date] ?? 0) + p.count;
      }
    }
    const tweetSparkline = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    return { totalTweets, totalReach, posPct, negPct, coveragePct, tweetSparkline };
  }, [data]);

  const missingDayCount = data
    ? Object.values(data.coverage).reduce((s, c) => s + c.totals.missing, 0)
    : 0;
  const showToast = missingDayCount > 0 && !toastDismissed && !loadingBackfill;

  const onBackfill = async () => {
    setLoadingBackfill(true);
    setError(null);
    try {
      await backfill({ keywords, start_date: startDate, end_date: endDate, cap });
      await refetchHistory();
      setToastDismissed(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingBackfill(false);
    }
  };

  const onScrapeToday = async () => {
    setLoadingToday(true);
    setError(null);
    try {
      await scrapeToday(keywords, cap);
      await refetchHistory();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingToday(false);
    }
  };

  const ready   = presets && keywords.length > 0;
  const hasData = data?.results.some((r) => r.totals.tweets > 0) ?? false;
  const isOperational = !error && !loadingBackfill;

  // ── Top nav bar ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen">

      {/* ─── Top nav ────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-30 flex items-center gap-4 px-6 h-11 shrink-0"
        style={{
          background: "var(--background)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] tracking-wider uppercase font-medium">
          <span style={{ color: "var(--muted-2)" }}>ELECTION 2026</span>
          <span style={{ color: "var(--border-strong)" }}>/</span>
          <span style={{ color: "var(--foreground)" }}>DASHBOARD</span>
        </div>

        {/* Search bar */}
        <div
          className="hidden md:flex items-center gap-2 flex-1 max-w-xs mx-auto rounded-lg px-3 h-7 text-xs"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <Search className="w-3 h-3 shrink-0" style={{ color: "var(--muted-2)" }} />
          <span style={{ color: "var(--muted-2)" }}>ค้นหาคำสำคัญ, ข้อมูล...</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Mock mode badge */}
          {IS_MOCK && (
            <span
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded tracking-widest uppercase"
              style={{ background: "color-mix(in oklab, var(--neu) 18%, transparent)", color: "var(--neu)", border: "1px solid color-mix(in oklab, var(--neu) 35%, transparent)" }}
            >
              MOCK
            </span>
          )}
          {/* Language toggle */}
          <button
            onClick={toggle}
            aria-label="Switch language"
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <span style={{ color: lang === "th" ? "var(--pos)" : "var(--muted)" }}>TH</span>
            <span style={{ color: "var(--border-strong)" }}>/</span>
            <span style={{ color: lang === "en" ? "var(--pos)" : "var(--muted)" }}>EN</span>
          </button>
          {/* Bell */}
          <button
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--muted)" }}
          >
            <Bell className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </nav>

      {/* ─── Page content ──────────────────────────────────────────────── */}
      <main className="flex-1 px-6 lg:px-8 py-8 flex flex-col gap-6 max-w-[1400px] w-full">

        {/* ─── Hero: title + meta ─────────────────────────────────────── */}
        <section className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <h1
              className="font-black leading-[0.92] tracking-tight"
              style={{ fontSize: "clamp(52px, 7vw, 88px)", color: "var(--foreground)" }}
            >
              Bangkok<br />Election<br />
              <span style={{ color: "var(--muted-2)" }}>2026</span>
            </h1>
            <p
              className="mt-4 text-xs tracking-[0.2em] uppercase font-medium"
              style={{ color: "var(--muted)" }}
            >
              MONITOR. ANALYZE. REPORT.
            </p>
          </div>

          {/* Status panel */}
          <div
            className="shrink-0 text-right space-y-3 pt-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                LAST SYNCED
              </div>
              <div className="text-sm font-medium tabular mt-0.5" style={{ color: "var(--foreground)" }}>
                {lastUpdated
                  ? lastUpdated.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() +
                    " · " +
                    lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                NODE STATUS
              </div>
              <div className="flex items-center gap-1.5 justify-end mt-0.5">
                <span
                  className="status-dot pulse-soft"
                  style={{
                    display: "inline-block",
                    width: 7, height: 7,
                    borderRadius: "50%",
                    background: isOperational ? "var(--pos-dot)" : "var(--neg-dot)",
                  }}
                />
                <span
                  className="text-[11px] font-semibold tracking-widest"
                  style={{ color: isOperational ? "var(--pos)" : "var(--neg)" }}
                >
                  {isOperational ? "OPERATIONAL" : "ERROR"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Aggregate KPI cards ───────────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="TOTAL TWEETS"
            value={agg ? formatNumber(agg.totalTweets) : "—"}
            delta={agg ? `${keywords.length} keywords` : undefined}
            sparkline={agg?.tweetSparkline}
            deltaColor="var(--info)"
            index={0}
          />
          <KpiCard
            label="TOTAL REACH"
            value={agg ? formatNumber(agg.totalReach) : "—"}
            delta={agg ? "followers reached" : undefined}
            sparkline={agg?.tweetSparkline.map((v) => v * 12)}
            deltaColor="var(--pos)"
            index={1}
          />
          <KpiCard
            label="POSITIVE SENTIMENT"
            value={agg ? `${agg.posPct}%` : "—"}
            delta={agg ? `${agg.negPct}% negative` : undefined}
            sparkline={agg?.tweetSparkline.map((_, i) => agg.posPct + Math.sin(i) * 4)}
            deltaColor={
              agg && agg.posPct > agg.negPct ? "var(--pos)" : "var(--neg)"
            }
            index={2}
          />
          <KpiCard
            label="DATA COVERAGE"
            value={agg ? `${agg.coveragePct}%` : "—"}
            delta={agg && missingDayCount > 0 ? `${missingDayCount} days missing` : agg ? "complete" : undefined}
            sparkline={agg?.tweetSparkline.map(() => agg.coveragePct + Math.random() * 5)}
            deltaColor={
              agg && agg.coveragePct >= 80 ? "var(--pos)"
              : agg && agg.coveragePct >= 50 ? "var(--neu)"
              : "var(--neg)"
            }
            index={3}
          />
        </section>

        {/* ─── Alerts ─────────────────────────────────────────────────── */}
        {showToast && (
          <div
            className="card flex items-center gap-3 p-3 px-4 text-sm slide-in"
            style={{ borderColor: "color-mix(in oklab, var(--neu) 35%, var(--border))" }}
          >
            <Sparkles className="w-4 h-4 shrink-0 pulse-soft" style={{ color: "var(--neu)" }} />
            <div className="flex-1 min-w-0">
              <span className="font-medium">{missingDayCount}</span>{" "}
              {t.missingDays(missingDayCount)}{" "}
              <span style={{ color: "var(--muted)" }}>{t.missingDaysHint}</span>
            </div>
            <button
              onClick={onBackfill}
              className="btn-primary px-3 py-1.5 rounded-md text-xs font-semibold"
            >
              {t.backfillNow}
            </button>
            <button
              onClick={() => setToastDismissed(true)}
              className="p-1 rounded-md transition"
              style={{ color: "var(--muted)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div
            className="card p-4 flex items-start gap-3 slide-in"
            style={{ borderColor: "color-mix(in oklab, var(--neg) 40%, var(--border))" }}
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--neg)" }} />
            <div className="text-sm flex-1 min-w-0">
              <div className="font-semibold" style={{ color: "var(--neg)" }}>{t.errorTitle}</div>
              <div className="mt-1 whitespace-pre-wrap break-words" style={{ color: "var(--muted)" }}>
                {error}
              </div>
              <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                {t.errorTip}{" "}
                <code className="font-mono" style={{ color: "var(--foreground)" }}>localhost:8000</code>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 rounded-md transition"
              style={{ color: "var(--muted)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loadingBackfill && (
          <div className="card p-5 flex items-center gap-3 slide-in">
            <Sparkles className="w-5 h-5 pulse-soft" style={{ color: "var(--pos)" }} />
            <div className="text-sm flex-1">
              <div className="font-medium">{t.scrapingTitle}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {t.scrapingDesc(keywords.length, startDate, endDate)}
              </div>
            </div>
          </div>
        )}

        {/* ─── Controls ───────────────────────────────────────────────── */}
        {ready ? (
          <section>
            <div className="slash-label mb-3">SCRAPE CONTROLS</div>
            <ControlsBar
              keywords={keywords}
              setKeywords={setKeywords}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              cap={cap}
              setCap={setCap}
              maxAllowed={presets.max_tweets_per_keyword}
              pricePerTweet={presets.price_per_tweet_usd}
              scheduleEnabled={presets.schedule.enabled}
              scheduleHour={presets.schedule.hour}
              onBackfill={onBackfill}
              onScrapeToday={onScrapeToday}
              loadingBackfill={loadingBackfill}
              loadingToday={loadingToday}
            />
          </section>
        ) : (
          <div className="card shimmer h-[280px]" />
        )}

        {/* ─── Coverage grid ──────────────────────────────────────────── */}
        {data && ready && (
          <section>
            <div className="slash-label mb-3">DATA COVERAGE</div>
            <CoverageBar coverage={data.coverage} keywords={keywords} onRefetch={refetchHistory} />
          </section>
        )}

        {/* ─── Results ────────────────────────────────────────────────── */}
        {!loadingBackfill && data && !hasData && (
          <div className="card p-12 flex flex-col items-center text-center gap-3 slide-in">
            <div className="text-4xl font-black" style={{ color: "var(--border-strong)" }}>—</div>
            <h2 className="text-lg font-semibold">{t.noDataTitle}</h2>
            <p className="text-sm max-w-md" style={{ color: "var(--muted)" }}>
              {lang === "th" ? (
                <>คลิก <span className="font-medium" style={{ color: "var(--foreground)" }}>{t.noDataAction}</span> {t.noDataDesc(startDate, endDate)}</>
              ) : (
                <>Click <span className="font-medium" style={{ color: "var(--foreground)" }}>{t.noDataAction}</span> {t.noDataDesc(startDate, endDate)}</>
              )}
            </p>
          </div>
        )}

        {data && hasData && (
          <>
            {/* Share of Voice */}
            <section>
              <div className="slash-label mb-3">SHARE OF VOICE</div>
              <ShareOfVoice results={data.results} />
            </section>

            {/* Buzz Timeline */}
            <section>
              <div className="slash-label mb-3">BUZZ TIMELINE</div>
              <BuzzTimeline results={data.results} />
            </section>

            {/* Keyword panels */}
            <section>
              <div className="slash-label mb-3">KEYWORD ANALYSIS</div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {data.results.map((r, i) => (
                  <div key={r.keyword} className="slide-in" style={{ animationDelay: `${i * 70}ms` }}>
                    <KeywordPanel result={r} />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ─── Footer ─────────────────────────────────────────────────── */}
        <footer
          className="text-center text-[10px] tracking-widest uppercase pt-6 pb-4"
          style={{ color: "var(--muted-2)" }}
        >
          SYSTEM V1.0.0 · {t.footerText}
        </footer>
      </main>
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  return (
    <LanguageProvider>
      <DashboardInner />
    </LanguageProvider>
  );
}
