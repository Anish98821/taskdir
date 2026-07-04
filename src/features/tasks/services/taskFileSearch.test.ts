import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  clearFileSearchCache,
  MAX_FILE_SEARCH_RESULTS,
  searchFiles,
} from "./taskFileSearch.ts";
import {
  registerTempTasksDirCleanup,
  useTempTasksDir,
} from "../../../lib/test-support/temp-tasks-dir.ts";

let root: string;

registerTempTasksDirCleanup();

async function touch(rel: string): Promise<void> {
  const abs = join(root, rel);
  await mkdir(join(abs, ".."), { recursive: true });
  await writeFile(abs, rel, "utf8");
}

beforeEach(async () => {
  root = await useTempTasksDir("taskdir-file-search-test-");
});

describe("searchFiles", () => {
  it("walks project files while skipping ignored directories and hidden files", async () => {
    await touch("README.md");
    await touch("src/app/page.tsx");
    await touch("node_modules/pkg/index.js");
    await touch(".git/config");
    await touch(".secret");
    await touch(".gitignore");
    await touch(".mcp.json");
    await touch(".env.example");

    assert.deepEqual(await searchFiles(root, ""), [
      ".mcp.json",
      "README.md",
      ".gitignore",
      ".env.example",
      "src/app/page.tsx",
    ]);
  });

  it("matches queries case-insensitively and sorts nearest matches first", async () => {
    await touch("src/components/task-list.tsx");
    await touch("docs/task-notes.md");
    await touch("tasks/0001-plan.md");
    await touch("README.md");

    assert.deepEqual(await searchFiles(root, "TASK"), [
      "tasks/0001-plan.md",
      "docs/task-notes.md",
      "src/components/task-list.tsx",
    ]);
  });

  it("limits results", async () => {
    for (let i = 0; i < MAX_FILE_SEARCH_RESULTS + 5; i += 1) {
      await touch(`files/${String(i).padStart(3, "0")}.txt`);
    }

    const results = await searchFiles(root, "");
    assert.equal(results.length, MAX_FILE_SEARCH_RESULTS);
    assert.equal(results[0], "files/000.txt");
    assert.equal(results.at(-1), "files/049.txt");
  });

  it("reuses cached paths until explicitly cleared", async () => {
    await touch("first.md");
    assert.deepEqual(await searchFiles(root, "second"), []);

    await touch("second.md");
    assert.deepEqual(await searchFiles(root, "second"), []);

    clearFileSearchCache();
    assert.deepEqual(await searchFiles(root, "second"), ["second.md"]);
  });
});
