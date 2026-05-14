"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, X, Zap } from "lucide-react";
import type { KeywordCoverage, KeywordSpec, DayCoverage } from "@/lib/types";
import { deepScrape } from "@/lib/api";

interface Props {
  coverage: Record<string, KeywordCoverage>;
  keywords: KeywordSpec[];
  onRefetch: () => void;
}

const statusColor: Record<string, string> = {
  complete: "var(--pos)",
  sampled:  "var(--orange)",
  missing:  "var(--muted)",
};

const statusLabel: Record<string, string> = {
  complete: "complete",
  sampled:  "sampled (hit cap)",
  missing:  "missing",
};

export function CoverageBar({ coverage, keywords, onRefetch }: Props) {
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
            Coverage
          </h3>
          <span className="text-[11px] text-muted">click a day for details</span>
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

      <div className="flex flex-col gap-2.5">
        {keywords.map((k) => {
          const c = coverage[k.key];
          if (!c) return null;
          return (
            <div key={k.key} className="flex items-center gap-3">
              <div className="w-36 shrink-0 flex items-center gap-2 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: k.color, boxShadow: `0 0 8px ${k.color}` }}
                />
                <span className="truncate font-medium">{k.label}</span>
              </div>
              <div className="flex gap-[3px] flex-1 min-w-0">
                {c.days.map((d) => {
                  const busyKey = `${k.key}-${d.day}`;
                  const isBusy = busy === busyKey;
                  const isSelected =
                    selected?.key === k.key && selected.day.day === d.day;
                  const dayNum = parseInt(d.day.slice(-2), 10);
                  return (
                    <button
                      key={d.day}
                      aria-label={`${k.label} on ${d.day}: ${statusLabel[d.status]} (${d.tweets} tweets)`}
                      title={
                        d.status === "missing"
                          ? `${d.day} — no data yet`
                          : `${d.day} — ${d.tweets} tweets · $${d.cost.toFixed(4)}${
                              d.hit_cap ? " · sampled (hit cap)" : ""
                            }`
                      }
                      onClick={() => setSelected({ key: k.key, day: d })}
                      className="flex-1 h-9 rounded-[6px] flex items-center justify-center font-mono text-[11px] tabular relative transition-all cursor-pointer focus-visible:scale-110"
                      style={{
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
              <div className="w-36 shrink-0 text-right text-[11px] text-muted tabular">
                <span className="text-foreground font-medium">
                  {c.totals.tweets.toLocaleString()}
                </span>{" "}
                tweets · ${c.totals.cost_usd.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <SelectedDayDetail
          day={selected.day}
          keywordKey={selected.key}
          busy={busy === `${selected.key}-${selected.day.day}`}
          onDeepScrape={() => handleDeepScrape(selected.key, selected.day.day)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function SelectedDayDetail({
  day, keywordKey, busy, onDeepScrape, onClose,
}: {
  day: DayCoverage;
  keywordKey: string;
  busy: boolean;
  onDeepScrape: () => void;
  onClose: () => void;
}) {
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
              <>No data yet for this day. Use <span className="text-foreground">Backfill</span> above.</>
            ) : (
              <>
                {day.tweets.toLocaleString()} tweets · ${day.cost.toFixed(4)}
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

      {day.hit_cap && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            disabled={busy}
            onClick={onDeepScrape}
            className="btn-primary flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{
              background: "linear-gradient(180deg, var(--orange), color-mix(in oklab, var(--orange) 90%, black))",
              color: "#1a0a04",
              boxShadow: "0 0 24px -6px rgba(242, 107, 44, 0.55)",
            }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Deep-scrape this day
          </button>
          <span className="text-[11px] text-muted tabular">
            24 hourly slices · up to 12,000 tweets · ~${deepCost.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
