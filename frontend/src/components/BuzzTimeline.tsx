"use client";
import { useT } from "@/lib/i18n";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import type { KeywordResult } from "@/lib/types";

interface Props {
  results: KeywordResult[];
}

export function BuzzTimeline({ results }: Props) {
  const { t } = useT();
  // Merge timelines into a single date-indexed series
  const byDate: Record<string, Record<string, number | string>> = {};
  for (const r of results) {
    for (const p of r.timeline) {
      if (!byDate[p.date]) byDate[p.date] = { date: p.date };
      byDate[p.date][r.label] = p.count;
    }
  }
  const data = Object.values(byDate).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm uppercase tracking-wider text-muted">{t.buzzTitle}</h3>
        <span className="text-[11px] text-muted">{t.tweetsPerDay}</span>
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <defs>
              {results.map((r) => (
                <linearGradient key={r.keyword} id={`grad-${r.keyword}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={r.color} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={r.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--muted)"
              fontSize={11}
              tickMargin={6}
              tickFormatter={(d) => String(d).slice(5)}
            />
            <YAxis stroke="var(--muted)" fontSize={11} width={36} />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            {results.map((r) => (
              <Area
                key={r.keyword}
                type="monotone"
                dataKey={r.label}
                stroke={r.color}
                strokeWidth={2.5}
                fill={`url(#grad-${r.keyword})`}
                dot={{ r: 3, fill: r.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
