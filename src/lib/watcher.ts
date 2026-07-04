import "server-only";
import chokidar from "chokidar";
import type { FSWatcher } from "chokidar";
import { invalidateTaskIndex, tasksDir } from "./tasks";

type Subscriber = () => void;

interface WatcherState {
  subscribers: Set<Subscriber>;
  watcher: FSWatcher | null;
}

const GLOBAL_KEY = Symbol.for("taskdir.taskWatcher");
type GlobalThisWithWatcher = typeof globalThis & {
  [GLOBAL_KEY]?: WatcherState;
};
const g = globalThis as GlobalThisWithWatcher;

function getState(): WatcherState {
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { subscribers: new Set(), watcher: null };
  }
  return g[GLOBAL_KEY]!;
}

function ensureWatcher(state: WatcherState): void {
  if (state.watcher) return;
  const dir = tasksDir();
  const watcher = chokidar.watch(dir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
  });
  const fire = () => {
    invalidateTaskIndex();
    for (const sub of state.subscribers) sub();
  };
  watcher.on("add", fire).on("change", fire).on("unlink", fire);
  watcher.on("addDir", fire).on("unlinkDir", fire);
  state.watcher = watcher;
}

export function subscribe(fn: Subscriber): () => void {
  const state = getState();
  ensureWatcher(state);
  state.subscribers.add(fn);
  return () => {
    state.subscribers.delete(fn);
  };
}
