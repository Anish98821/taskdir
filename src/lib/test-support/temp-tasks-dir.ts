import { afterEach } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirs: string[] = [];

export async function useTempTasksDir(prefix = "taskdir-test-"): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  process.env.TASKDIR_TASKS_DIR = dir;
  // Point the project root (statuses/modes/hooks/config) at the temp dir too,
  // so tests never read the developer's real .taskdir/.
  process.env.TASKDIR_PROJECT_ROOT = dir;
  return dir;
}

export function registerTempTasksDirCleanup(): void {
  afterEach(async () => {
    delete process.env.TASKDIR_TASKS_DIR;
    delete process.env.TASKDIR_PROJECT_ROOT;
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });
}
