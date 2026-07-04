import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFile as writeDiskFile } from "node:fs/promises";
import { join } from "node:path";
import {
  appendToFile,
  createFile,
  createTask,
  deleteFile,
  deleteTask,
  getTask,
  listTasks,
  renameFile,
  tasksDir,
  updateMeta,
  updateStatus,
  writeFile,
  writeFileChecked,
} from "./tasks-core.ts";
import {
  registerTempTasksDirCleanup,
  useTempTasksDir,
} from "./test-support/temp-tasks-dir.ts";

registerTempTasksDirCleanup();

beforeEach(async () => {
  await useTempTasksDir("taskdir-task-service-test-");
});

describe("task service filesystem API", () => {
  it("creates, lists, and reads tasks from the configured task directory", async () => {
    const task = await createTask({
      title: "Write Tests",
      context: "cover the service",
      priority: "high",
      mode: "plan_only",
      tags: ["tests", "service"],
      agent: "codex",
    });

    assert.equal(task.id, "0001");
    assert.equal(task.slug, "write-tests");
    assert.equal(task.status, "pending");

    const listed = await listTasks({ priority: "high", tag: "tests" });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, "0001");
    assert.equal(listed[0].meta.title, "Write Tests");

    const detail = await getTask("0001");
    assert.ok(detail);
    assert.equal(detail.meta.mode, "plan_only");
    assert.equal(detail.meta.agent, "codex");
    assert.deepEqual(
      detail.files.map((file) => [file.name, file.content]),
      [["context.md", "cover the service"]],
    );
  });

  it("does not create context.md when no context body is supplied", async () => {
    await createTask({ title: "Bare" });

    const detail = await getTask("0001");
    assert.ok(detail);
    assert.deepEqual(detail.files, []);
  });

  it("does not create context.md when context body is whitespace only", async () => {
    await createTask({ title: "Whitespace", context: "   \n\n" });

    const detail = await getTask("0001");
    assert.ok(detail);
    assert.deepEqual(detail.files, []);
  });

  it("updates status and metadata", async () => {
    await createTask({ title: "Update Me" });

    await updateStatus("0001", "in_progress");
    const nextMeta = await updateMeta("0001", {
      title: "Updated",
      priority: "low",
      mode: "plan_only",
      tags: ["trimmed", "tags"],
      generate_report: true,
      agent: "claude",
    });

    assert.deepEqual(nextMeta, {
      title: "Updated",
      created_at: nextMeta.created_at,
      priority: "low",
      mode: "plan_only",
      tags: ["trimmed", "tags"],
      generate_report: true,
      agent: "claude",
    });
    const clearedMeta = await updateMeta("0001", {
      agent: null,
    });
    assert.equal(clearedMeta.agent, undefined);

    const [listed] = await listTasks({ status: "in_progress" });
    assert.equal(listed.id, "0001");
    assert.equal(listed.meta.title, "Updated");
    assert.equal(listed.meta.priority, "low");
  });

  it("filters task lists by combined status, priority, and tag", async () => {
    await createTask({
      title: "Matching",
      priority: "high",
      tags: ["self-improvement", "tests"],
    });
    await createTask({
      title: "Wrong Status",
      priority: "high",
      tags: ["self-improvement"],
    });
    await createTask({
      title: "Wrong Priority",
      priority: "low",
      tags: ["self-improvement"],
    });
    await updateStatus("0001", "in_progress");
    await updateStatus("0003", "in_progress");

    const listed = await listTasks({
      status: "in_progress",
      priority: "high",
      tag: "self-improvement",
    });

    assert.deepEqual(listed.map((task) => task.meta.title), ["Matching"]);
  });

  it("picks up external summary changes without explicit invalidation", async () => {
    await createTask({ title: "Externally Changed" });
    assert.equal((await listTasks())[0].status, "pending");

    await writeDiskFile(
      join(tasksDir(), "0001-externally-changed", "status"),
      "done\n",
      "utf8",
    );

    assert.equal((await listTasks())[0].status, "done");
  });

  it("orders canonical markdown files before custom files", async () => {
    await createTask({ title: "Ordering", context: "ctx" });
    await createFile("0001", "zeta.md");
    await createFile("0001", "clarification.md");
    await createFile("0001", "report.md");
    await createFile("0001", "alpha.md");

    const detail = await getTask("0001");
    assert.ok(detail);
    assert.deepEqual(detail.files.map((file) => file.name), [
      "context.md",
      "clarification.md",
      "report.md",
      "alpha.md",
      "zeta.md",
    ]);
  });

  it("creates, appends, renames, writes, and deletes task files", async () => {
    await createTask({ title: "Files" });

    await createFile("0001", "notes.md");
    await appendToFile("0001", "notes.md", "hello");
    await renameFile("0001", "notes.md", "journal.md");
    const mtimeMs = await writeFile("0001", "journal.md", "updated");

    assert.equal(typeof mtimeMs, "number");

    let detail = await getTask("0001");
    assert.ok(detail);
    assert.deepEqual(
      detail.files.map((file) => [file.name, file.content]),
      [["journal.md", "updated"]],
    );

    await deleteFile("0001", "journal.md");
    detail = await getTask("0001");
    assert.ok(detail);
    assert.deepEqual(detail.files.map((file) => file.name), []);
  });

  it("detects write conflicts from stale mtimes", async () => {
    await createTask({ title: "Conflicts", context: "first" });

    const detail = await getTask("0001");
    assert.ok(detail);
    const ctx = detail.files.find((file) => file.name === "context.md");
    assert.ok(ctx);

    await writeFile("0001", "context.md", "external");
    const result = await writeFileChecked("0001", "context.md", "mine", ctx.mtimeMs - 10_000);

    assert.equal("conflict" in result, true);
    assert.equal((result as { conflict: true }).conflict, true);
    assert.equal((result as { currentContent: string }).currentContent, "external");
    assert.equal(typeof (result as { currentMtimeMs: number }).currentMtimeMs, "number");
  });

  it("removes task folders", async () => {
    await createTask({ title: "Delete Me" });
    await deleteTask("0001");

    assert.equal(await getTask("0001"), null);
    assert.deepEqual(await listTasks(), []);
  });

  it("rejects mutations for missing task ids", async () => {
    await assert.rejects(() => updateStatus("9999", "done"), /task not found: 9999/);
    await assert.rejects(() => updateMeta("9999", { title: "Nope" }), /task not found: 9999/);
    await assert.rejects(() => deleteTask("9999"), /task not found: 9999/);
    await assert.rejects(() => createFile("9999", "notes.md"), /task not found: 9999/);
  });

  it("rejects invalid status values", async () => {
    await createTask({ title: "Invalid Status" });

    await assert.rejects(
      () => updateStatus("0001", "archived" as never),
      /invalid status: archived/,
    );
  });

  it("rejects unsafe filenames before touching task files", async () => {
    await createTask({ title: "Invalid Filenames", context: "ctx" });

    await assert.rejects(() => createFile("0001", "../notes.md"), /invalid filename/);
    await assert.rejects(() => appendToFile("0001", "notes.txt", "bad"), /invalid filename/);
    await assert.rejects(() => writeFile("0001", "nested/notes.md", "bad"), /invalid filename/);
    await assert.rejects(() => renameFile("0001", "context.md", "notes.txt"), /invalid filename/);
    await assert.rejects(() => deleteFile("0001", "..\\notes.md"), /invalid filename/);

    const detail = await getTask("0001");
    assert.ok(detail);
    assert.deepEqual(detail.files.map((file) => file.name), ["context.md"]);
  });

  it("rejects duplicate file creation without truncating existing content", async () => {
    await createTask({ title: "Duplicate File" });
    await createFile("0001", "context.md");
    await writeFile("0001", "context.md", "keep me");

    await assert.rejects(
      () => createFile("0001", "context.md"),
      /EEXIST|file already exists/i,
    );

    const detail = await getTask("0001");
    assert.ok(detail);
    assert.equal(detail.files.find((file) => file.name === "context.md")?.content, "keep me");
  });
});
