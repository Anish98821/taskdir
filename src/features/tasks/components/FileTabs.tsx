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
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  createFileAction,
  deleteFileAction,
  renameFileAction,
} from "@/app/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CANONICAL_FILES, type TaskFile } from "@/lib/task-types";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  files: TaskFile[];
  activeName: string;
}

const FILE_ICON: Record<string, LucideIcon> = {
  "context.md": ClipboardList,
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
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const fileHref = (name: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("task", taskId);
    sp.set("file", name);
    return `/?${sp.toString()}`;
  };

  const closeAdd = () => {
    setAdding(false);
    setNewName("");
    setError(null);
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
        closeAdd();
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed");
      }
    });
  };

  const existingNames = new Set(files.map((f) => f.name));
  const missingCanonical = CANONICAL_FILES.filter((n) => !existingNames.has(n));

  const submitRename = (oldName: string) => {
    if (!renameValue.trim() || pending) return;
    const newN = renameValue.trim();
    startTransition(async () => {
      try {
        await renameFileAction(taskId, oldName, newN);
        const sp = new URLSearchParams(params.toString());
        sp.set("task", taskId);
        sp.set("file", newN.endsWith(".md") ? newN : `${newN}.md`);
        router.replace(`/?${sp.toString()}`, { scroll: false });
        setRenaming(null);
        setRenameValue("");
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
          const isRenaming = renaming === f.name;
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
              {isRenaming ? (
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => setRenaming(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename(f.name);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="w-32 border border-border bg-background px-1 py-0.5 font-mono text-xs focus:border-foreground focus:outline-none"
                  />
                </div>
              ) : (
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
              )}
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
                    onSelect={() => {
                      setRenameValue(f.name.replace(/\.md$/, ""));
                      setRenaming(f.name);
                    }}
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

        {adding ? (
          <div className="flex items-center gap-1.5 border-r border-border bg-background px-2 py-1.5 text-xs">
            <FilePlus className="size-3.5 shrink-0 opacity-70" aria-hidden />
            <input
              autoFocus
              value={newName}
              disabled={pending}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={closeAdd}
              onKeyDown={(e) => {
                if (e.key === "Enter") createNamed(newName);
                if (e.key === "Escape") closeAdd();
              }}
              placeholder="filename.md"
              className="w-32 border border-border bg-background px-1 py-0.5 font-mono text-xs focus:border-foreground focus:outline-none"
            />
            {pending && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </div>
        ) : (
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
              {missingCanonical.map((n) => {
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
        )}
      </nav>

      {error && (
        <div className="border-b border-destructive bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {error}
        </div>
      )}
      {pending && !error && (
        <div className="border-b border-border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
          updating files
        </div>
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
