import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fireHooks, parseHooksToml } from "./hooks.ts";

const prevRoot = process.env.TASKDIR_PROJECT_ROOT;
const roots: string[] = [];

async function useTempProjectRoot(hooksToml?: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "taskdir-hooks-test-"));
  roots.push(dir);
  process.env.TASKDIR_PROJECT_ROOT = dir;
  if (hooksToml !== undefined) {
    await mkdir(join(dir, ".taskdir"), { recursive: true });
    await writeFile(join(dir, ".taskdir", "hooks.toml"), hooksToml, "utf8");
  }
  return dir;
}

interface Received {
  event: string;
  data: Record<string, unknown>;
}

async function withServer(
  fn: (url: string, received: Received[]) => Promise<void>,
): Promise<void> {
  const received: Received[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        received.push(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        /* ignore malformed */
      }
      res.writeHead(200);
      res.end("ok");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  try {
    await fn(`http://127.0.0.1:${port}/`, received);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

afterEach(async () => {
  if (prevRoot === undefined) delete process.env.TASKDIR_PROJECT_ROOT;
  else process.env.TASKDIR_PROJECT_ROOT = prevRoot;
  await Promise.all(roots.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe("parseHooksToml", () => {
  it("parses valid hook tables and drops invalid ones", () => {
    const config = parseHooksToml(`
[[hook]]
event = "task.created"
type = "command"
command = "echo hi"

[[hook]]
event = "*"
type = "webhook"
url = "https://example.com"
name = "all"

# invalid: unknown event
[[hook]]
event = "task.exploded"
type = "command"
command = "echo no"

# invalid: bad type
[[hook]]
event = "task.created"
type = "smoke-signal"
`);
    assert.deepEqual(config.hooks, [
      { event: "task.created", type: "command", command: "echo hi" },
      { event: "*", type: "webhook", url: "https://example.com", name: "all" },
    ]);
  });
});

describe("fireHooks", () => {
  it("posts the payload to a matching webhook", async () => {
    await withServer(async (url, received) => {
      await useTempProjectRoot(
        `[[hook]]\nevent = "task.created"\ntype = "webhook"\nurl = "${url}"\n`,
      );
      await fireHooks("task.created", { id: "0001", title: "Hi" });
      assert.equal(received.length, 1);
      assert.equal(received[0].event, "task.created");
      assert.deepEqual(received[0].data, { id: "0001", title: "Hi" });
    });
  });

  it("fires for the '*' wildcard event", async () => {
    await withServer(async (url, received) => {
      await useTempProjectRoot(
        `[[hook]]\nevent = "*"\ntype = "webhook"\nurl = "${url}"\n`,
      );
      await fireHooks("agent.registered", { id: "codex" });
      assert.equal(received.length, 1);
      assert.equal(received[0].event, "agent.registered");
    });
  });

  it("does not fire for non-matching events", async () => {
    await withServer(async (url, received) => {
      await useTempProjectRoot(
        `[[hook]]\nevent = "task.deleted"\ntype = "webhook"\nurl = "${url}"\n`,
      );
      await fireHooks("task.created", { id: "0001" });
      assert.equal(received.length, 0);
    });
  });

  it("is a no-op when there is no hooks config", async () => {
    await useTempProjectRoot();
    await fireHooks("task.created", { id: "0001" }); // must not throw
  });
});
