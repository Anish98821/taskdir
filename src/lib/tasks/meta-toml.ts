import { DEFAULT_MODE_ID } from "../modes-types.ts";
import type { TaskMeta } from "../task-types.ts";
import { isMode, isPriority } from "./validation.ts";

export function parseMetaToml(src: string): TaskMeta {
  const out: Partial<TaskMeta> = { tags: [] };
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (val.startsWith("\"") && val.endsWith("\"")) {
      const str = val.slice(1, -1);
      if (key === "title") out.title = str;
      else if (key === "created_at") out.created_at = str;
      else if (key === "priority" && isPriority(str)) out.priority = str;
      else if (key === "mode" && isMode(str)) out.mode = str;
      else if (key === "agent" && str.trim()) out.agent = str.trim();
      else if (key === "runtime" && str.trim() && !out.agent)
        out.agent = str.trim();
    } else if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      const items = inner
        ? inner.split(",").map((s) => s.trim().replace(/^"|"$/g, ""))
        : [];
      if (key === "tags") out.tags = items;
    }
  }
  return {
    title: out.title ?? "(untitled)",
    created_at: out.created_at ?? new Date(0).toISOString(),
    priority: out.priority ?? "med",
    mode: out.mode ?? DEFAULT_MODE_ID,
    tags: out.tags ?? [],
    ...(out.agent ? { agent: out.agent } : {}),
  };
}

export function stringifyMetaToml(meta: TaskMeta): string {
  const esc = (s: string) => s.replace(/"/g, "'");
  const tags = meta.tags.map((t) => `"${esc(t)}"`).join(", ");
  const lines = [
    `title = "${esc(meta.title)}"`,
    `created_at = "${meta.created_at}"`,
    `priority = "${meta.priority}"`,
    `mode = "${meta.mode}"`,
    `tags = [${tags}]`,
  ];
  if (meta.agent) {
    lines.push(`agent = "${esc(meta.agent)}"`);
  }
  lines.push("");
  return lines.join("\n");
}
