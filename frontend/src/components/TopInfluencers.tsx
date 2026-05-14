"use client";
import { BadgeCheck } from "lucide-react";
import { useT } from "@/lib/i18n";
import { formatNumber } from "@/lib/api";
import type { KeywordResult } from "@/lib/types";

export function TopInfluencers({ result }: { result: KeywordResult }) {
  const { t } = useT();
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[var(--text-sm)] uppercase tracking-wider text-muted font-medium">
          {t.topInfluencers}
        </h3>
        <span className="text-[11px] text-muted">{t.byEngagement}</span>
      </div>
      <div className="flex flex-col">
        {result.top_influencers.length === 0 ? (
          <div className="text-sm text-muted py-8 text-center">
            <div className="opacity-50 mb-1">—</div>
            {t.noData}
          </div>
        ) : (
          result.top_influencers.slice(0, 8).map((u, i) => (
            <a
              key={u.username || `inf-${i}`}
              href={`https://x.com/${u.username}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]/50 -mx-2 px-2 rounded-md transition slide-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="w-5 text-xs text-muted tabular font-mono">{(i + 1).toString().padStart(2, "0")}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {u.profile_picture ? (
                <img
                  src={u.profile_picture}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-[var(--border)]"
                  loading="lazy"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xs">
                  {u.username[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-sm">
                  <span className="truncate font-medium">{u.name || u.username}</span>
                  {u.verified && <BadgeCheck className="w-3.5 h-3.5 text-[color:var(--lime)] shrink-0" />}
                </div>
                <div className="text-[11px] text-muted truncate tabular">
                  @{u.username} · {formatNumber(u.followers)} {t.followersAbbr}
                </div>
              </div>
              <div className="text-right tabular">
                <div className="text-sm font-semibold">{formatNumber(u.engagement)}</div>
                <div className="text-[10px] text-muted">{t.tweetSuffix(u.tweets)}</div>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
