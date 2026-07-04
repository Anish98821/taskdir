import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { projectRoot } from "./project-root.ts";

export interface ProjectConfig {
  name: string;
  tasks_dir: string;
}

const DEFAULT_CONFIG: ProjectConfig = {
  name: "",
  tasks_dir: "tasks",
};

function taskdirDir(): string {
  return path.join(projectRoot(), ".taskdir");
}

function configPath(): string {
  return path.join(taskdirDir(), "config.toml");
}

function escapeString(s: string): string {
  return s.replace(/"/g, "'");
}

function parseStringValue(value: string): string | null {
  if (value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1);
  }
  return null;
}

function parseConfigToml(src: string): ProjectConfig {
  const out: ProjectConfig = { ...DEFAULT_CONFIG };
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = parseStringValue(line.slice(eq + 1).trim());
    if (value === null) continue;
    if (key === "name") out.name = value;
    else if (key === "tasks_dir") out.tasks_dir = value;
  }
  return out;
}

function stringifyConfigToml(config: ProjectConfig): string {
  const lines: string[] = [];
  if (config.name.trim()) {
    lines.push(`name = "${escapeString(config.name.trim())}"`);
  }
  lines.push(`tasks_dir = "${escapeString(config.tasks_dir)}"`);
  lines.push("");
  return lines.join("\n");
}

export async function readProjectConfig(): Promise<ProjectConfig> {
  try {
    const raw = await fs.readFile(configPath(), "utf8");
    return parseConfigToml(raw);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeProjectConfig(
  patch: Partial<ProjectConfig>,
): Promise<ProjectConfig> {
  const current = await readProjectConfig();
  const next: ProjectConfig = {
    name: (patch.name ?? current.name).trim(),
    tasks_dir: (patch.tasks_dir ?? current.tasks_dir).trim() || DEFAULT_CONFIG.tasks_dir,
  };
  await fs.mkdir(taskdirDir(), { recursive: true });
  await fs.writeFile(configPath(), stringifyConfigToml(next), "utf8");
  return next;
}
