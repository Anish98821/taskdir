import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CANONICAL_FILES,
  MODES,
  PRIORITIES,
  STATUSES,
  type Mode,
  type Priority,
  type Status,
  type Task,
  type TaskFile,
  type TaskMeta,
  type TaskSummary,
} from "./task-types.ts";
import { parseFolderName, slugify, type ParsedFolder } from "./tasks/identity.ts";
import { parseMetaToml, stringifyMetaToml } from "./tasks/meta-toml.ts";
import { ensureTasksDir, tasksDir } from "./tasks/paths.ts";
import {
  assertSafeFilename,
  isMode,
  isPriority,
  isStatus,
} from "./tasks/validation.ts";

export {
  CANONICAL_FILES,
  MODES,
  PRIORITIES,
  STATUSES,
  type Mode,
  type Priority,
  type Status,
  type Task,
  type TaskFile,
  type TaskMeta,
  type TaskSummary,
};

const FILE_ORDER: readonly string[] = CANONICAL_FILES;

export { tasksDir };

interface TaskIndex {
  dir: string;
  parsed: ParsedFolder[];
  byId: Map<string, ParsedFolder>;
}

export function invalidateTaskIndex(): void {
  // Kept for callers that conceptually invalidate task data. The task index is
  // loaded from disk on demand so external MCP/hook writes are visible.
}

async function readSummary(dir: string, parsed: ParsedFolder): Promise<TaskSummary | null> {
  const taskPath = path.join(dir, parsed.folder);
  try {
    const [statusRaw, metaRaw, reportStat, entries] = await Promise.all([
      fs.readFile(path.join(taskPath, "status"), "utf8"),
      fs.readFile(path.join(taskPath, "meta.toml"), "utf8"),
      fs.stat(path.join(taskPath, "report.md")).catch(() => null),
      fs.readdir(taskPath, { withFileTypes: true }).catch(() => []),
    ]);
    const status = statusRaw.trim();
    if (!isStatus(status)) return null;
    const meta = parseMetaToml(metaRaw);
    const hasReportContent =
      reportStat !== null && reportStat.isFile() && reportStat.size > 0;
    const seenAt = meta.report_seen_at
      ? Date.parse(meta.report_seen_at)
      : null;
    const hasReport =
      hasReportContent &&
      (seenAt === null ||
        Number.isNaN(seenAt) ||
        reportStat.mtimeMs > seenAt);
    const fileStats = await Promise.all(
      entries
        .filter((e) => e.isFile() && !e.name.startsWith("."))
        .map((e) =>
          fs.stat(path.join(taskPath, e.name)).catch(() => null),
        ),
    );
    const lastActiveMs = fileStats.reduce<number>(
      (max, s) => (s && s.mtimeMs > max ? s.mtimeMs : max),
      0,
    );
    return {
      id: parsed.id,
      slug: parsed.slug,
      folder: parsed.folder,
      status,
      meta,
      hasReport,
      lastActiveMs,
    };
  } catch {
    return null;
  }
}

async function loadTaskIndex(): Promise<TaskIndex> {
  const dir = await ensureTasksDir();
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const parsed = entries
    .filter((e) => e.isDirectory())
    .map((e) => parseFolderName(e.name))
    .filter((p): p is ParsedFolder => p !== null);
  return {
    dir,
    parsed,
    byId: new Map(parsed.map((p) => [p.id, p])),
  };
}

export interface ListFilter {
  status?: Status;
  tag?: string;
  priority?: Priority;
}

export async function listTasks(filter: ListFilter = {}): Promise<TaskSummary[]> {
  const { dir, parsed } = await loadTaskIndex();
  const summaries = (await Promise.all(parsed.map((p) => readSummary(dir, p))))
    .filter((t): t is TaskSummary => t !== null);
  return summaries.filter((t) => {
    if (filter.status && t.status !== filter.status) return false;
    if (filter.priority && t.meta.priority !== filter.priority) return false;
    if (filter.tag && !t.meta.tags.includes(filter.tag)) return false;
    return true;
  });
}

async function findFolderById(id: string): Promise<ParsedFolder | null> {
  const { byId } = await loadTaskIndex();
  return byId.get(id) ?? null;
}

