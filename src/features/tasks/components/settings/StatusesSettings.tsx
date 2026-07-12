"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CircleDot, Pencil, Plus, Trash2 } from "lucide-react";
import { saveStatusesConfig } from "@/app/actions";
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
import { Input } from "@/components/ui/input";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";
import { colorDotClass } from "@/features/tasks/components/statusDisplay";
import {
  DEFAULT_STATUS_COLOR,
  slugifyStatusId,
  STATUS_COLORS,
  type StatusDef,
} from "@/lib/statuses-types";
import { cn } from "@/lib/utils";
import {
  FormField,
  SettingsEmptyState,
  SettingsItem,
  SettingsList,
  SettingsSection,
} from "./shared";

interface Props {
  statuses: StatusDef[];
}

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; status: StatusDef }
  | null;

export function StatusesSettings({ statuses }: Props) {
  const [pending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    statuses,
    (_current, next: StatusDef[]) => next,
  );
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<StatusDef | null>(null);

  const persist = (next: StatusDef[]) => {
    startTransition(async () => {
      applyOptimistic(next);
      await saveStatusesConfig({ statuses: next });
    });
  };

  const submit = (label: string, color: string) => {
    if (dialog?.kind === "edit") {
      const id = dialog.status.id;
      persist(optimistic.map((s) => (s.id === id ? { ...s, label, color } : s)));
    } else {
      const base = slugifyStatusId(label) || "status";
      const taken = new Set(optimistic.map((s) => s.id));
      let id = base;
      let n = 2;
      while (taken.has(id)) id = `${base}_${n++}`;
      persist([...optimistic, { id, label, color }]);
    }
    setDialog(null);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    persist(optimistic.filter((s) => s.id !== deleting.id));
    setDeleting(null);
  };

  const addButton = (
    <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
      <Plus data-icon="inline-start" />
      add status
    </Button>
  );

  return (
    <SettingsSection
      title="statuses"
      description={
        <>
          the workflow states a task moves through. stored in{" "}
          <code>.taskdir/statuses.toml</code>; new tasks start as{" "}
          <code>pending</code>.
        </>
      }
      action={optimistic.length > 0 ? addButton : undefined}
    >
      {optimistic.length === 0 ? (
        <SettingsEmptyState icon={CircleDot} title="no statuses" action={addButton} />
      ) : (
        <SettingsList>
          {optimistic.map((status) => {
            return (
              <SettingsItem key={status.id}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border">
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      colorDotClass(status.color),
                    )}
                  />
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                  <span className="truncate text-sm text-foreground">
                    {status.label}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground/70">
                    {status.id}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    onClick={() => setDialog({ kind: "edit", status })}
                    aria-label={`edit status ${status.id}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    onClick={() => setDeleting(status)}
                    aria-label={`remove status ${status.id}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </SettingsItem>
            );
          })}
        </SettingsList>
      )}

      {dialog && (
        <StatusDialog
          key={dialog.kind === "edit" ? dialog.status.id : "create"}
          initial={dialog.kind === "edit" ? dialog.status : null}
          pending={pending}
          onCancel={() => setDialog(null)}
          onSubmit={submit}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`remove status "${deleting?.label ?? ""}"?`}
        description="tasks in this status keep it on disk and stay visible."
        confirmLabel="remove"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
      />
    </SettingsSection>
  );
}

function StatusDialog({
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  initial: StatusDef | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (label: string, color: string) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [color, setColor] = useState(initial?.color ?? DEFAULT_STATUS_COLOR);
  const canSave = label.trim().length > 0 && !pending;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "edit status" : "add status"}</DialogTitle>
          <DialogDescription>
            {initial ? (
              <>
                stored in <code>.taskdir/statuses.toml</code> as{" "}
                <code>{initial.id}</code>.
              </>
            ) : (
              "id is generated from the label."
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSubmit(label.trim(), color);
          }}
        >
          <FormField label="label">
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              disabled={pending}
              placeholder="e.g. in review"
            />
          </FormField>
          <FormField label="color">
            <div className="flex flex-wrap gap-1">
              {STATUS_COLORS.map((key) => {
                const selected = key === color;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setColor(key)}
                    disabled={pending}
                    aria-label={`color ${key}`}
                    aria-pressed={selected}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md border transition-colors",
                      selected
                        ? "border-ring bg-muted ring-2 ring-ring/40"
                        : "border-border hover:border-muted-foreground/60",
                    )}
                  >
                    <span
                      className={cn("size-3 rounded-full", colorDotClass(key))}
                    />
                  </button>
                );
              })}
            </div>
          </FormField>
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
                  saving
                  <InProgressDots />
                </span>
              ) : initial ? (
                "save changes"
              ) : (
                "add status"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
