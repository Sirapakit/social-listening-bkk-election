"use client";
import type { KeywordResult } from "@/lib/types";
import { useT } from "@/lib/i18n";

export function HashtagCloud({ result }: { result: KeywordResult }) {
  const { t } = useT();
  const items = result.top_hashtags.slice(0, 18);
  const max = Math.max(1, ...items.map((h) => h.count));
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[var(--text-sm)] uppercase tracking-wider text-muted font-medium">
          {t.topHashtags}
        </h3>
        <span className="text-[11px] text-muted">{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 && (
          <div className="text-sm text-muted py-2">{t.noHashtags}</div>
        )}
        {items.map((h, i) => {
          const ratio = h.count / max;
          const scale = 0.85 + ratio * 0.8;
          const opacity = 0.5 + ratio * 0.5;
          return (
            <span
              key={h.tag}
              className="rounded-full px-3 py-1 border tabular font-medium slide-in transition hover:scale-105"
              style={{
                fontSize: `${scale}rem`,
                background: `color-mix(in oklab, ${result.color} ${Math.round(opacity * 14)}%, transparent)`,
                color: result.color,
                borderColor: `color-mix(in oklab, ${result.color} ${Math.round(opacity * 50)}%, var(--border))`,
                animationDelay: `${i * 25}ms`,
              }}
              title={`${h.count} mentions`}
            >
              {h.tag} <span className="opacity-60 text-xs">·{h.count}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
