import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENTS = {
  iris: { fg: "rgb(124 132 255)", tile: "border-primary/30 bg-primary/10 text-primary" },
  green: { fg: "rgb(55 211 153)", tile: "border-ready/30 bg-ready/10 text-ready" },
  blue: { fg: "rgb(91 168 255)", tile: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  amber: { fg: "rgb(242 180 65)", tile: "border-amber/30 bg-amber/10 text-amber" },
} as const;

export type Accent = keyof typeof ACCENTS;

/** Sparkline decorativa: textura de painel, deriva uma curva suave do seed. */
export function Sparkline({ color, seed = 1, className }: { color: string; seed?: number; className?: string }) {
  const pts = React.useMemo(() => {
    const n = 16;
    let v = 0.5;
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      v += (Math.sin(i * 0.9 + seed * 2.3) + Math.cos(i * 0.4 + seed)) * 0.06;
      ys.push(Math.max(0.1, Math.min(0.9, v)));
    }
    return ys.map((y, i) => `${(i / (n - 1)) * 100},${(1 - y) * 100}`).join(" ");
  }, [seed]);

  const id = React.useId();
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("h-10 w-24", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,100 ${pts} 100,100`} fill={`url(#${id})`} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: LucideIcon;
  accent: Accent;
  seed?: number;
}

export function StatCard({ label, value, sub, icon: Icon, accent, seed }: StatCardProps) {
  const a = ACCENTS[accent];
  return (
    <div className="relative overflow-hidden rounded-lg border border-border-strong bg-surface p-5 shadow-panel">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className={cn("grid h-11 w-11 place-items-center rounded-lg border", a.tile)}>
            <Icon className="h-5 w-5" />
          </span>
          <p className="eyebrow pt-1">{label}</p>
        </div>
        <Sparkline color={a.fg} seed={seed} />
      </div>
      <div className="mt-3 font-display text-4xl font-semibold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
