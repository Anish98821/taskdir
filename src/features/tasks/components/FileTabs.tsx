"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ClipboardList,
  FileCheck2,
  FilePlus,
  FileText,
  HelpCircle,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  createFileAction,
  deleteFileAction,
  renameFileAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";
import { ADDABLE_FILES, type TaskFile } from "@/lib/task-types";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  files: TaskFile[];
  activeName: string;
}

const FILE_ICON: Record<string, LucideIcon> = {
  "context.md": ClipboardList,
  "instructions.md": ScrollText,
  "plan.md": ClipboardList,
  "clarification.md": HelpCircle,
  "report.md": FileCheck2,
};

function iconFor(name: string): LucideIcon {
  return FILE_ICON[name] ?? FileText;
}

export function FileTabs({ taskId, files, activeName }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const fileHref = (name: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("task", taskId);
    sp.set("file", name);
    return `/?${sp.toString()}`;
  };

  const createNamed = (raw: string) => {
    const name = raw.trim();
    if (!name || pending) return;
    startTransition(async () => {
      try {
        await createFileAction(taskId, name);
        const sp = new URLSearchParams(params.toString());
        sp.set("task", taskId);
        sp.set("file", name.endsWith(".md") ? name : `${name}.md`);
        router.replace(`/?${sp.toString()}`, { scroll: false });
        setAdding(false);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed");
      }
    });
  };

  const existingNames = new Set(files.map((f) => f.name));
  const missingAddable = ADDABLE_FILES.filter((n) => !existingNames.has(n));

  const submitRename = (oldName: string, raw: string) => {
    const newN = raw.trim();
    if (!newN || pending) return;
    startTransition(async () => {
      try {
        await renameFileAction(taskId, oldName, newN);
        const sp = new URLSearchParams(params.toString());
        sp.set("task", taskId);
        sp.set("file", newN.endsWith(".md") ? newN : `${newN}.md`);
        router.replace(`/?${sp.toString()}`, { scroll: false });
        setRenaming(null);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed");
      }
    });
  };

  const confirmDelete = (name: string) => {
    startTransition(async () => {
      try {
        await deleteFileAction(taskId, name);
        if (activeName === name) {
          const sp = new URLSearchParams(params.toString());
          sp.delete("file");
          router.replace(`/?${sp.toString()}`, { scroll: false });
        }
        setPendingDelete(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed");
        setPendingDelete(null);
      }
    });
  };

  return (
    <div className="flex flex-col">
      <nav className="flex items-center gap-0 overflow-x-auto border-b border-border bg-muted/10">
        {files.map((f) => {
          const isActive = f.name === activeName;
          const Icon = iconFor(f.name);
          const isEmpty = f.content.trim().length === 0;
          return (
            <div
              key={f.name}
              className={cn(
                "group relative flex items-center border-r border-border text-xs",
                isActive
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              <Link
                href={fileHref(f.name)}
                scroll={false}
                className="flex items-center gap-1.5 px-2 py-1.5 truncate"
                title={isEmpty ? `${f.name} (empty)` : f.name}
              >
                <Icon
                  className={cn(
                    "size-3.5 shrink-0",
                    isEmpty ? "opacity-30" : "opacity-70",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "truncate",
                    isEmpty && "italic opacity-60",
                  )}
                >
                  {f.name}
                </span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="px-1.5 py-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-foreground disabled:cursor-wait disabled:opacity-50"
                  aria-label={`actions for ${f.name}`}
                  disabled={pending}
                >
                  <MoreHorizontal className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="font-mono">
                  <DropdownMenuItem
                    onSelect={() => setRenaming(f.name)}
                    disabled={pending}
                  >
                    <Pencil className="size-3" />
                    rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setPendingDelete(f.name)}
                    disabled={pending}
                  >
                    <Trash2 className="size-3" />
                    delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {isActive && (
                <span className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-foreground" />
              )}
            </div>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-1 border-r border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label="add file"
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-3.5" aria-hidden />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="font-mono">
            {missingAddable.map((n) => {
              const Icon = iconFor(n);
              return (
                <DropdownMenuItem
                  key={n}
                  onClick={() => createNamed(n)}
                  disabled={pending}
                  className="text-xs"
                >
                  <Icon className="size-3" />
                  {n}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuItem
              onClick={() => setAdding(true)}
              disabled={pending}
              className="text-xs text-muted-foreground"
            >
              <FilePlus className="size-3" />
              custom…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {error && !adding && renaming === null && (
        <div className="border-b border-destructive bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {error}
        </div>
      )}
      {pending && !error && (
        <div className="border-b border-border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
          updating files
        </div>
      )}

      {adding && (
        <FileNameDialog
          title="add file"
          description=".md is appended if there is no extension."
          confirmLabel="add file"
          initialValue=""
          pending={pending}
          error={error}
          onCancel={() => {
            setAdding(false);
            setError(null);
          }}
          onSubmit={createNamed}
        />
      )}

      {renaming !== null && (
        <FileNameDialog
          key={renaming}
          title={`rename ${renaming}`}
          description="links in other files are not updated automatically."
          confirmLabel="rename"
          initialValue={renaming.replace(/\.md$/, "")}
          pending={pending}
          error={error}
          onCancel={() => {
            setRenaming(null);
            setError(null);
          }}
          onSubmit={(value) => submitRename(renaming, value)}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next && !pending) setPendingDelete(null);
        }}
        title={`delete ${pendingDelete ?? ""}?`}
        description="this action cannot be undone."
        confirmLabel="delete"
        destructive
        pending={pending}
        onConfirm={() => pendingDelete && confirmDelete(pendingDelete)}
      />
    </div>
  );
}

function FileNameDialog({
  title,
  description,
  confirmLabel,
  initialValue,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  initialValue: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const canSave = value.trim().length > 0 && !pending;

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSubmit(value);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">filename</span>
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
              disabled={pending}
              placeholder="notes.md"
              className="font-mono"
            />
            {error && <span className="text-xs text-destructive">{error}</span>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={onCancel}
            >
              cancel
            </Button>
            <Button type="submit" size="sm" disabled={!canSave}>
              {pending ? (
                <span className="inline-flex items-center gap-1.5">
                  {confirmLabel}
                  <InProgressDots />
                </span>
              ) : (
                confirmLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
