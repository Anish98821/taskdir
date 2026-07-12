// Task-mode registry + per-mode strategy files.
//
// Modes live in `.taskdir/modes.toml` as `[[mode]]` tables. When the file is
// absent, the four built-in defaults are used, so existing projects keep
// working with no config. Each mode can have a strategy — free-form markdown
// describing how to approach that class of task — stored at
// `.taskdir/strategies/<mode_id>.md` and surfaced to agents via `get_task`.

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  DEFAULT_MODES,
  isModeId,
  type ModeDef,
  type ModesConfig,
} from "./modes-types.ts";
import { projectRoot } from "./project-root.ts";

export {
  DEFAULT_MODES,
  DEFAULT_MODE_ID,
  isModeId,
  slugifyModeId,
  type ModeDef,
  type ModesConfig,
} from "./modes-types.ts";

function taskdirDir(): string {
  return path.join(projectRoot(), ".taskdir");
}

function modesPath(): string {
  return path.join(taskdirDir(), "modes.toml");
}

function strategiesDir(): string {
  return path.join(taskdirDir(), "strategies");
}

function strategyPath(id: string): string {
  if (!isModeId(id)) throw new Error(`invalid mode id: ${id}`);
  return path.join(strategiesDir(), `${id}.md`);
}

function escapeString(s: string): string {
  return s.replace(/"/g, "'");
}

function parseStringValue(value: string): string | null {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  return null;
}

export function parseModesToml(src: string): ModesConfig {
  const modes: ModeDef[] = [];
  let current: Partial<ModeDef> | null = null;
  const flush = () => {
    if (current?.id && isModeId(current.id)) {
      modes.push({
        id: current.id,
        label: (current.label ?? current.id).trim() || current.id,
        icon: current.icon?.trim() || "list-checks",
      });
    }
    current = null;
  };
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "[[mode]]") {
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
    else if (key === "icon") current.icon = value;
  }
  flush();
  return { modes };
}

export function stringifyModesToml(config: ModesConfig): string {
  const blocks = config.modes.map((m) =>
    [
      `[[mode]]`,
      `id = "${escapeString(m.id)}"`,
      `label = "${escapeString(m.label)}"`,
      `icon = "${escapeString(m.icon)}"`,
    ].join("\n"),
  );
  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}

function normalizeModes(modes: ModeDef[]): ModeDef[] {
  const seen = new Set<string>();
  const out: ModeDef[] = [];
  for (const m of modes) {
    const id = m.id.trim();
    if (!id || !isModeId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: m.label.trim() || id,
      icon: m.icon.trim() || "list-checks",
    });
  }
  return out;
}

export async function readModesConfig(): Promise<ModesConfig> {
  try {
    const raw = await fs.readFile(modesPath(), "utf8");
    const parsed = parseModesToml(raw);
    if (parsed.modes.length > 0) return parsed;
  } catch {
    /* no config — fall through to defaults */
  }
  return { modes: DEFAULT_MODES.map((m) => ({ ...m })) };
}

export async function writeModesConfig(
  config: ModesConfig,
): Promise<ModesConfig> {
  const normalized: ModesConfig = { modes: normalizeModes(config.modes) };
  // Never let a project end up with zero modes.
  if (normalized.modes.length === 0) {
    normalized.modes = DEFAULT_MODES.map((m) => ({ ...m }));
  }
  await fs.mkdir(taskdirDir(), { recursive: true });
  await fs.writeFile(modesPath(), stringifyModesToml(normalized), "utf8");
  return normalized;
}

export async function readStrategy(id: string): Promise<string> {
  try {
    return await fs.readFile(strategyPath(id), "utf8");
  } catch {
    return "";
  }
}

export async function writeStrategy(id: string, content: string): Promise<void> {
  const file = strategyPath(id);
  if (content.trim().length === 0) {
    await fs.rm(file, { force: true });
    return;
  }
  await fs.mkdir(strategiesDir(), { recursive: true });
  await fs.writeFile(file, content, "utf8");
}

export interface ModesWithStrategies {
  modes: ModeDef[];
  strategies: Record<string, string>;
}

export async function readModesWithStrategies(): Promise<ModesWithStrategies> {
  const { modes } = await readModesConfig();
  const strategies: Record<string, string> = {};
  await Promise.all(
    modes.map(async (m) => {
      const s = await readStrategy(m.id);
      if (s.trim()) strategies[m.id] = s;
    }),
  );
  return { modes, strategies };
}
