"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { saveModesConfig, saveStrategy } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";
import {
  MODE_ICON_KEYS,
  modeIcon,
} from "@/features/tasks/components/modeDisplay";
import { slugifyModeId, type ModeDef } from "@/lib/modes-types";
import { cn } from "@/lib/utils";
import {
  FormField,
  SettingsEmptyState,
  SettingsItem,
  SettingsList,
  SettingsSection,
} from "./shared";

interface Props {
  modes: ModeDef[];
  strategies: Record<string, string>;
}

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; mode: ModeDef }
  | null;

export function ModesSettings({ modes, strategies }: Props) {
  const [pending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    modes,
    (_current, next: ModeDef[]) => next,
  );
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<ModeDef | null>(null);

  const submit = (label: string, icon: string, strategy: string) => {
    let next: ModeDef[];
    let id: string;
    if (dialog?.kind === "edit") {
      id = dialog.mode.id;
      next = optimistic.map((m) => (m.id === id ? { ...m, label, icon } : m));
    } else {
      const base = slugifyModeId(label) || "mode";
      const taken = new Set(optimistic.map((m) => m.id));
      id = base;
      let n = 2;
      while (taken.has(id)) id = `${base}_${n++}`;
      next = [...optimistic, { id, label, icon }];
    }
    const strategyChanged =
      strategy !== (dialog?.kind === "edit" ? (strategies[id] ?? "") : "");
    startTransition(async () => {
      applyOptimistic(next);
      await saveModesConfig({ modes: next });
      if (strategyChanged) await saveStrategy(id, strategy);
    });
    setDialog(null);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const id = deleting.id;
    const next = optimistic.filter((m) => m.id !== id);
    startTransition(async () => {
      applyOptimistic(next);
      await saveModesConfig({ modes: next });
    });
    setDeleting(null);
  };

  const addButton = (
    <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
      <Plus data-icon="inline-start" />
      add mode
    </Button>
  );

  return (
    <SettingsSection
      title="modes"
      description={
        <>
          modes classify tasks (plan, bugfix, research, …). each can carry a{" "}
          <strong>strategy</strong> — markdown agents receive via{" "}
          <code>get_task</code>.
        </>
      }
      action={optimistic.length > 0 ? addButton : undefined}
    >
      {optimistic.length === 0 ? (
        <SettingsEmptyState
          icon={Layers}
          title="no modes defined"
          action={addButton}
        />
      ) : (
        <SettingsList>
          {optimistic.map((mode) => {
            const Icon = modeIcon(mode.icon);
            const hasStrategy = Boolean(strategies[mode.id]?.trim());
            return (
              <SettingsItem key={mode.id}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                  <span className="truncate text-sm text-foreground">
                    {mode.label}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground/70">
                    {mode.id}
                  </span>
                </div>
                {hasStrategy && (
                  <Badge variant="outline" className="text-muted-foreground">
                    strategy
                  </Badge>
                )}
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    onClick={() => setDialog({ kind: "edit", mode })}
                    aria-label={`edit mode ${mode.id}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    onClick={() => setDeleting(mode)}
                    aria-label={`remove mode ${mode.id}`}
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
        <ModeDialog
          key={dialog.kind === "edit" ? dialog.mode.id : "create"}
          initial={dialog.kind === "edit" ? dialog.mode : null}
          initialStrategy={
            dialog.kind === "edit" ? (strategies[dialog.mode.id] ?? "") : ""
          }
          pending={pending}
          onCancel={() => setDialog(null)}
          onSubmit={submit}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`remove mode "${deleting?.label ?? ""}"?`}
        description="tasks keep their mode id; the strategy file stays on disk."
        confirmLabel="remove"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
      />
    </SettingsSection>
  );
}

function ModeDialog({
  initial,
  initialStrategy,
  pending,
  onCancel,
  onSubmit,
}: {
  initial: ModeDef | null;
  initialStrategy: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (label: string, icon: string, strategy: string) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "list-checks");
  const [strategy, setStrategy] = useState(initialStrategy);
  const canSave = label.trim().length > 0 && !pending;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "edit mode" : "add mode"}</DialogTitle>
          <DialogDescription>
            {initial ? (
              <>
                stored in <code>.taskdir/modes.toml</code> as{" "}
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
            if (canSave) onSubmit(label.trim(), icon, strategy);
          }}
        >
          <FormField label="label">
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              disabled={pending}
              placeholder="e.g. code review"
            />
          </FormField>
          <FormField label="icon">
            <div className="flex flex-wrap gap-1">
              {MODE_ICON_KEYS.map((key) => {
                const OptIcon = modeIcon(key);
                const selected = key === icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIcon(key)}
                    disabled={pending}
                    aria-label={`icon ${key}`}
                    aria-pressed={selected}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md border transition-colors",
                      selected
                        ? "border-ring bg-muted text-foreground ring-2 ring-ring/40"
                        : "border-border text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground",
                    )}
                  >
                    <OptIcon className="size-4" aria-hidden />
                  </button>
                );
              })}
            </div>
          </FormField>
          <FormField label="strategy (optional)">
            <Textarea
              value={strategy}
              onChange={(e) => setStrategy(e.currentTarget.value)}
              disabled={pending}
              rows={6}
              placeholder={`how should an agent approach a "${label.trim() || "…"}" task?`}
              className="resize-y font-mono"
            />
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
                "add mode"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
