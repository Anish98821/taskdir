// Pure types + constants for the hooks feature, safe to import from client
// components (no node runtime). The engine lives in ./hooks.ts.

export const HOOK_EVENTS = [
  "task.created",
  "task.status_changed",
  "task.updated",
  "task.deleted",
  "agent.registered",
  "agent.unregistered",
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

export const HOOK_EVENT_CHOICES = ["*", ...HOOK_EVENTS] as const;

export type HookType = "command" | "webhook";
export const HOOK_TYPES: readonly HookType[] = ["command", "webhook"];

export interface Hook {
  event: HookEvent | "*";
  type: HookType;
  // For command hooks, exactly one of `command` or `script` is set:
  //   command — a shell command or path to a file to execute
  //   script  — inline code; the engine writes it to a temp file and runs it,
  //             honoring a shebang (e.g. `#!/usr/bin/env node`) or defaulting
  //             to the platform shell.
  command?: string;
  script?: string;
  url?: string;
  name?: string;
  // Whether the hook fires. Omitted (undefined) means enabled — only an
  // explicit `false` disables it, so existing configs keep firing.
  enabled?: boolean;
}

// A hook fires unless it has been explicitly disabled.
export function isHookEnabled(hook: Hook): boolean {
  return hook.enabled !== false;
}

// A command hook's effective action: inline script wins over a command string.
export function hookCommandSummary(hook: Hook): string {
  if (hook.type === "webhook") return hook.url ?? "";
  if (hook.script?.trim()) return hook.script.trim().split(/\r?\n/)[0] ?? "";
  return hook.command ?? "";
}

export interface HooksConfig {
  hooks: Hook[];
}

export function isHookEvent(v: string): v is HookEvent {
  return (HOOK_EVENTS as readonly string[]).includes(v);
}
