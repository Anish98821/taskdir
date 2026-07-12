// Pure types + defaults for task modes, safe to import from client components.
// Modes are user-configurable: a mode has an id (stored in meta.toml), a label,
// and an icon key (resolved to a lucide icon on the client). The engine +
// per-mode strategy files live in ./modes.ts.

export interface ModeDef {
  id: string;
  label: string;
  icon: string;
}

export interface ModesConfig {
  modes: ModeDef[];
}

export const DEFAULT_MODES: ModeDef[] = [
  { id: "plan_only", label: "plan only", icon: "pencil" },
  { id: "plan_and_execute", label: "plan + execute", icon: "list-checks" },
  { id: "fast_execute", label: "fast execute", icon: "zap" },
  { id: "report_only", label: "report only", icon: "file-check" },
];

export const DEFAULT_MODE_ID = "plan_and_execute";

// A mode id is a lowercase slug — same shape as a safe filename stem, so it can
// back a `.taskdir/strategies/<id>.md` file.
export function isModeId(s: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(s);
}

export function slugifyModeId(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export function labelForMode(modes: ModeDef[], id: string): string {
  return modes.find((m) => m.id === id)?.label ?? id;
}

export function iconKeyForMode(modes: ModeDef[], id: string): string {
  return modes.find((m) => m.id === id)?.icon ?? "list-checks";
}