export async function getTask(id: string): Promise<Task | null> {
  const dir = tasksDir();
  const parsed = await findFolderById(id);
  if (!parsed) return null;
  const summary = await readSummary(dir, parsed);
  if (!summary) return null;
  const taskPath = path.join(dir, parsed.folder);
  const entries = await fs.readdir(taskPath, { withFileTypes: true });
  const mdNames = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort((a, b) => {
      const ai = FILE_ORDER.indexOf(a);
      const bi = FILE_ORDER.indexOf(b);
      if (ai !== -1 || bi !== -1) {
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }
      return a.localeCompare(b);
    });
  const files = await Promise.all(
    mdNames.map(async (name) => {
      const filePath = path.join(taskPath, name);
      const [content, stat] = await Promise.all([
        fs.readFile(filePath, "utf8"),
        fs.stat(filePath),
      ]);
      return { name, content, mtimeMs: stat.mtimeMs };
    }),
  );
  return { ...summary, files };
}

async function nextId(dir: string): Promise<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let max = 0;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = parseFolderName(e.name);
    if (!p) continue;
    const n = parseInt(p.id, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1).padStart(4, "0");
}

export interface CreateTaskInput {
  title: string;
  context?: string;
  priority?: Priority;
  mode?: Mode;
  tags?: string[];
  generate_report?: boolean;
  agent?: string;
}

export async function createTask(input: CreateTaskInput): Promise<TaskSummary> {
  const dir = await ensureTasksDir();
  const id = await nextId(dir);
  const slug = slugify(input.title);
  const folder = `${id}-${slug}`;
  const taskPath = path.join(dir, folder);
  await fs.mkdir(taskPath);
  const meta: TaskMeta = {
    title: input.title,
    created_at: new Date().toISOString(),
    priority: input.priority ?? "med",
    mode: input.mode ?? "plan_and_execute",
    tags: input.tags ?? [],
    generate_report: input.generate_report ?? true,
    ...(input.agent?.trim() ? { agent: input.agent.trim() } : {}),
  };
  const status: Status = "pending";
  const writes: Promise<unknown>[] = [
    fs.writeFile(path.join(taskPath, "status"), status + "\n", "utf8"),
    fs.writeFile(path.join(taskPath, "meta.toml"), stringifyMetaToml(meta), "utf8"),
  ];
  if (input.context && input.context.trim().length > 0) {
    writes.push(fs.writeFile(path.join(taskPath, "context.md"), input.context, "utf8"));
  }
  await Promise.all(writes);
  invalidateTaskIndex();
  return {
    id,
    slug,
    folder,
    status,
    meta,
    hasReport: false,
    lastActiveMs: Date.now(),
  };
}

export async function updateStatus(id: string, status: Status): Promise<void> {
  if (!isStatus(status)) throw new Error(`invalid status: ${status}`);
  const parsed = await findFolderById(id);
  if (!parsed) throw new Error(`task not found: ${id}`);
  const taskPath = path.join(tasksDir(), parsed.folder);
  await fs.writeFile(path.join(taskPath, "status"), status + "\n", "utf8");
  invalidateTaskIndex();
}

export async function deleteTask(id: string): Promise<void> {
  const parsed = await findFolderById(id);
  if (!parsed) throw new Error(`task not found: ${id}`);
  const taskPath = path.join(tasksDir(), parsed.folder);
  await fs.rm(taskPath, { recursive: true, force: true });
  invalidateTaskIndex();
}

export interface MetaPatch {
  title?: string;
  priority?: Priority;
  mode?: Mode;
  tags?: string[];
  generate_report?: boolean;
  agent?: string | null;
  report_seen_at?: string;
}

