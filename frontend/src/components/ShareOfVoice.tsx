"use client";
import type { KeywordResult } from "@/lib/types";
import { useT } from "@/lib/i18n";

interface Props {
  results: KeywordResult[];
}

export function ShareOfVoice({ results }: Props) {
  const { t } = useT();
  const total = results.reduce((s, r) => s + r.totals.tweets, 0) || 1;
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm uppercase tracking-wider text-muted">{t.shareOfVoice}</h3>
        <span className="text-[11px] text-muted">{t.totalTweets(total)}</span>
      </div>
      <div className="flex h-8 w-full overflow-hidden rounded-full ring-1 ring-[var(--border)]">
        {results.map((r) => {
          const pct = (r.totals.tweets * 100) / total;
          return (
            <div
              key={r.keyword}
              style={{ width: `${pct}%`, background: r.color }}
              className="flex items-center justify-center text-xs font-semibold text-black/80 transition-[width] duration-700"
            >
              {pct >= 8 ? `${pct.toFixed(0)}%` : ""}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {results.map((r) => (
          <div key={r.keyword} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
            <span className="font-medium">{r.label}</span>
            <span className="text-muted tabular-nums">
              {r.totals.tweets.toLocaleString()} · {r.share_of_voice}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
