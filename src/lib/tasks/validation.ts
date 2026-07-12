import {
  PRIORITIES,
  type Mode,
  type Priority,
  type Status,
} from "../task-types.ts";
import { isModeId } from "../modes-types.ts";
import { isStatusId } from "../statuses-types.ts";

// Statuses are user-defined; accept any well-formed status id (lowercase
// slug). Whether an id is actually configured is checked at write time.
export function isStatus(s: string): s is Status {
  return isStatusId(s);
}

export function isPriority(s: string): s is Priority {
  return (PRIORITIES as string[]).includes(s);
}

// Modes are user-defined; accept any well-formed mode id (lowercase slug).
export function isMode(s: string): s is Mode {
  return isModeId(s);
}

export function assertSafeFilename(name: string): void {
  if (!/^[a-z0-9_-]+\.md$/i.test(name)) {
    throw new Error(`invalid filename: ${name}`);
  }
}
