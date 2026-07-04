import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleMcpGet, handleMcpPost } from "./http.ts";

describe("MCP HTTP boundary", () => {
  it("returns server metadata from GET", async () => {
    const response = handleMcpGet();
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      name: "taskdir",
      protocolVersion: "2024-11-05",
    });
  });

  it("returns parse errors for invalid JSON POST bodies", async () => {
    const response = await handleMcpPost(new Request("http://taskdir.test/mcp", {
      method: "POST",
      body: "{",
    }));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "parse error" },
    });
  });

  it("returns invalid request errors for non JSON-RPC bodies", async () => {
    const response = await handleMcpPost(new Request("http://taskdir.test/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 9 }),
    }));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      jsonrpc: "2.0",
      id: 9,
      error: { code: -32600, message: "invalid request" },
    });
  });

  it("returns 204 for initialized notifications", async () => {
    const response = await handleMcpPost(new Request("http://taskdir.test/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 10,
        method: "notifications/initialized",
      }),
    }));

    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
  });
});