export async function updateMeta(id: string, patch: MetaPatch): Promise<TaskMeta> {
  const parsed = await findFolderById(id);
  if (!parsed) throw new Error(`task not found: ${id}`);
  const taskPath = path.join(tasksDir(), parsed.folder);
  const current = parseMetaToml(await fs.readFile(path.join(taskPath, "meta.toml"), "utf8"));
  if (patch.priority !== undefined && !isPriority(patch.priority)) {
    throw new Error(`invalid priority: ${patch.priority}`);
  }
  if (patch.mode !== undefined && !isMode(patch.mode)) {
    throw new Error(`invalid mode: ${patch.mode}`);
  }
  const next: TaskMeta = {
    ...current,
    ...(patch.title !== undefined ? { title: patch.title.trim() || current.title } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
    ...(patch.generate_report !== undefined
      ? { generate_report: patch.generate_report }
      : {}),
    ...(patch.agent !== undefined
      ? patch.agent?.trim()
        ? { agent: patch.agent.trim() }
        : { agent: undefined }
      : {}),
    ...(patch.tags !== undefined
      ? { tags: patch.tags.map((t) => t.trim()).filter(Boolean) }
      : {}),
    ...(patch.report_seen_at !== undefined
      ? { report_seen_at: patch.report_seen_at }
      : {}),
  };
  if (next.agent === undefined) delete next.agent;
  await fs.writeFile(path.join(taskPath, "meta.toml"), stringifyMetaToml(next), "utf8");
  invalidateTaskIndex();
  return next;
}

export async function appendToFile(id: string, filename: string, content: string): Promise<void> {
  assertSafeFilename(filename);
  const parsed = await findFolderById(id);
  if (!parsed) throw new Error(`task not found: ${id}`);
  const filePath = path.join(tasksDir(), parsed.folder, filename);
  await fs.appendFile(filePath, content, "utf8");
}

export async function writeFile(id: string, filename: string, content: string): Promise<number> {
  assertSafeFilename(filename);
  const parsed = await findFolderById(id);
  if (!parsed) throw new Error(`task not found: ${id}`);
  const filePath = path.join(tasksDir(), parsed.folder, filename);
  await fs.writeFile(filePath, content, "utf8");
  const stat = await fs.stat(filePath);
  return stat.mtimeMs;
}

export interface FileConflict {
  conflict: true;
  currentMtimeMs: number;
  currentContent: string;
}
export type WriteResult = { ok: true; mtimeMs: number } | FileConflict;

export async function writeFileChecked(
  id: string,
  filename: string,
  content: string,
  baselineMtimeMs: number | null,
): Promise<WriteResult> {
  assertSafeFilename(filename);
  const parsed = await findFolderById(id);
  if (!parsed) throw new Error(`task not found: ${id}`);
  const filePath = path.join(tasksDir(), parsed.folder, filename);
  if (baselineMtimeMs !== null) {
    let currentStat;
    try {
      currentStat = await fs.stat(filePath);
    } catch {
      currentStat = null;
    }
    if (currentStat && Math.abs(currentStat.mtimeMs - baselineMtimeMs) > 1) {
      const currentContent = await fs.readFile(filePath, "utf8");
      return { conflict: true, currentMtimeMs: currentStat.mtimeMs, currentContent };
    }
  }
  await fs.writeFile(filePath, content, "utf8");
  const stat = await fs.stat(filePath);
  return { ok: true, mtimeMs: stat.mtimeMs };
}

export async function createFile(id: string, filename: string): Promise<void> {
  assertSafeFilename(filename);
  const parsed = await findFolderById(id);
  if (!parsed) throw new Error(`task not found: ${id}`);
  const filePath = path.join(tasksDir(), parsed.folder, filename);
  await fs.writeFile(filePath, "", { flag: "wx" });
}

export async function renameFile(id: string, oldName: string, newName: string): Promise<void> {
  assertSafeFilename(oldName);
  assertSafeFilename(newName);
  if (oldName === newName) return;
  const parsed = await findFolderById(id);
  if (!parsed) throw new Error(`task not found: ${id}`);
  const dir = path.join(tasksDir(), parsed.folder);
  await fs.rename(path.join(dir, oldName), path.join(dir, newName));
}

export async function deleteFile(id: string, filename: string): Promise<void> {
  assertSafeFilename(filename);
  const parsed = await findFolderById(id);
  if (!parsed) throw new Error(`task not found: ${id}`);
  await fs.unlink(path.join(tasksDir(), parsed.folder, filename));
}
