"use client";
import { useCallback, useEffect, useState } from "react";
import { Activity, AlertCircle, BarChart3, Sparkles, Clock, X } from "lucide-react";
import { backfill, getHistory, getPresets, scrapeToday } from "@/lib/api";
import type { HistoryResponse, KeywordSpec, PresetsResponse } from "@/lib/types";
import { ControlsBar } from "@/components/ControlsBar";
import { CoverageBar } from "@/components/CoverageBar";
import { BuzzTimeline } from "@/components/BuzzTimeline";
import { ShareOfVoice } from "@/components/ShareOfVoice";
import { KeywordPanel } from "@/components/KeywordPanel";
import { LanguageProvider, useT } from "@/lib/i18n";

// ── Inner dashboard (uses language context) ──────────────────────────────────
function DashboardInner() {
  const { t, lang, toggle } = useT();

  const [presets, setPresets] = useState<PresetsResponse | null>(null);
  const [keywords, setKeywords] = useState<KeywordSpec[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cap, setCap] = useState(2000);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loadingBackfill, setLoadingBackfill] = useState(false);
  const [loadingToday, setLoadingToday] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [toastDismissed, setToastDismissed] = useState(false);

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
          key: k,
          label: v.label,
          color: v.color,
          query: v.query,
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

  const readonlyMode = presets?.readonly_mode ?? false;

  const missingDayCount = data
    ? Object.values(data.coverage).reduce((s, c) => s + c.totals.missing, 0)
    : 0;
  const showToast = missingDayCount > 0 && !toastDismissed && !loadingBackfill && !readonlyMode;

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

  const ready = presets && keywords.length > 0;
  const hasData = data?.results.some((r) => r.totals.tweets > 0) ?? false;

  return (
    <main className="min-h-screen w-full">
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10 flex flex-col gap-6">

        {/* ============== Header ============== */}
        <header className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--lime), var(--lime-2))",
                boxShadow: "0 0 32px -6px var(--lime-glow), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            >
              <BarChart3 className="w-6 h-6 text-[color:var(--dark-green)]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl lg:text-[28px] font-extrabold tracking-tight leading-tight">
                Bangkok <span className="gradient-text">Election</span>: Social Listening
              </h1>
              <p className="text-[13px] text-muted mt-0.5">
                {t.subtitle}
              </p>
            </div>
          </div>
          <div className="md:ml-auto flex items-center gap-3 text-[11px] text-muted">
            {lastUpdated && (
              <span className="flex items-center gap-1.5 tabular">
                <Activity className="w-3.5 h-3.5 text-[color:var(--lime)]" />
                {t.loaded} {lastUpdated.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            {presets?.schedule.enabled && (
              <span className="hidden sm:flex items-center gap-1.5 tabular px-2 py-1 rounded-md bg-[var(--surface-2)]/50 border border-[var(--border)]">
                <Clock className="w-3 h-3" />
                {t.auto} · {String(presets.schedule.hour).padStart(2, "0")}:{String(presets.schedule.minute).padStart(2, "0")}
              </span>
            )}
            {/* Language toggle */}
            <button
              onClick={toggle}
              aria-label="Switch language"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)]/50 hover:border-[var(--lime)]/40 hover:bg-[var(--surface-2)] transition text-[11px] font-semibold tabular"
            >
              <span style={{ color: lang === "th" ? "var(--lime)" : "var(--muted)" }}>TH</span>
              <span className="text-[var(--border-strong)]">/</span>
              <span style={{ color: lang === "en" ? "var(--lime)" : "var(--muted)" }}>EN</span>
            </button>
          </div>
        </header>

        {/* ============== Controls ============== */}
        {ready ? (
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
            readonlyMode={readonlyMode}
          />
        ) : (
          <div className="card shimmer h-[320px]" />
        )}

        {/* ============== Missing-days toast ============== */}
        {showToast && (
          <div
            className="card flex items-center gap-3 p-3 px-4 text-sm slide-in"
            style={{ borderColor: "color-mix(in oklab, var(--lime) 35%, var(--border))" }}
          >
            <Sparkles className="w-4 h-4 text-[color:var(--lime)] shrink-0 pulse-soft" />
            <div className="flex-1 min-w-0">
              <span className="font-medium">{missingDayCount}</span>{" "}
              {t.missingDays(missingDayCount)}{" "}
              <span className="text-muted">{t.missingDaysHint}</span>
            </div>
            <button
              onClick={onBackfill}
              className="btn-primary px-3 py-1.5 rounded-md text-xs"
            >
              {t.backfillNow}
            </button>
            <button
              onClick={() => setToastDismissed(true)}
              aria-label={t.dismiss}
              className="text-xs text-muted hover:text-foreground p-1 rounded-md hover:bg-[var(--surface-3)] transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ============== Error ============== */}
        {error && (
          <div className="card p-4 flex items-start gap-3 slide-in"
               style={{ borderColor: "color-mix(in oklab, var(--neg) 40%, var(--border))" }}>
            <AlertCircle className="w-5 h-5 text-[color:var(--neg)] shrink-0 mt-0.5" />
            <div className="text-sm flex-1 min-w-0">
              <div className="font-semibold text-[color:var(--neg)]">{t.errorTitle}</div>
              <div className="text-muted mt-1 whitespace-pre-wrap break-words">{error}</div>
              <div className="text-xs text-muted mt-2">
                {t.errorTip}{" "}
                <code className="text-foreground font-mono">localhost:8000</code>.
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              aria-label={t.dismissError}
              className="text-xs text-muted hover:text-foreground p-1 rounded hover:bg-[var(--surface-3)] transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ============== Backfilling indicator ============== */}
        {loadingBackfill && (
          <div className="card p-5 flex items-center gap-3 slide-in">
            <div className="relative">
              <Sparkles className="w-5 h-5 text-[color:var(--lime)]" />
              <span className="absolute inset-0 rounded-full bg-[color:var(--lime)]/30 blur-md pulse-soft" />
            </div>
            <div className="text-sm flex-1">
              <div className="font-medium">{t.scrapingTitle}</div>
              <div className="text-muted text-xs">
                {t.scrapingDesc(keywords.length, startDate, endDate)}
              </div>
            </div>
          </div>
        )}

        {/* ============== Coverage ============== */}
        {data && ready && <CoverageBar coverage={data.coverage} keywords={keywords} onRefetch={refetchHistory} readonlyMode={readonlyMode} />}

        {/* ============== Empty data ============== */}
        {!loadingBackfill && data && !hasData && (
          <div className="card p-12 flex flex-col items-center text-center gap-3 slide-in">
            <div className="relative">
              <BarChart3 className="w-10 h-10 text-[color:var(--lime)]" />
              <span className="absolute inset-0 rounded-full bg-[color:var(--lime)]/20 blur-lg pulse-soft" />
            </div>
            <h2 className="text-lg font-semibold">{t.noDataTitle}</h2>
            <p className="text-sm text-muted max-w-md">
              {lang === "th" ? (
                <>
                  คลิกปุ่ม{" "}
                  <span className="text-[color:var(--lime)] font-medium">{t.noDataAction}</span>{" "}
                  {t.noDataDesc(startDate, endDate)}
                </>
              ) : (
                <>
                  Click{" "}
                  <span className="text-[color:var(--lime)] font-medium">{t.noDataAction}</span>{" "}
                  {t.noDataDesc(startDate, endDate)}
                </>
              )}
            </p>
          </div>
        )}

        {/* ============== Results ============== */}
        {data && hasData && (
          <>
            <ShareOfVoice results={data.results} />
            <BuzzTimeline results={data.results} />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {data.results.map((r, i) => (
                <div key={r.keyword} className="slide-in" style={{ animationDelay: `${i * 60}ms` }}>
                  <KeywordPanel result={r} />
                </div>
              ))}
            </div>
          </>
        )}

        <footer className="text-center text-xs text-muted pt-6 pb-2">
          {t.footerText}
        </footer>
      </div>
    </main>
  );
}

// ── Root export (wraps with provider so all children can useT) ───────────────
export default function Dashboard() {
  return (
    <LanguageProvider>
      <DashboardInner />
    </LanguageProvider>
  );
}
