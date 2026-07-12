"use client";

import { useEffect, useState, useTransition } from "react";
import { Eye, Pencil } from "lucide-react";
import { saveFile } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";
import { MarkdownEditor } from "@/features/tasks/components/MarkdownEditor";
import { MarkdownPreview } from "@/features/tasks/components/MarkdownPreview";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  filename: string;
  initialContent: string;
  initialMtimeMs: number;
}

interface Conflict {
  currentMtimeMs: number;
  currentContent: string;
}

export function FileEditor({ taskId, filename, initialContent, initialMtimeMs }: Props) {
  const [value, setValue] = useState(initialContent);
  const [saved, setSaved] = useState(initialContent);
  const [baselineMtime, setBaselineMtime] = useState(initialMtimeMs);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [mode, setMode] = usePersistentState<"edit" | "preview">(
    "fileEditor.mode",
    "edit",
  );
  const [pending, startTransition] = useTransition();

  const dirty = value !== saved;

  const doSave = (baseline: number | null) => {
    if (pending) return;
    const snapshot = value;
    startTransition(async () => {
      const result = await saveFile(taskId, filename, snapshot, baseline);
      if ("ok" in result) {
        setSaved(snapshot);
        setBaselineMtime(result.mtimeMs);
        setConflict(null);
      } else {
        setConflict({
          currentMtimeMs: result.currentMtimeMs,
          currentContent: result.currentContent,
        });
      }
    });
  };

  const handleSave = () => {
    if (!dirty || pending) return;
    doSave(baselineMtime);
  };

  const handleOverwrite = () => doSave(null);

  const handleReload = () => {
    if (!conflict) return;
    setValue(conflict.currentContent);
    setSaved(conflict.currentContent);
    setBaselineMtime(conflict.currentMtimeMs);
    setConflict(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setMode((m) => (m === "edit" ? "preview" : "edit"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, saved, pending, baselineMtime]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          {filename}
          {dirty && <span className="ml-2 text-amber-400">●</span>}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setMode((m) => (m === "edit" ? "preview" : "edit"))
            }
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs transition-colors",
              "border border-transparent text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground",
            )}
            title="toggle preview (⌘P)"
          >
            {mode === "edit" ? (
              <>
                <Eye className="size-3" /> preview
              </>
            ) : (
              <>
                <Pencil className="size-3" /> edit
              </>
            )}
          </button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={!dirty || pending || conflict !== null}
            className="h-6 px-2 text-xs"
          >
            {pending ? (
              <span className="inline-flex items-center gap-1.5">
                saving<InProgressDots />
              </span>
            ) : (
              "save (⌘S)"
            )}
          </Button>
        </div>
      </div>
      {conflict && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-400">
          <span>file changed on disk — overwrite or reload?</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleReload}
              disabled={pending}
              className="rounded-md border border-amber-400/30 px-2 py-0.5 transition-colors hover:border-amber-400/60 hover:bg-amber-400/10"
            >
              reload
            </button>
            <button
              type="button"
              onClick={handleOverwrite}
              disabled={pending}
              className="rounded-md border border-amber-400/30 px-2 py-0.5 transition-colors hover:border-amber-400/60 hover:bg-amber-400/10"
            >
              overwrite
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {mode === "edit" ? (
          <MarkdownEditor value={value} onChange={setValue} lineNumbers />
        ) : (
          <MarkdownPreview content={value} />
        )}
      </div>
    </div>
  );
}
