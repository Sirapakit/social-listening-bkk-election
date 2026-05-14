"use client";
import { formatNumber } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  accent?: string;
  hint?: string;
  format?: "number" | "percent" | "raw";
  icon?: React.ReactNode;
  index?: number;
}

export function MetricCard({ label, value, accent, hint, format = "number", icon, index = 0 }: Props) {
  const display =
    format === "percent" ? `${value.toFixed(1)}%`
      : format === "raw" ? value.toLocaleString()
      : formatNumber(value);

  return (
    <div
      className="card p-4 flex flex-col gap-1.5 min-w-0 transition hover:border-[var(--border-strong)] slide-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center gap-2 text-[var(--text-xs)] uppercase tracking-wider text-muted font-medium">
        {icon && <span className="text-[var(--muted-2)]">{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      <div
        key={value}
        className={cn("pop text-[28px] sm:text-[32px] font-bold tabular leading-none mt-0.5")}
        style={{ color: accent ?? "var(--foreground)" }}
      >
        {display}
      </div>
      {hint ? <div className="text-xs text-muted truncate">{hint}</div> : null}
    </div>
  );
}
