"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, X, Zap } from "lucide-react";
import type { KeywordCoverage, KeywordSpec, DayCoverage } from "@/lib/types";
import { deepScrape } from "@/lib/api";
import { useT } from "@/lib/i18n";

interface Props {
  coverage: Record<string, KeywordCoverage>;
  keywords: KeywordSpec[];
  onRefetch: () => void;
  readonlyMode?: boolean;
}

const statusColor: Record<string, string> = {
  complete: "var(--pos-dot)",
  sampled:  "var(--neu-dot)",
  missing:  "var(--neg-dot)",
};

// statusLabel is now dynamic (see useT inside component)

export function CoverageBar({ coverage, keywords, onRefetch, readonlyMode = false }: Props) {
  const { t } = useT();
  const statusLabel: Record<string, string> = {
    complete: t.statusComplete,
    sampled:  t.statusSampled,
    missing:  t.statusMissing,
  };
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ key: string; day: DayCoverage } | null>(null);

  const handleDeepScrape = async (keywordKey: string, day: string) => {
    const spec = keywords.find((k) => k.key === keywordKey);
    if (!spec) return;
    setBusy(`${keywordKey}-${day}`);
    try {
      await deepScrape([spec], day, 500);
      await onRefetch();
      setSelected(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card p-5 slide-in">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-baseline gap-3">
          <h3 className="text-[var(--text-sm)] uppercase tracking-wider text-muted font-medium">
            {t.coverageTitle}
          </h3>
          <span className="text-[11px] text-muted">{t.clickForDetails}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          {(["complete", "sampled", "missing"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: statusColor[s] }}
              />
              {statusLabel[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Unified scrollable days grid with fixed label and totals columns */}
      <div className="w-full">
        <div className="flex items-start">
          {/* Labels column */}
          <div className="w-36 shrink-0 flex flex-col gap-2">
            {keywords.map((k) => (
              <div key={k.key} className="flex items-center gap-2 text-sm min-h-[36px]">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: k.color, boxShadow: `0 0 8px ${k.color}` }}
                />
                <span className="truncate font-medium">{k.label}</span>
              </div>
            ))}
          </div>

          {/* Shared scroll area for all day cells */}
          <div className="flex-1 overflow-x-auto">
            {/** compute dates from first available coverage row */}
            {(() => {
              const firstKey = keywords.find((k) => coverage[k.key])?.key;
              const dates = firstKey ? coverage[firstKey].days.map((d) => d.day) : [];
              const cellWidth = 52; // px
              return (
                <div style={{ minWidth: `${Math.max(0, dates.length * cellWidth)}px` }}>
                  {keywords.map((k) => {
                    const c = coverage[k.key];
                    return (
                      <div
                        key={k.key}
                        className="grid items-center"
                        style={{
                          gridTemplateColumns: `repeat(${dates.length}, ${cellWidth}px)`,
                          display: "grid",
                          gap: "8px",
                          alignItems: "center",
                          marginBottom: "8px",
                        }}
                      >
                        {dates.map((dayStr, idx) => {
                          const d = c?.days[idx] ?? { day: dayStr, status: "missing", tweets: 0, hit_cap: false, cost: 0 } as any;
                          const busyKey = `${k.key}-${d.day}`;
                          const isBusy = busy === busyKey;
                          const isSelected = selected?.key === k.key && selected.day.day === d.day;
                          const dayNum = parseInt(d.day.slice(-2), 10);
                          return (
                            <button
                              key={d.day}
                              aria-label={`${k.label} on ${d.day}: ${statusLabel[d.status]} (${d.tweets} tweets)`}
                              title={
                                d.status === "missing"
                                  ? `${d.day} — no data yet`
                                  : `${d.day} — ${d.tweets} tweets${
                                      d.hit_cap ? " · sampled (hit cap)" : ""
                                    }`
                              }
                              onClick={() => setSelected({ key: k.key, day: d })}
                              className="h-9 rounded-[6px] flex items-center justify-center font-mono text-[11px] tabular relative transition-all cursor-pointer"
                              style={{
                                width: `${cellWidth}px`,
                                background: `color-mix(in oklab, ${statusColor[d.status]} ${
                                  d.status === "missing" ? "12%" : "32%"
                                }, transparent)`,
                                border: `1px solid ${
                                  isSelected
                                    ? "var(--lime)"
                                    : `color-mix(in oklab, ${statusColor[d.status]} 60%, transparent)`
                                }`,
                                color: statusColor[d.status],
                                transform: isSelected ? "translateY(-1px)" : undefined,
                                boxShadow: isSelected
                                  ? `0 0 0 2px var(--lime), 0 0 14px -2px var(--lime-glow)`
                                  : undefined,
                              }}
                            >
                              {isBusy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <span className="font-semibold">{dayNum || "—"}</span>
                              )}
                              {d.status === "sampled" && !isBusy && (
                                <AlertTriangle
                                  className="absolute top-0.5 right-0.5 w-2 h-2"
                                  style={{ color: statusColor.sampled }}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Totals column aligned with labels */}
          <div className="w-36 shrink-0 flex flex-col gap-2 text-right text-[11px] text-muted tabular">
            {keywords.map((k) => {
              const c = coverage[k.key];
              return (
                <div key={k.key} className="min-h-[36px] flex items-center justify-end">
                  <div>
                    <div className="text-foreground font-medium">{c ? c.totals.tweets.toLocaleString() : "—"}</div>
                    <div className="text-xs text-muted">{t.tweetsWord}</div> 
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <SelectedDayDetail
          day={selected.day}
          keywordKey={selected.key}
          statusLabel={statusLabel}
          busy={busy === `${selected.key}-${selected.day.day}`}
          onDeepScrape={() => handleDeepScrape(selected.key, selected.day.day)}
          onClose={() => setSelected(null)}
          readonlyMode={readonlyMode}
        />
      )}
    </div>
  );
}

function SelectedDayDetail({
  day, keywordKey, statusLabel, busy, onDeepScrape, onClose, readonlyMode = false,
}: {
  day: DayCoverage;
  keywordKey: string;
  statusLabel: Record<string, string>;
  busy: boolean;
  onDeepScrape: () => void;
  onClose: () => void;
  readonlyMode?: boolean;
}) {
  const { t } = useT();
  const deepCost = 24 * 500 * 0.00025;
  const StatusIcon =
    day.status === "complete" ? CheckCircle2
    : day.status === "sampled" ? AlertTriangle
    : CircleDashed;

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 slide-in">
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in oklab, ${statusColor[day.status]} 15%, transparent)`,
            color: statusColor[day.status],
          }}
        >
          <StatusIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider text-muted">{keywordKey}</span>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{
                color: statusColor[day.status],
                background: `color-mix(in oklab, ${statusColor[day.status]} 15%, transparent)`,
              }}
            >
              {statusLabel[day.status]}
            </span>
          </div>
          <div className="text-base font-semibold mt-0.5">{day.day}</div>
          <div className="text-sm text-muted mt-1 tabular">
            {day.status === "missing" ? (
              <>{t.noDataDay} <span className="text-foreground">{t.useBackfill}</span></>
            ) : (
              <>
                {day.tweets.toLocaleString()} {t.tweetsWord}
              </>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close detail"
          className="p-1 rounded-md text-muted hover:text-foreground hover:bg-[var(--surface-3)] transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {day.hit_cap && !readonlyMode && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            disabled={busy}
            onClick={onDeepScrape}
            className="btn-primary flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{
              background: "var(--neu-2)",
              color: "#fff",
            }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {t.deepScrapeBtn}
          </button>
          <span className="text-[11px] text-muted tabular">
            {t.deepScrapeNote(deepCost)}
          </span>
        </div>
      )}
    </div>
  );
}
