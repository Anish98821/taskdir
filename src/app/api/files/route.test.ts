import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GET } from "./route.ts";

let root: string;
let previousCwd: string;

beforeEach(async () => {
  previousCwd = process.cwd();
  root = await mkdtemp(join(tmpdir(), "taskdir-files-route-test-"));
  process.chdir(root);
});

afterEach(async () => {
  process.chdir(previousCwd);
  await rm(root, { recursive: true, force: true });
});

describe("files route", () => {
  it("returns matching files in the response shape used by clients", async () => {
    await writeFile(join(root, "alpha.md"), "alpha", "utf8");
    await writeFile(join(root, "beta.txt"), "beta", "utf8");

    const response = await GET(new Request("http://taskdir.test/api/files?q=alpha"));
    const body = await response.json() as { files?: string[] };

    assert.equal(response.status, 200);
    assert.deepEqual(body, { files: ["alpha.md"] });
  });
});
