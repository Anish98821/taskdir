import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStatuses,
  parseStatusesToml,
  stringifyStatusesToml,
} from "./statuses.ts";
import { DEFAULT_STATUSES } from "./statuses-types.ts";

describe("statuses toml", () => {
  it("round-trips a config", () => {
    const config = {
      statuses: [
        ...DEFAULT_STATUSES,
        { id: "in_review", label: "in review", color: "cyan" },
      ],
    };
    const parsed = parseStatusesToml(stringifyStatusesToml(config));
    assert.deepEqual(parsed.statuses, config.statuses);
  });

  it("treats the config as the single source of truth — every status is removable", () => {
    const normalized = normalizeStatuses([
      { id: "in_review", label: "in review", color: "cyan" },
    ]);
    assert.deepEqual(
      normalized.map((s) => s.id),
      ["in_review"],
    );
  });

  it("drops malformed ids, dedupes, and falls back on unknown colors", () => {
    const normalized = normalizeStatuses([
      { id: "In Review", label: "bad id", color: "cyan" },
      { id: "done", label: "shipped", color: "hotpink" },
      { id: "done", label: "dupe", color: "emerald" },
    ]);
    const done = normalized.find((s) => s.id === "done");
    assert.equal(done?.label, "shipped");
    assert.equal(done?.color, "neutral");
    assert.ok(!normalized.some((s) => s.label === "bad id"));
    assert.ok(!normalized.some((s) => s.label === "dupe"));
  });
});
