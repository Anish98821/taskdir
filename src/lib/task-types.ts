export type Status =
  | "pending"
  | "in_progress"
  | "awaiting_approval"
  | "blocked"
  | "done";
export const STATUSES: Status[] = [
  "pending",
  "in_progress",
  "awaiting_approval",
  "blocked",
  "done",
];

export const CANONICAL_FILES = ["context.md", "clarification.md", "report.md"] as const;

export type Priority = "low" | "med" | "high";
export const PRIORITIES: Priority[] = ["low", "med", "high"];

export type Mode =
  | "plan_only"
  | "plan_and_execute"
  | "fast_execute"
  | "report_only";
export const MODES: Mode[] = [
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
