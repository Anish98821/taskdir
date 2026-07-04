import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertSafeFilename, isMode, isPriority, isStatus } from "./validation.ts";

describe("task enum validation", () => {
  it("accepts known statuses, priorities, and modes", () => {
    assert.equal(isStatus("pending"), true);
    assert.equal(isStatus("done"), true);
    assert.equal(isPriority("high"), true);
    assert.equal(isMode("plan_and_execute"), true);
  });

  it("rejects unknown statuses, priorities, and modes", () => {
    assert.equal(isStatus("started"), false);
    assert.equal(isPriority("urgent"), false);
    assert.equal(isMode("execute_only"), false);
  });
});

describe("assertSafeFilename", () => {
  it("accepts markdown filenames with task-safe characters", () => {
    assert.doesNotThrow(() => assertSafeFilename("plan_v2-okay.md"));
  });

  it("rejects traversal and non-markdown names", () => {
    assert.throws(() => assertSafeFilename("../plan.md"), /invalid filename/);
    assert.throws(() => assertSafeFilename("plan.txt"), /invalid filename/);
  });
});
