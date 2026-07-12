import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertSafeFilename, isMode, isPriority, isStatus } from "./validation.ts";

describe("task enum validation", () => {
  it("accepts known priorities and well-formed status/mode ids", () => {
    assert.equal(isStatus("pending"), true);
    assert.equal(isStatus("done"), true);
    // Statuses are user-defined; isStatus accepts any well-formed slug id.
    // Whether an id is configured is checked at write time.
    assert.equal(isStatus("in_review"), true);
    assert.equal(isPriority("high"), true);
    // Modes are user-defined; isMode accepts any well-formed slug id.
    assert.equal(isMode("plan_and_execute"), true);
    assert.equal(isMode("my-custom-mode"), true);
  });

  it("rejects unknown priorities and malformed status/mode ids", () => {
    assert.equal(isStatus("In Review"), false); // spaces / uppercase
    assert.equal(isStatus(""), false);
    assert.equal(isPriority("urgent"), false);
    assert.equal(isMode("Execute Only"), false); // spaces / uppercase
    assert.equal(isMode(""), false);
    assert.equal(isMode("../evil"), false);
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
