"use client";
import { useT } from "@/lib/i18n";
import type { KeywordResult } from "@/lib/types";

interface Props {
  results: KeywordResult[];
}

export function BuzzTimeline({ results }: Props) {
  const { t } = useT();
  const dates = results[0]?.timeline.map((point) => point.date) ?? [];
  const maxCount = Math.max(
    1,
    ...results.flatMap((result) => result.timeline.map((point) => point.count)),
  );

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm uppercase tracking-wider text-muted">{t.buzzTitle}</h3>
        <span className="text-[11px] text-muted">{t.tweetsPerDay}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid gap-3">
            {results.map((result) => (
              <div
                key={result.keyword}
                className="grid grid-cols-[110px_minmax(0,1fr)] items-end gap-3"
              >
                <div className="min-w-0 pb-1">
                  <div className="text-sm font-semibold truncate">{result.label}</div>
                  <div className="text-[11px] text-muted tabular-nums">
                    {result.timeline.reduce((sum, point) => sum + point.count, 0).toLocaleString()} total
                  </div>
                </div>
                <div>
                  <div className="grid items-end gap-1.5" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(14px, 1fr))` }}>
                    {result.timeline.map((point) => (
                      <div key={point.date} className="flex flex-col items-center gap-1 min-w-0">
                        <div
                          className="w-full rounded-t-sm"
                          style={{
                            height: `${Math.max(12, (point.count / maxCount) * 110)}px`,
                            background: result.color,
                            opacity: 0.9,
                          }}
                          title={`${result.label} · ${point.date} · ${point.count.toLocaleString()}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(14px, 1fr))` }}>
                    {dates.map((date) => (
                      <div key={date} className="text-[10px] text-muted text-center tabular-nums">
                        {date.slice(5)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
        {results.map((result) => (
          <div key={result.keyword} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: result.color }} />
            <span>{result.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
