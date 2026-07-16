// Task-status registry.
//
// Statuses live in `.taskdir/statuses.toml` as `[[status]]` tables. When the
// file is absent, the built-in defaults are used. Users can relabel, recolor,
// remove any status, or add their own — the config is the single source of
// truth.

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  DEFAULT_STATUS_COLOR,
  DEFAULT_STATUSES,
  isStatusId,
  STATUS_COLORS,
  type StatusDef,
  type StatusesConfig,
} from "./statuses-types.ts";
import { projectRoot } from "./project-root.ts";

export {
  DEFAULT_STATUSES,
  isStatusId,
  slugifyStatusId,
  type StatusDef,
  type StatusesConfig,
} from "./statuses-types.ts";

function statusesPath(): string {
  return path.join(projectRoot(), ".taskdir", "statuses.toml");
}

function escapeString(s: string): string {
  return s.replace(/"/g, "'");
}

function parseStringValue(value: string): string | null {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  return null;
}

export function parseStatusesToml(src: string): StatusesConfig {
  const statuses: StatusDef[] = [];
  let current: Partial<StatusDef> | null = null;
  const flush = () => {
    if (current?.id && isStatusId(current.id)) {
      statuses.push({
        id: current.id,
        label: (current.label ?? current.id).trim() || current.id,
        color: current.color?.trim() || DEFAULT_STATUS_COLOR,
      });
    }
    current = null;
  };
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "[[status]]") {
      flush();
      current = {};
      continue;
    }
    if (!current) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = parseStringValue(line.slice(eq + 1).trim());
    if (value === null) continue;
    if (key === "id") current.id = value;
    else if (key === "label") current.label = value;
    else if (key === "color") current.color = value;
  }
  flush();
  return { statuses: normalizeStatuses(statuses) };
}

export function stringifyStatusesToml(config: StatusesConfig): string {
  const blocks = config.statuses.map((s) =>
    [
      `[[status]]`,
      `id = "${escapeString(s.id)}"`,
      `label = "${escapeString(s.label)}"`,
      `color = "${escapeString(s.color)}"`,
    ].join("\n"),
  );
  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}

// Dedupe and validate. Every status is removable — the config is the single
// source of truth for what statuses exist.
export function normalizeStatuses(statuses: StatusDef[]): StatusDef[] {
  const seen = new Set<string>();
  const out: StatusDef[] = [];
  for (const s of statuses) {
    const id = s.id.trim();
    if (!id || !isStatusId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: s.label.trim() || id,
      color: (STATUS_COLORS as readonly string[]).includes(s.color.trim())
        ? s.color.trim()
        : DEFAULT_STATUS_COLOR,
    });
  }
  return out;
}

export async function readStatusesConfig(): Promise<StatusesConfig> {
  try {
    const raw = await fs.readFile(statusesPath(), "utf8");
    const parsed = parseStatusesToml(raw);
    if (parsed.statuses.length > 0) return parsed;
  } catch {
    /* no config — fall through to defaults */
  }
  return { statuses: DEFAULT_STATUSES.map((s) => ({ ...s })) };
}

export async function writeStatusesConfig(
  config: StatusesConfig,
): Promise<StatusesConfig> {
  const normalized: StatusesConfig = {
    statuses: normalizeStatuses(config.statuses),
  };
  // Never let a project end up with zero statuses.
  if (normalized.statuses.length === 0) {
    normalized.statuses = DEFAULT_STATUSES.map((s) => ({ ...s }));
  }
  await fs.mkdir(path.dirname(statusesPath()), { recursive: true });
  await fs.writeFile(statusesPath(), stringifyStatusesToml(normalized), "utf8");
  return normalized;
}

export async function isConfiguredStatus(id: string): Promise<boolean> {
  const { statuses } = await readStatusesConfig();
  return statuses.some((s) => s.id === id);
}
