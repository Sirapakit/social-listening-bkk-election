"use client";
import { MessageSquare, Users, Heart, Eye } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { KeywordResult } from "@/lib/types";
import { MetricCard } from "./MetricCard";
import { SentimentDonut } from "./SentimentDonut";
import { TopPosts } from "./TopPosts";
import { TopInfluencers } from "./TopInfluencers";
import { HashtagCloud } from "./HashtagCloud";

export function KeywordPanel({ result }: { result: KeywordResult }) {
  const { t } = useT();
  return (
    <section
      className="card-strong p-5 flex flex-col gap-4"
      style={{
        borderTop: `3px solid ${result.color}`,
      }}
    >
      <header className="flex items-center gap-3 pb-2 border-b border-[var(--border)]">
        <span
          className="w-3.5 h-3.5 rounded-full"
          style={{ background: result.color }}
        />
        <h2 className="text-xl font-bold">{result.label}</h2>
        <span
          className="ml-auto text-xs font-mono px-2 py-1 rounded-md"
          style={{
            color: result.color,
            background: `color-mix(in oklab, ${result.color} 14%, transparent)`,
          }}
        >
          {result.share_of_voice}{t.sovSuffix}
        </span>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label={t.buzzMetric}
          value={result.totals.tweets}
          accent={result.color}
          icon={<MessageSquare className="w-3 h-3" />}
          index={0}
        />
        <MetricCard
          label={t.reachMetric}
          value={result.totals.reach}
          icon={<Users className="w-3 h-3" />}
          index={1}
        />
        <MetricCard
          label={t.engagementMetric}
          value={result.totals.engagement}
          icon={<Heart className="w-3 h-3" />}
          index={2}
        />
        <MetricCard
          label={t.viewsMetric}
          value={result.totals.views}
          icon={<Eye className="w-3 h-3" />}
          index={3}
        />
      </div>

      <div className="card p-5">
        <SentimentDonut sentiment={result.sentiment} label={result.label} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopPosts result={result} />
        <div className="flex flex-col gap-4">
          <TopInfluencers result={result} />
          <HashtagCloud result={result} />
        </div>
      </div>
    </section>
  );
}
