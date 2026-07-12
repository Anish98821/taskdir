// Pure types + defaults for task statuses, safe to import from client
// components. Statuses are user-configurable like modes: a status has an id
// (stored in each task's `status` file), a label, and a color key (resolved
// to theme classes on the client). The engine lives in ./statuses.ts.

export interface StatusDef {
  id: string;
  label: string;
  color: string;
}

export interface StatusesConfig {
  statuses: StatusDef[];
}

export const STATUS_COLORS = [
  "neutral",
  "sky",
  "violet",
  "amber",
  "emerald",
  "rose",
  "orange",
  "cyan",
] as const;

export const DEFAULT_STATUS_COLOR = "neutral";

// Seeded into .taskdir/statuses.toml on init, and used as the fallback when a
// project has no statuses config. Every status is removable; these three are
// just the starting point.
export const DEFAULT_STATUSES: StatusDef[] = [
  { id: "pending", label: "pending", color: "neutral" },
  { id: "in_progress", label: "in progress", color: "sky" },
  { id: "done", label: "done", color: "emerald" },
];

// A status id is a lowercase slug, same shape as a mode id.
export function isStatusId(s: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(s);
}

export function slugifyStatusId(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export function statusDefFor(statuses: StatusDef[], id: string): StatusDef {
  return (
    statuses.find((s) => s.id === id) ?? {
      id,
      label: id.replace(/_/g, " "),
      color: DEFAULT_STATUS_COLOR,
    }
  );
}
