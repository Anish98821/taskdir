import { PRIORITIES, type Mode, type Priority } from "../../../lib/task-types.ts";
import { DEFAULT_MODE_ID, isModeId } from "../../../lib/modes-types.ts";

export interface CreateTaskFormInput {
  title: string;
  context: string;
  priority: Priority;
  mode: Mode;
  tags: string[];
  agent?: string;
}

export function normalizeFilename(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("filename required");
  return trimmed.toLowerCase().endsWith(".md") ? trimmed : `${trimmed}.md`;
}

export function parseCreateTaskForm(formData: FormData): CreateTaskFormInput | null {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return null;

  const priorityRaw = String(formData.get("priority") ?? "med");
  const priority: Priority = (PRIORITIES as string[]).includes(priorityRaw)
    ? (priorityRaw as Priority)
    : "med";

  const modeRaw = String(formData.get("mode") ?? DEFAULT_MODE_ID);
  const mode: Mode = isModeId(modeRaw) ? modeRaw : DEFAULT_MODE_ID;

  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const context = String(formData.get("context") ?? "");
  const agent =
    String(formData.get("agent") ?? formData.get("runtime") ?? "").trim();

  return {
    title,
    context,
    priority,
    mode,
    tags,
    ...(agent ? { agent } : {}),
  };
}
