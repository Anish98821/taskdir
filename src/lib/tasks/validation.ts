import {
  MODES,
  PRIORITIES,
  STATUSES,
  type Mode,
  type Priority,
  type Status,
} from "../task-types.ts";

export function isStatus(s: string): s is Status {
  return (STATUSES as string[]).includes(s);
}

export function isPriority(s: string): s is Priority {
  return (PRIORITIES as string[]).includes(s);
}

export function isMode(s: string): s is Mode {
  return (MODES as string[]).includes(s);
}

export function assertSafeFilename(name: string): void {
  if (!/^[a-z0-9_-]+\.md$/i.test(name)) {
    throw new Error(`invalid filename: ${name}`);
  }
}
