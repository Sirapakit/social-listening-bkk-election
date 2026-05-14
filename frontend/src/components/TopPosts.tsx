"use client";
import { Heart, MessageCircle, Repeat2, ExternalLink, BadgeCheck } from "lucide-react";
import { formatNumber } from "@/lib/api";
import type { KeywordResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const sentimentChip: Record<string, { label: string; cls: string }> = {
  positive: { label: "POS", cls: "text-[color:var(--pos)] bg-[color:var(--pos)]/15 border-[color:var(--pos)]/30" },
  neutral:  { label: "NEU", cls: "text-[color:var(--neu)] bg-[color:var(--neu)]/15 border-[color:var(--neu)]/30" },
  negative: { label: "NEG", cls: "text-[color:var(--neg)] bg-[color:var(--neg)]/15 border-[color:var(--neg)]/30" },
};

export function TopPosts({ result }: { result: KeywordResult }) {
  return (
    <div className="card p-5 flex flex-col min-h-0">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[var(--text-sm)] uppercase tracking-wider text-muted font-medium">
          Top posts
        </h3>
        <span className="text-[11px] text-muted">by engagement</span>
      </div>
      <div className="scroll-y flex flex-col gap-3 pr-1" style={{ maxHeight: 460 }}>
        {result.top_posts.length === 0 ? (
          <div className="text-sm text-muted py-8 text-center">
            <div className="opacity-50 mb-1">—</div>
            No posts yet
          </div>
        ) : (
          result.top_posts.map((p, i) => {
            const chip = sentimentChip[p.sentiment];
            const key = p.id && p.id !== "-1" ? p.id : (p.url || `row-${i}`);
            return (
              <a
                key={key}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3 hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)] transition group slide-in"
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-semibold text-sm truncate">{p.author.name || p.author.username}</span>
                  {p.author.verified && (
                    <BadgeCheck className="w-3.5 h-3.5 text-[color:var(--lime)]" />
                  )}
                  <span className="text-xs text-muted truncate">@{p.author.username}</span>
                  <span className="ml-auto text-[10px] text-muted tabular shrink-0">
                    {formatNumber(p.author.followers)} flws
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold font-mono tracking-wider px-1.5 py-0.5 rounded border shrink-0",
                      chip?.cls,
                    )}
                  >
                    {chip?.label}
                  </span>
                </div>
                <p className="text-sm leading-snug line-clamp-3 whitespace-pre-wrap">{p.text}</p>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-muted tabular">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3" /> {formatNumber(p.engagement.likes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Repeat2 className="w-3 h-3" /> {formatNumber(p.engagement.retweets)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> {formatNumber(p.engagement.replies)}
                  </span>
                  <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition" />
                </div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
