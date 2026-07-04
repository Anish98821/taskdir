"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { FileText, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MentionRequest {
  query: string;
  anchor: { x: number; y: number };
  onSelect: (path: string) => void;
  onCancel: () => void;
}

interface FileMentionPickerProps {
  request: MentionRequest | null;
  setRequest: Dispatch<SetStateAction<MentionRequest | null>>;
}

const MAX_HEIGHT = 320;
const DIALOG_WIDTH = 380;

export function FileMentionPicker({ request, setRequest }: FileMentionPickerProps) {
  if (!request) return null;
  return (
    <PickerBody
      key={`${request.anchor.x}:${request.anchor.y}:${request.query}`}
      request={request}
      setRequest={setRequest}
    />
  );
}

function PickerBody({
  request,
  setRequest,
}: {
  request: MentionRequest;
  setRequest: Dispatch<SetStateAction<MentionRequest | null>>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(request.query);
  const [results, setResults] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    // Reflect the fact that a debounced fetch is queued.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/files?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal, cache: "no-store" },
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const body = (await res.json()) as { files?: string[] };
        setResults(body.files ?? []);
        setActive(0);
      } catch {
        // aborted or network error
      } finally {
        setLoading(false);
      }
    }, 50);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [query]);

  const cancel = useCallback(() => {
    request.onCancel();
    setRequest(null);
  }, [request, setRequest]);

  const pick = useCallback(
    (path: string) => {
      request.onSelect(path);
      setRequest(null);
    },
    [request, setRequest],
  );

  const anchor = computePosition(request.anchor);

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-40"
        onMouseDown={cancel}
      />
      <div
        role="dialog"
        aria-label="insert file link"
        className="fixed z-50 flex flex-col overflow-hidden rounded border border-border bg-popover shadow-xl"
        style={{
          left: anchor.left,
          top: anchor.top,
          width: DIALOG_WIDTH,
          maxHeight: MAX_HEIGHT,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
          <Search className="size-3 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            placeholder="search project files…"
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const choice = results[active];
                if (choice) pick(choice);
              }
            }}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            aria-label="file query"
          />
          {loading && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              …
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground/60">
              {loading ? "searching…" : "no matches"}
            </p>
          ) : (
            <ul className="py-0.5">
              {results.map((path, i) => (
                <li key={path}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(path);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-1 text-left text-xs",
                      i === active
                        ? "bg-accent/60 text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <FileText className="size-3 shrink-0 opacity-70" aria-hidden />
                    <span className="truncate font-mono">{path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function computePosition(anchor: { x: number; y: number }): {
  left: number;
  top: number;
} {
  if (typeof window === "undefined") return { left: 0, top: 0 };
  const padding = 8;
  const left = Math.max(
    padding,
    Math.min(window.innerWidth - DIALOG_WIDTH - padding, anchor.x),
  );
  const top = Math.max(
    padding,
    Math.min(window.innerHeight - MAX_HEIGHT - padding, anchor.y + 20),
  );
  return { left, top };
}
