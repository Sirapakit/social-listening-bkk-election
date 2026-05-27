"use client";
import { Loader2, RefreshCw, Search, Database, Zap, CalendarRange, SlidersHorizontal } from "lucide-react";
import type { KeywordSpec } from "@/lib/types";
import {
  costForBackfill,
  costForDay,
  daysBetween,
  realisticCost,
} from "@/lib/api";
import { useT } from "@/lib/i18n";

interface Props {
  keywords: KeywordSpec[];
  setKeywords: (k: KeywordSpec[]) => void;
  startDate: string;
  setStartDate: (s: string) => void;
  endDate: string;
  setEndDate: (s: string) => void;
  cap: number;
  setCap: (n: number) => void;
  maxAllowed: number;
  pricePerTweet: number;
  scheduleEnabled: boolean;
  scheduleHour: number;
  onBackfill: () => void;
  onScrapeToday: () => void;
  loadingBackfill: boolean;
  loadingToday: boolean;
  readonlyMode?: boolean;
}

export function ControlsBar(props: Props) {
  const { t } = useT();
  const {
    keywords, setKeywords,
    startDate, setStartDate,
    endDate, setEndDate,
    cap, setCap,
    maxAllowed, pricePerTweet,
    scheduleEnabled, scheduleHour,
    onBackfill, onScrapeToday,
    loadingBackfill, loadingToday,
    readonlyMode = false,
  } = props;

  const updateQuery = (i: number, q: string) => {
    const next = [...keywords];
    next[i] = { ...next[i], query: q };
    setKeywords(next);
  };

  const days = daysBetween(startDate, endDate);
  const todayMax = costForDay(cap, keywords.length, pricePerTweet);
  const backfillMax = costForBackfill(cap, keywords.length, days, pricePerTweet);
  const backfillRealistic = realisticCost(backfillMax);
  const todayRealistic = realisticCost(todayMax);

  // Compute slider fill % for the track gradient
  const sliderFill = ((cap - 100) / (maxAllowed - 100)) * 100;

  return (
    <div className="card p-5 flex flex-col gap-5 slide-in">
      {/* Keywords row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {keywords.map((k, i) => (
          <div key={k.key} className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted font-medium flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: k.color, boxShadow: `0 0 8px ${k.color}` }}
              />
              {k.label}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
              <input
                value={k.query}
                onChange={(e) => updateQuery(i, e.target.value)}
                placeholder={t.queryPlaceholder}
                className="w-full bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm font-mono focus:border-[var(--lime)]/50 transition"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Date + cap slider grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <DateField
          label={t.dateFrom}
          icon={<CalendarRange className="w-3 h-3" />}
          value={startDate}
          onChange={setStartDate}
        />
        <DateField
          label={t.dateTo}
          icon={<CalendarRange className="w-3 h-3" />}
          value={endDate}
          onChange={setEndDate}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wider text-muted font-medium flex items-baseline justify-between">
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3 h-3" />
              {t.tweetCap}
            </span>
            <span className="text-[10px] normal-case tracking-normal opacity-70">
              {t.maxLabel(maxAllowed)}
            </span>
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="range"
              min={100}
              max={maxAllowed}
              step={100}
              value={cap}
              onChange={(e) => setCap(Number(e.target.value))}
              className="w-full"
              style={{ ["--val" as string]: `${sliderFill}%` }}
            />
            <input
              type="number"
              min={100}
              max={maxAllowed}
              step={100}
              value={cap}
              onChange={(e) =>
                setCap(Math.max(100, Math.min(maxAllowed, Number(e.target.value) || 100)))
              }
              className="w-20 bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm tabular text-right focus:border-[var(--lime)]/50 transition"
            />
          </div>
        </div>
      </div>

      {/* Cost preview card — hidden in readonly mode */}
      {!readonlyMode && (
        <div className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface-2)]/60 to-[var(--surface)]/60 p-4">
          <div className="text-[var(--text-xs)] uppercase tracking-wider text-muted font-medium mb-3 flex items-center gap-2">
            <Zap className="w-3 h-3 text-[color:var(--lime)]" />
            {t.costPreview}
            <span className="opacity-50 normal-case tracking-normal">
              {t.perTweet(pricePerTweet)}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CostTile
              label={t.costPerDay}
              realistic={todayRealistic}
              max={todayMax}
              note={t.capNote(keywords.length, cap)}
            />
            <CostTile
              label={t.costBackfill(days)}
              realistic={backfillRealistic}
              max={backfillMax}
              highlight
              note={t.idempotent}
            />
            <CostTile
              label={t.costDaily}
              realistic={todayRealistic}
              max={todayMax}
              note={scheduleEnabled ? t.scheduleRuns(scheduleHour) : t.scheduleOff}
            />
          </div>
        </div>
      )}

      {/* Action buttons — hidden in readonly mode */}
      {!readonlyMode && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onScrapeToday}
            disabled={loadingToday || loadingBackfill}
            title={`${t.scrapeTodayBtn} (${keywords.length} keywords) — max $${todayMax.toFixed(2)}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold border border-[var(--border-strong)] bg-[var(--surface-2)]/40 hover:bg-[var(--surface-2)] hover:border-[var(--lime)]/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loadingToday ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {t.scrapeTodayBtn}
            <span className="text-xs text-muted font-mono ml-1">~${todayRealistic.toFixed(2)}</span>
          </button>

          <button
            onClick={onBackfill}
            disabled={loadingBackfill || loadingToday || days === 0}
            title={`${t.backfillBtn(days)} — max $${backfillMax.toFixed(2)}`}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold"
          >
            {loadingBackfill ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {t.backfillBtn(days)}
            <span className="text-xs font-mono opacity-80 ml-1">≤ ${backfillMax.toFixed(2)}</span>
          </button>

          <div className="text-[11px] text-muted ml-auto max-w-[280px] text-right leading-snug">
            {t.autoNote}
            {scheduleEnabled && (
              <span className="text-foreground">{t.dailyRefresh(scheduleHour)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DateField({
  label, icon, value, onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted font-medium flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-lg px-3 py-2 text-sm tabular focus:border-[var(--lime)]/50 transition"
      />
    </div>
  );
}

function CostTile({
  label, realistic, max, note, highlight,
}: {
  label: string;
  realistic: number;
  max: number;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-3 border ${
        highlight
          ? "bg-[color:var(--lime)]/5 border-[color:var(--lime)]/25"
          : "bg-[var(--surface)]/40 border-[var(--border)]"
      }`}
    >
      <div className="text-[11px] text-muted">{label}</div>
      <div className="flex items-baseline gap-2 tabular mt-0.5">
        <span
          className={`text-xl font-bold ${highlight ? "text-[color:var(--lime)]" : "text-foreground"}`}
        >
          ${realistic.toFixed(2)}
        </span>
        <span className="text-xs text-muted">≤ ${max.toFixed(2)} max</span>
      </div>
      <div className="text-[10px] text-muted mt-1 leading-tight">{note}</div>
    </div>
  );
}
