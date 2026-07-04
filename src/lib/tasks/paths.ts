import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";

import { projectRoot } from "../project-root.ts";

function readConfiguredTasksDir(root: string): string | null {
  const configPath = path.join(root, ".taskdir", "config.toml");
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    return null;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^tasks_dir\s*=\s*"([^"]+)"\s*$/);
    if (m) {
      const value = m[1];
      return path.isAbsolute(value) ? value : path.resolve(root, value);
    }
  }
  return null;
}

export function tasksDir(): string {
  if (process.env.TASKDIR_TASKS_DIR) return process.env.TASKDIR_TASKS_DIR;
  const root = projectRoot();
  const fromConfig = readConfiguredTasksDir(root);
  if (fromConfig) return fromConfig;
  return path.join(root, "tasks");
}

export async function ensureTasksDir(): Promise<string> {
  const dir = tasksDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
