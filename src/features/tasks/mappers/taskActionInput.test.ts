import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeFilename, parseCreateTaskForm } from "./taskActionInput.ts";

function form(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("normalizeFilename", () => {
  it("trims names and appends markdown extension when absent", () => {
    assert.equal(normalizeFilename(" notes "), "notes.md");
  });

  it("preserves existing markdown extension case behavior", () => {
    assert.equal(normalizeFilename("REPORT.MD"), "REPORT.MD");
  });

  it("rejects empty filenames", () => {
    assert.throws(() => normalizeFilename("   "), /filename required/);
  });
});

describe("parseCreateTaskForm", () => {
  it("parses valid form fields", () => {
    assert.deepEqual(
      parseCreateTaskForm(form({
        title: "  Ship Tests  ",
        context: "write coverage",
        priority: "high",
        mode: "plan_only",
        tags: " tests, self-improvement ,, ",
        generate_report: "false",
        agent: " codex ",
      })),
      {
        title: "Ship Tests",
        context: "write coverage",
        priority: "high",
        mode: "plan_only",
        tags: ["tests", "self-improvement"],
        generate_report: false,
        agent: "codex",
      },
    );
  });

  it("returns null for blank titles", () => {
    assert.equal(parseCreateTaskForm(form({ title: "  " })), null);
  });

  it("falls back for missing or invalid enum fields", () => {
    assert.deepEqual(
      parseCreateTaskForm(form({
        title: "Fallbacks",
        priority: "urgent",
        mode: "later",
      })),
      {
        title: "Fallbacks",
        context: "",
        priority: "med",
        mode: "plan_and_execute",
        tags: [],
        generate_report: true,
      },
    );
  });
});
