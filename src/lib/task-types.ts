// Statuses are user-configurable (see src/lib/statuses.ts). A status is stored
// as its id string; STATUSES lists the default ids seeded on init. Two more
// ids carry UI behavior when configured: awaiting_approval (approve-plan
// banner) and blocked (clarification banner).
export type Status = string;
export const STATUSES: Status[] = ["pending", "in_progress", "done"];

export const CANONICAL_FILES = ["context.md", "clarification.md", "report.md"] as const;

export type Priority = "low" | "med" | "high";
export const PRIORITIES: Priority[] = ["low", "med", "high"];

// Modes are user-configurable (see src/lib/modes.ts). A mode is stored in
// meta.toml as its id string; MODES lists the built-in default ids used when a
// project has no modes.toml.
export type Mode = string;
export const MODES: string[] = [
  "plan_only",
  "plan_and_execute",
  "fast_execute",
  "report_only",
];

export interface TaskMeta {
  title: string;
  created_at: string;
  priority: Priority;
  mode: Mode;
  tags: string[];
  generate_report: boolean;
  agent?: string;
  report_seen_at?: string;
}

export interface TaskSummary {
  id: string;
  slug: string;
  folder: string;
  status: Status;
  meta: TaskMeta;
  hasReport: boolean;
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
