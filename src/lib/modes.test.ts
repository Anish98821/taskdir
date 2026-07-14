import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_MODES,
  parseModesToml,
  readModesConfig,
  readModesWithStrategies,
  readStrategy,
  stringifyModesToml,
  writeModesConfig,
  writeStrategy,
} from "./modes.ts";

const prevRoot = process.env.TASKDIR_PROJECT_ROOT;
const roots: string[] = [];

async function useTempProjectRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "taskdir-modes-test-"));
  roots.push(dir);
  process.env.TASKDIR_PROJECT_ROOT = dir;
  return dir;
}

afterEach(async () => {
  if (prevRoot === undefined) delete process.env.TASKDIR_PROJECT_ROOT;
  else process.env.TASKDIR_PROJECT_ROOT = prevRoot;
  await Promise.all(roots.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe("parseModesToml", () => {
  it("parses valid mode tables and drops invalid ids", () => {
    const config = parseModesToml(`
[[mode]]
id = "plan_only"
label = "plan only"
icon = "pencil"

[[mode]]
id = "Bad Id"
label = "nope"
`);
    assert.deepEqual(config.modes, [
      { id: "plan_only", label: "plan only", icon: "pencil" },
    ]);
  });

  it("round-trips through stringify", () => {
    const config = { modes: DEFAULT_MODES.map((m) => ({ ...m })) };
    assert.deepEqual(parseModesToml(stringifyModesToml(config)), config);
  });
});

describe("modes config store", () => {
  it("returns the built-in defaults when there is no config", async () => {
    await useTempProjectRoot();
    const config = await readModesConfig();
    assert.deepEqual(config.modes, DEFAULT_MODES);
  });

  it("writes and reads back custom modes, ignoring malformed ones", async () => {
    await useTempProjectRoot();
    const saved = await writeModesConfig({
      modes: [
        { id: "triage", label: "Triage", icon: "bug" },
        { id: "bad id", label: "x", icon: "zap" },
      ],
    });
    assert.deepEqual(saved.modes, [{ id: "triage", label: "Triage", icon: "bug" }]);
    assert.deepEqual((await readModesConfig()).modes, saved.modes);
  });

  it("never persists an empty mode set", async () => {
    await useTempProjectRoot();
    const saved = await writeModesConfig({ modes: [] });
    assert.deepEqual(saved.modes, DEFAULT_MODES);
  });
});

describe("strategies", () => {
  it("writes, reads, and deletes a mode strategy", async () => {
    const root = await useTempProjectRoot();
    await writeStrategy("plan", "Draft a plan, then stop.");
    assert.equal(await readStrategy("plan"), "Draft a plan, then stop.");

    const bundle = await readModesWithStrategies();
    assert.equal(bundle.strategies.plan, "Draft a plan, then stop.");

    // Writing empty content removes the strategy file.
    await writeStrategy("plan", "   ");
    assert.equal(await readStrategy("plan"), "");
    await assert.rejects(readFile(join(root, ".taskdir", "strategies", "plan.md")));
  });

  it("rejects a strategy id that isn't a valid mode id", async () => {
    await useTempProjectRoot();
    await assert.rejects(() => writeStrategy("../evil", "x"), /invalid mode id/);
  });
});
