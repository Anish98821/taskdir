// Resolves a status color key (from statuses.toml) to theme classes. Class
// strings are spelled out per key so Tailwind can see them at build time.

import { statusDefFor, type StatusDef } from "@/lib/statuses-types";

// Interactive chip tone: text + border + tinted background + hover.
const CHIP_TONE: Record<string, string> = {
  neutral:
    "text-muted-foreground border-border bg-muted/30 hover:border-muted-foreground/50 hover:text-foreground",
  sky: "text-sky-400 border-sky-400/30 bg-sky-400/10 hover:border-sky-400/60",
  violet:
    "text-violet-400 border-violet-400/30 bg-violet-400/10 hover:border-violet-400/60",
  amber:
    "text-amber-400 border-amber-400/30 bg-amber-400/10 hover:border-amber-400/60",
  emerald:
    "text-emerald-500 border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-500/60",
  rose: "text-rose-400 border-rose-400/30 bg-rose-400/10 hover:border-rose-400/60",
  orange:
    "text-orange-400 border-orange-400/30 bg-orange-400/10 hover:border-orange-400/60",
  cyan: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10 hover:border-cyan-400/60",
};

const TEXT_TONE: Record<string, string> = {
  neutral: "text-muted-foreground",
  sky: "text-sky-400",
  violet: "text-violet-400",
  amber: "text-amber-400",
  emerald: "text-emerald-500",
  rose: "text-rose-400",
  orange: "text-orange-400",
  cyan: "text-cyan-400",
};

// Solid swatch, for color pickers and list dots.
const DOT_TONE: Record<string, string> = {
  neutral: "bg-muted-foreground",
  sky: "bg-sky-400",
  violet: "bg-violet-400",
  amber: "bg-amber-400",
  emerald: "bg-emerald-500",
  rose: "bg-rose-400",
  orange: "bg-orange-400",
  cyan: "bg-cyan-400",
};

export function statusChipTone(statuses: StatusDef[], id: string): string {
  return CHIP_TONE[statusDefFor(statuses, id).color] ?? CHIP_TONE.neutral;
}

export function statusTextTone(statuses: StatusDef[], id: string): string {
  return TEXT_TONE[statusDefFor(statuses, id).color] ?? TEXT_TONE.neutral;
}

export function colorDotClass(color: string): string {
  return DOT_TONE[color] ?? DOT_TONE.neutral;
}

export function statusLabel(statuses: StatusDef[], id: string): string {
  return statusDefFor(statuses, id).label;
}

// Attention-ordered sort rank: active work first, done last. Custom statuses
// count as active work; ties within them keep config order.
const BUILTIN_RANK: Record<string, number> = {
  in_progress: 2,
  pending: 4,
  done: 5,
};

export function statusRank(statuses: StatusDef[], id: string): number {
  const builtin = BUILTIN_RANK[id];
  if (builtin !== undefined) return builtin;
  const i = statuses.findIndex((s) => s.id === id);
  return 3 + (i === -1 ? statuses.length : i) / (statuses.length + 1);
}
