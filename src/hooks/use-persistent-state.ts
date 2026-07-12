"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useState backed by localStorage. The value is read once on mount (after
 * hydration, to avoid SSR mismatch) and written back whenever it changes.
 *
 * Keys are namespaced under `taskdir:` so preferences don't collide with
 * anything else on the origin.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = `taskdir:${key}`;
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  // Read the stored value once, after mount, so server and first client
  // render agree (both use `initial`).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      // Intentional: sync from the localStorage external system exactly once,
      // after hydration, so the server and first client render both use
      // `initial` (no hydration mismatch) and the stored value applies next.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* private mode / malformed value — keep initial */
    }
    hydrated.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [storageKey, value]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue(next);
  }, []);

  return [value, set];
}
