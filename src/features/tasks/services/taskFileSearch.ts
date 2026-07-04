import { promises as fs } from "node:fs";
import path from "node:path";

const IGNORED = new Set([
  "node_modules",
  ".next",
  ".git",
  ".taskdir",
  ".browser-sessions",
  "dist",
  "build",
  "out",
  ".turbo",
  ".vercel",
]);

export const MAX_FILE_SEARCH_RESULTS = 50;
const FILE_SEARCH_CACHE_TTL_MS = 2_000;

interface FileSearchCache {
  root: string;
  loadedAt: number;
  paths: string[];
}

let fileSearchCache: FileSearchCache | null = null;

export function clearFileSearchCache(): void {
  fileSearchCache = null;
}

function shouldSkipEntry(name: string): boolean {
  if (IGNORED.has(name)) return true;
  if (name.startsWith(".") && name !== ".gitignore" && name !== ".mcp.json") {
    return name !== ".env.example";
  }
  return false;
}

async function walk(
  root: string,
  current: string,
  out: string[],
): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (shouldSkipEntry(entry.name)) continue;

    const abs = path.join(current, entry.name);
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (entry.isDirectory()) {
      await walk(root, abs, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
}

async function getSearchablePaths(root: string): Promise<string[]> {
  const now = Date.now();
  if (
    fileSearchCache?.root === root &&
    now - fileSearchCache.loadedAt < FILE_SEARCH_CACHE_TTL_MS
  ) {
    return fileSearchCache.paths;
  }

  const paths: string[] = [];
  await walk(root, root, paths);
  fileSearchCache = { root, loadedAt: now, paths };
  return paths;
}

export async function searchFiles(root: string, query: string): Promise<string[]> {
  const q = query.toLowerCase().trim();
  const paths = await getSearchablePaths(root);
  const out = q
    ? paths.filter((rel) => rel.toLowerCase().includes(q))
    : [...paths];
  out.sort((a, b) => {
    if (q) {
      const ai = a.toLowerCase().indexOf(q);
      const bi = b.toLowerCase().indexOf(q);
      if (ai !== bi) return ai - bi;
    }
    return a.length - b.length || a.localeCompare(b);
  });
  return out.slice(0, MAX_FILE_SEARCH_RESULTS);
}
