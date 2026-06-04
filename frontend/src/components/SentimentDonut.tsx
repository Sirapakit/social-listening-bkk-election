"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useT } from "@/lib/i18n";

interface Props {
  sentiment: { positive: number; neutral: number; negative: number };
  label: string;
}

export function SentimentDonut({ sentiment, label }: Props) {
  const { t } = useT();
  const total = sentiment.positive + sentiment.neutral + sentiment.negative;
  const data = [
    { name: t.sentPositive, value: sentiment.positive, color: "var(--pos-dot)" },
    { name: t.sentNeutral,  value: sentiment.neutral,  color: "var(--neu-dot)" },
    { name: t.sentNegative, value: sentiment.negative, color: "var(--neg-dot)" },
  ];
  const posPct = total ? Math.round((sentiment.positive * 100) / total) : 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="relative w-[120px] h-[120px] shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={42}
              outerRadius={58}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "var(--elev-2)",
                color: "var(--foreground)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold tabular-nums">{posPct}%</div>
          <div className="text-[10px] uppercase tracking-wider text-muted">{t.sentLabel}</div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-sm min-w-0 w-full">
        <div className="text-[11px] uppercase tracking-wider text-muted mb-1">{label}</div>
        {data.map((d) => {
          const pct = total ? Math.round((d.value * 100) / total) : 0;
          return (
            <div key={d.name} className="flex items-center gap-2 tabular-nums">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: d.color }}
              />
              <span className="w-16">{d.name}</span>
              <span className="text-muted">{d.value}</span>
              <span className="ml-auto text-xs text-muted">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
