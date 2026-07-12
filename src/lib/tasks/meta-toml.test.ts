import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMetaToml, stringifyMetaToml } from "./meta-toml.ts";
import type { TaskMeta } from "../task-types.ts";

describe("parseMetaToml", () => {
  it("parses known task metadata fields", () => {
    assert.deepEqual(
      parseMetaToml([
        'title = "Ship it"',
        'created_at = "2026-06-10T00:00:00.000Z"',
        'priority = "high"',
        'mode = "plan_only"',
        'tags = ["self-improvement", "tests"]',
        "generate_report = false",
        'agent = "codex"',
      ].join("\n")),
      {
        title: "Ship it",
        created_at: "2026-06-10T00:00:00.000Z",
        priority: "high",
        mode: "plan_only",
        tags: ["self-improvement", "tests"],
        generate_report: false,
        agent: "codex",
      },
    );
  });

  it("accepts legacy runtime key as agent for back-compat", () => {
    assert.equal(
      parseMetaToml('agent = "x"\nruntime = "y"').agent,
      "x",
      "agent wins when both present",
    );
    assert.equal(
      parseMetaToml('runtime = "y"').agent,
      "y",
      "runtime is read when agent is missing",
    );
  });

  it("uses current defaults for missing or invalid values", () => {
    assert.deepEqual(parseMetaToml('priority = "urgent"\nmode = "Not A Mode"'), {
      title: "(untitled)",
      created_at: new Date(0).toISOString(),
      priority: "med",
      mode: "plan_and_execute",
      tags: [],
      generate_report: true,
    });
  });
});

describe("stringifyMetaToml", () => {
  it("serializes task metadata in the stored field order", () => {
    const meta: TaskMeta = {
      title: 'Say "hello"',
      created_at: "2026-06-10T00:00:00.000Z",
      priority: "med",
      mode: "plan_and_execute",
      tags: ["docs", 'quote"tag'],
      generate_report: true,
      agent: "codex",
    };

    assert.equal(
      stringifyMetaToml(meta),
      [
        'title = "Say \'hello\'"',
        'created_at = "2026-06-10T00:00:00.000Z"',
        'priority = "med"',
        'mode = "plan_and_execute"',
        'tags = ["docs", "quote\'tag"]',
        "generate_report = true",
        'agent = "codex"',
        "",
      ].join("\n"),
    );
  });
});
