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
  command?: string;
  url?: string;
  name?: string;
}

export interface HooksConfig {
  hooks: Hook[];
}

export function isHookEvent(v: string): v is HookEvent {
  return (HOOK_EVENTS as readonly string[]).includes(v);
}
