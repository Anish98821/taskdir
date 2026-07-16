// Statuses are user-configurable (see src/lib/statuses.ts). A status is stored
// as its id string; STATUSES lists the default ids seeded on init.
export type Status = string;
export const STATUSES: Status[] = ["pending", "in_progress", "done"];

// Files with a recognized identity + fixed ordering (listed before custom
// files, in this order). clarification.md is created by the blocked flow, not
// added by hand — so it orders here but is not offered as a quick-add.
export const CANONICAL_FILES = ["context.md", "instructions.md", "clarification.md"] as const;

// The only files offered as one-click "add" suggestions in the file tab menu.
// Everything else is created via "custom…".
export const ADDABLE_FILES = ["context.md", "instructions.md"] as const;

export type Priority = "low" | "med" | "high";
export const PRIORITIES: Priority[] = ["low", "med", "high"];

// Modes are user-configurable (see src/lib/modes.ts). A mode is stored in
// meta.toml as its id string; MODES lists the built-in default ids used when a
// project has no modes.toml.
export type Mode = string;
export const MODES: string[] = ["plan", "bugfix", "research"];

export interface TaskMeta {
  title: string;
  created_at: string;
  priority: Priority;
  mode: Mode;
  tags: string[];
  agent?: string;
}

export interface TaskSummary {
  id: string;
  slug: string;
  folder: string;
  status: Status;
  meta: TaskMeta;
  lastActiveMs: number;
}

export interface TaskFile {
  name: string;
  content: string;
  mtimeMs: number;
}

export interface Task extends TaskSummary {
  files: TaskFile[];
}
