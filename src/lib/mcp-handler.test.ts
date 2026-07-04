import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  handleRpc,
  PROTOCOL_VERSION,
  SERVER_INFO,
  type JsonRpcResponse,
} from "./mcp-handler.ts";
import {
  registerTempTasksDirCleanup,
  useTempTasksDir,
} from "./test-support/temp-tasks-dir.ts";

function success(response: JsonRpcResponse | null) {
  assert.ok(response);
  assert.equal("result" in response, true);
  return response as Extract<JsonRpcResponse, { result: unknown }>;
}

function failure(response: JsonRpcResponse | null) {
  assert.ok(response);
  assert.equal("error" in response, true);
  return response as Extract<JsonRpcResponse, { error: unknown }>;
}

function textContent(result: unknown): string {
  const body = result as { content?: Array<{ type?: string; text?: string }> };
  const first = body.content?.[0];
  assert.equal(first?.type, "text");
  assert.equal(typeof first?.text, "string");
  return first!.text!;
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  id: string | number = name,
) {
  return success(await handleRpc({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  }));
}

registerTempTasksDirCleanup();

describe("handleRpc", () => {
  it("returns initialize metadata", async () => {
    const response = success(await handleRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
    }));

    assert.deepEqual(response.result, {
      protocolVersion: PROTOCOL_VERSION,
      serverInfo: SERVER_INFO,
      capabilities: { tools: {} },
    });
  });

  it("returns null for initialized notifications", async () => {
    assert.equal(
      await handleRpc({ jsonrpc: "2.0", id: 2, method: "notifications/initialized" }),
      null,
    );
  });

  it("lists MCP tools", async () => {
    const response = success(await handleRpc({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
    }));
    const result = response.result as { tools?: Array<{ name: string }> };

    assert.ok(result.tools?.some((tool) => tool.name === "create_task"));
    assert.ok(result.tools?.some((tool) => tool.name === "list_tasks"));
  });

  it("reports unknown methods as JSON-RPC errors", async () => {
    const response = failure(await handleRpc({
      jsonrpc: "2.0",
      id: "bad",
      method: "not/a-method",
    }));
    assert.deepEqual(response, {
      jsonrpc: "2.0",
      id: "bad",
      error: { code: -32601, message: "method not found: not/a-method" },
    });
  });

  it("reports malformed tool calls as JSON-RPC errors", async () => {
    const missingName = failure(await handleRpc({
      jsonrpc: "2.0",
      id: "missing-name",
      method: "tools/call",
      params: {},
    }));
    assert.deepEqual(missingName, {
      jsonrpc: "2.0",
      id: "missing-name",
      error: { code: -32602, message: "missing tool name" },
    });

    const unknownTool = failure(await handleRpc({
      jsonrpc: "2.0",
      id: "unknown-tool",
      method: "tools/call",
      params: { name: "nope", arguments: {} },
    }));
    assert.deepEqual(unknownTool, {
      jsonrpc: "2.0",
      id: "unknown-tool",
      error: { code: -32000, message: "unknown tool: nope" },
    });
  });

  it("creates and lists tasks through tool dispatch", async () => {
    await useTempTasksDir("taskdir-mcp-test-");

    const created = await callTool("create_task", {
      title: "MCP Task",
      plan: "test plan",
      priority: "high",
      tags: ["mcp", "test"],
    }, 4);
    assert.equal(textContent(created.result), "created task 0001");

    const listed = await callTool("list_tasks", { priority: "high" }, 5);
    const tasks = JSON.parse(textContent(listed.result)) as Array<{
      id: string;
      status: string;
      meta: { title: string; tags: string[] };
    }>;

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, "0001");
    assert.equal(tasks[0].status, "pending");
    assert.equal(tasks[0].meta.title, "MCP Task");
    assert.deepEqual(tasks[0].meta.tags, ["mcp", "test"]);
  });

  it("runs file lifecycle tools through tool dispatch", async () => {
    await useTempTasksDir("taskdir-mcp-file-test-");
    await callTool("create_task", { title: "File Task", plan: "plan" });

    assert.equal(
      textContent((await callTool("create_file", { id: "0001", filename: "notes.md" })).result),
      "ok",
    );
    assert.equal(
      textContent((await callTool("append_to_file", {
        id: "0001",
        filename: "notes.md",
        content: "hello",
      })).result),
      "ok",
    );
    assert.equal(
      textContent((await callTool("rename_file", {
        id: "0001",
        old_name: "notes.md",
        new_name: "journal.md",
      })).result),
      "ok",
    );

    const withJournal = textContent((await callTool("get_task", { id: "0001" })).result);
    assert.match(withJournal, /## journal\.md\n\nhello/);

    assert.equal(
      textContent((await callTool("delete_file", { id: "0001", filename: "journal.md" })).result),
      "ok",
    );
    const withoutJournal = textContent((await callTool("get_task", { id: "0001" })).result);
    assert.doesNotMatch(withoutJournal, /journal\.md/);
  });

  it("updates task status and metadata through tool dispatch", async () => {
    await useTempTasksDir("taskdir-mcp-meta-test-");
    await callTool("create_task", { title: "Original", priority: "med" });

    assert.equal(
      textContent((await callTool("update_status", {
        id: "0001",
        status: "blocked",
      })).result),
      "ok",
    );

    const meta = JSON.parse(textContent((await callTool("update_meta", {
      id: "0001",
      title: "Updated",
      priority: "high",
      mode: "plan_only",
      tags: ["mcp", "metadata"],
      generate_report: false,
      agent: "codex",
    })).result)) as {
      title: string;
      priority: string;
      mode: string;
      tags: string[];
      generate_report: boolean;
      agent: string;
    };

    assert.deepEqual(
      {
        title: meta.title,
        priority: meta.priority,
        mode: meta.mode,
        tags: meta.tags,
        generate_report: meta.generate_report,
        agent: meta.agent,
      },
      {
        title: "Updated",
        priority: "high",
        mode: "plan_only",
        tags: ["mcp", "metadata"],
        generate_report: false,
        agent: "codex",
      },
    );

    const listed = JSON.parse(textContent((await callTool("list_tasks", {
      status: "blocked",
      priority: "high",
      tag: "metadata",
    })).result)) as Array<{
      status: string;
      meta: { title: string; priority: string; mode: string; tags: string[] };
    }>;

    assert.equal(listed.length, 1);
    assert.equal(listed[0].status, "blocked");
    assert.equal(listed[0].meta.title, "Updated");
    assert.equal(listed[0].meta.mode, "plan_only");
  });

  it("reports tool argument and task lookup failures as JSON-RPC errors", async () => {
    await useTempTasksDir("taskdir-mcp-error-test-");

    const missingArgs = failure(await handleRpc({
      jsonrpc: "2.0",
      id: "missing-args",
      method: "tools/call",
      params: { name: "update_status", arguments: { id: "0001" } },
    }));
    assert.deepEqual(missingArgs, {
      jsonrpc: "2.0",
      id: "missing-args",
      error: { code: -32000, message: "id and status required" },
    });

    const missingTask = failure(await handleRpc({
      jsonrpc: "2.0",
      id: "missing-task",
      method: "tools/call",
      params: {
        name: "get_task",
        arguments: { id: "9999" },
      },
    }));
    assert.deepEqual(missingTask, {
      jsonrpc: "2.0",
      id: "missing-task",
      error: { code: -32000, message: "task not found: 9999" },
    });
  });
});
