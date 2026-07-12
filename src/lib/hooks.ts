// Event hooks: fire a shell command or an HTTP webhook when things happen in
// the task substrate (task created, status changed, agent registered, ...).
//
// Config lives in `.taskdir/hooks.toml` as an array of `[[hook]]` tables:
//
//   [[hook]]
//   event = "task.status_changed"   # or "*" for every event
//   type = "command"                 # command | webhook
//   command = "notify-send \"$TASKDIR_EVENT\""
//
//   [[hook]]
//   event = "*"
//   type = "webhook"
//   url = "https://example.com/taskdir"
//
// Firing is best-effort and non-blocking: failures never break the operation
// that triggered them. Callers use `void fireHooks(...)`; tests can await the
// returned promise.

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  HOOK_EVENTS,
  isHookEvent,
  type Hook,
  type HookEvent,
  type HooksConfig,
  type HookType,
} from "./hooks-types.ts";
import { projectRoot } from "./project-root.ts";

export {
  HOOK_EVENTS,
  isHookEvent,
  type Hook,
  type HookEvent,
  type HooksConfig,
  type HookType,
};

const HOOK_TIMEOUT_MS = 10_000;

function hooksPath(): string {
  return path.join(projectRoot(), ".taskdir", "hooks.toml");
}

function parseStringValue(value: string): string | null {
  if (value.length >= 2) {
    const q = value[0];
    if ((q === '"' || q === "'") && value.endsWith(q)) {
      return value.slice(1, -1);
    }
  }
  return null;
}

// Pick a TOML quote style that survives round-trips: prefer double quotes, but
// fall back to single-quoted literal strings when the value contains double
// quotes (common in shell commands) so we don't mangle them.
function quoteValue(value: string): string {
  if (value.includes('"') && !value.includes("'")) return `'${value}'`;
  return `"${value.replace(/"/g, "'")}"`;
}

export function parseHooksToml(src: string): HooksConfig {
  const hooks: Hook[] = [];
  let current: Partial<Hook> | null = null;
  const flush = () => {
    if (!current) return;
    const event = current.event;
    const type = current.type;
    if ((event === "*" || (event && isHookEvent(event))) && (type === "command" || type === "webhook")) {
      hooks.push({
        event,
        type,
        ...(current.command ? { command: current.command } : {}),
        ...(current.url ? { url: current.url } : {}),
        ...(current.name ? { name: current.name } : {}),
      });
    }
    current = null;
  };
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "[[hook]]") {
      flush();
      current = {};
      continue;
    }
    if (!current) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = parseStringValue(line.slice(eq + 1).trim());
    if (value === null) continue;
    if (key === "event") current.event = value as HookEvent | "*";
    else if (key === "type") current.type = value as HookType;
    else if (key === "command") current.command = value;
    else if (key === "url") current.url = value;
    else if (key === "name") current.name = value;
  }
  flush();
  return { hooks };
}

export function stringifyHooksToml(config: HooksConfig): string {
  const blocks = config.hooks.map((h) => {
    const lines = [`[[hook]]`, `event = ${quoteValue(h.event)}`, `type = ${quoteValue(h.type)}`];
    if (h.type === "command" && h.command) lines.push(`command = ${quoteValue(h.command)}`);
    if (h.type === "webhook" && h.url) lines.push(`url = ${quoteValue(h.url)}`);
    if (h.name) lines.push(`name = ${quoteValue(h.name)}`);
    return lines.join("\n");
  });
  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}

function normalizeHook(h: Hook): Hook | null {
  const validEvent = h.event === "*" || isHookEvent(h.event);
  if (!validEvent) return null;
  if (h.type === "command") {
    const command = h.command?.trim();
    if (!command) return null;
    return { event: h.event, type: "command", command, ...(h.name?.trim() ? { name: h.name.trim() } : {}) };
  }
  if (h.type === "webhook") {
    const url = h.url?.trim();
    if (!url) return null;
    return { event: h.event, type: "webhook", url, ...(h.name?.trim() ? { name: h.name.trim() } : {}) };
  }
  return null;
}

export async function readHooksConfig(): Promise<HooksConfig> {
  try {
    const raw = await fs.readFile(hooksPath(), "utf8");
    return parseHooksToml(raw);
  } catch {
    return { hooks: [] };
  }
}

export async function writeHooksConfig(config: HooksConfig): Promise<HooksConfig> {
  const cleaned: HooksConfig = {
    hooks: config.hooks
      .map(normalizeHook)
      .filter((h): h is Hook => h !== null),
  };
  await fs.mkdir(path.dirname(hooksPath()), { recursive: true });
  await fs.writeFile(hooksPath(), stringifyHooksToml(cleaned), "utf8");
  return cleaned;
}

export interface HookPayload {
  event: HookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

function runCommand(hook: Hook, payload: HookPayload): Promise<void> {
  if (!hook.command) return Promise.resolve();
  const json = JSON.stringify(payload);
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const child = spawn(hook.command!, {
      shell: true,
      stdio: ["pipe", "ignore", "ignore"],
      env: {
        ...process.env,
        TASKDIR_EVENT: payload.event,
        TASKDIR_PAYLOAD: json,
        TASKDIR_PROJECT_ROOT: projectRoot(),
        ...flattenEnv(payload.data),
      },
    });
    const timer = setTimeout(() => {
      child.kill();
      done();
    }, HOOK_TIMEOUT_MS);
    timer.unref?.();
    child.on("error", () => {
      clearTimeout(timer);
      done();
    });
    child.on("close", () => {
      clearTimeout(timer);
      done();
    });
    child.stdin?.on("error", () => {});
    child.stdin?.end(json);
  });
}

// Surface scalar payload fields as TASKDIR_* env vars for simple commands.
function flattenEnv(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[`TASKDIR_${key.toUpperCase()}`] = String(value);
    }
  }
  return out;
}

async function runWebhook(hook: Hook, payload: HookPayload): Promise<void> {
  if (!hook.url) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOOK_TIMEOUT_MS);
  timer.unref?.();
  try {
    await fetch(hook.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    /* best-effort — swallow network/abort errors */
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fire all hooks registered for `event`. Best-effort: never throws, resolves
 * once every matching hook has settled (or timed out).
 */
export async function fireHooks(
  event: HookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  let config: HooksConfig;
  try {
    config = await readHooksConfig();
  } catch {
    return;
  }
  const matching = config.hooks.filter(
    (h) => h.event === event || h.event === "*",
  );
  if (matching.length === 0) return;
  const payload: HookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  await Promise.allSettled(
    matching.map((hook) =>
      hook.type === "webhook" ? runWebhook(hook, payload) : runCommand(hook, payload),
    ),
  );
}
