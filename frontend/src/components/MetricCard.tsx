"use client";
import { formatNumber } from "@/lib/api";

interface Props {
  label: string;
  value: number;
  accent?: string;
  hint?: string;
  format?: "number" | "percent" | "raw";
  icon?: React.ReactNode;
  index?: number;
  sparkline?: number[];
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 56; const h = 22;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 3) - 1.5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible shrink-0" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}

export function MetricCard({
  label,
  value,
  accent,
  hint,
  format = "number",
  icon,
  index = 0,
  sparkline,
}: Props) {
  const display =
    format === "percent" ? `${value.toFixed(1)}%`
    : format === "raw"   ? value.toLocaleString()
    : formatNumber(value);

  const color = accent ?? "var(--foreground)";

  return (
    <div
      className="card p-4 flex flex-col gap-2 min-w-0 card-hover slide-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Label row */}
      <div
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-medium"
        style={{ color: "var(--muted)" }}
      >
        {icon && <span>{icon}</span>}
        <span className="truncate">{label}</span>
      </div>

      {/* Value + sparkline */}
      <div className="flex items-end justify-between gap-2">
        <div
          key={value}
          className="pop text-[26px] font-bold tabular leading-none"
          style={{ color }}
        >
          {display}
        </div>
        {sparkline && sparkline.length >= 2 && (
          <Sparkline data={sparkline} color={color} />
        )}
      </div>

      {/* Hint */}
      {hint && (
        <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}
