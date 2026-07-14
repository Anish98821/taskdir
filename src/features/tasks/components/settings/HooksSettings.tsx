"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  ChevronDown,
  Code2,
  FileCode,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Terminal,
  Trash2,
  Webhook,
} from "lucide-react";
import { saveHooksConfig } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PickerDropdown } from "@/components/ui/picker-dropdown";
import { CodeEditor } from "@/features/tasks/components/CodeEditor";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";
import {
  HOOK_EVENT_CHOICES,
  HOOK_TYPES,
  hookCommandSummary,
  isHookEnabled,
  type Hook,
  type HookType,
  type HooksConfig,
} from "@/lib/hooks-types";
import { cn } from "@/lib/utils";
import {
  FormField,
  SettingsEmptyState,
  SettingsItem,
  SettingsList,
  SettingsSection,
} from "./shared";

interface Props {
  config: HooksConfig;
}

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; index: number }
  | null;

type CmdMode = "file" | "inline";
const CMD_MODES: readonly CmdMode[] = ["file", "inline"];

function eventLabel(event: Hook["event"]): string {
  return event === "*" ? "every event" : event;
}

export function HooksSettings({ config }: Props) {
  const [pending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    config.hooks,
    (_current, next: Hook[]) => next,
  );
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const persist = (next: Hook[]) => {
    startTransition(async () => {
      applyOptimistic(next);
      await saveHooksConfig({ hooks: next });
    });
  };

  const submit = (hook: Hook) => {
    if (dialog?.kind === "edit") {
      persist(optimistic.map((h, i) => (i === dialog.index ? hook : h)));
    } else {
      persist([...optimistic, hook]);
    }
    setDialog(null);
  };

  const toggleEnabled = (index: number) => {
    persist(
      optimistic.map((h, i) => {
        if (i !== index) return h;
        // Disabling sets an explicit flag; re-enabling drops it back to the
        // default (undefined) so we don't litter configs with enabled = true.
        const next: Hook = { ...h };
        if (isHookEnabled(h)) next.enabled = false;
        else delete next.enabled;
        return next;
      }),
    );
  };

  const confirmDelete = () => {
    if (deleting === null) return;
    persist(optimistic.filter((_, i) => i !== deleting));
    setDeleting(null);
  };

  const addButton = (
    <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
      <Plus data-icon="inline-start" />
      add hook
    </Button>
  );

  const deletingHook = deleting === null ? null : optimistic[deleting];

  return (
    <SettingsSection
      title="hooks"
      description={
        <>
          run a shell command or POST a webhook on task events. stored in{" "}
          <code>.taskdir/hooks.toml</code>.
        </>
      }
      action={optimistic.length > 0 ? addButton : undefined}
    >
      {optimistic.length === 0 ? (
        <SettingsEmptyState
          icon={Webhook}
          title="no hooks defined"
          action={addButton}
        />
      ) : (
        <SettingsList>
          {optimistic.map((hook, i) => {
            const TypeIcon = hook.type === "command" ? Terminal : Webhook;
            const target = hookCommandSummary(hook);
            const enabled = isHookEnabled(hook);
            return (
              <SettingsItem key={i}>
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-foreground",
                    !enabled && "opacity-50",
                  )}
                >
                  <TypeIcon className="size-4" aria-hidden />
                </span>
                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col gap-1",
                    !enabled && "opacity-50",
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    {hook.name && (
                      <span className="truncate text-sm text-foreground">
                        {hook.name}
                      </span>
                    )}
                    <Badge variant="outline" className="text-muted-foreground">
                      on {eventLabel(hook.event)}
                    </Badge>
                    {!enabled && (
                      <Badge variant="outline" className="text-muted-foreground">
                        disabled
                      </Badge>
                    )}
                  </div>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {target.trim() || (
                      <span className="italic opacity-60">
                        nothing configured
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    onClick={() => toggleEnabled(i)}
                    aria-label={`${enabled ? "disable" : "enable"} hook ${i + 1}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {enabled ? <Power /> : <PowerOff />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    onClick={() => setDialog({ kind: "edit", index: i })}
                    aria-label={`edit hook ${i + 1}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    onClick={() => setDeleting(i)}
                    aria-label={`remove hook ${i + 1}`}
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
        <HookDialog
          key={dialog.kind === "edit" ? `edit-${dialog.index}` : "create"}
          initial={dialog.kind === "edit" ? optimistic[dialog.index] : null}
          pending={pending}
          onCancel={() => setDialog(null)}
          onSubmit={submit}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="remove this hook?"
        description={
          deletingHook
            ? `on ${eventLabel(deletingHook.event)} → ${deletingHook.type}`
            : undefined
        }
        confirmLabel="remove"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
      />
    </SettingsSection>
  );
}

function HookDialog({
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  initial: Hook | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (hook: Hook) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [event, setEvent] = useState<Hook["event"]>(initial?.event ?? "*");
  const [type, setType] = useState<HookType>(initial?.type ?? "command");
  const [command, setCommand] = useState(initial?.command ?? "");
  const [script, setScript] = useState(initial?.script ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  // For command hooks, choose between pointing at a file/command to run and
  // writing inline code. Seed from whichever the hook already carries.
  const [cmdMode, setCmdMode] = useState<CmdMode>(
    initial?.script?.trim() ? "inline" : "file",
  );

  const target =
    type === "webhook" ? url : cmdMode === "inline" ? script : command;
  const canSave = target.trim().length > 0 && !pending;

  const build = (): Hook => {
    const hook: Hook = { event, type };
    const trimmedName = name.trim();
    if (trimmedName) hook.name = trimmedName;
    if (type === "command") {
      // Keep exactly one of script/command so the two modes never collide.
      if (cmdMode === "inline") hook.script = script;
      else hook.command = command.trim();
    } else {
      hook.url = url.trim();
    }
    // Editing shouldn't silently re-enable a disabled hook.
    if (initial?.enabled === false) hook.enabled = false;
    return hook;
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "edit hook" : "add hook"}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSubmit(build());
          }}
        >
          <FormField label="name (optional)">
            <Input
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              disabled={pending}
              placeholder="e.g. notify on done"
            />
          </FormField>
          <div className="flex flex-wrap gap-4">
            <FormField label="on event">
              <PickerDropdown
                value={event}
                options={HOOK_EVENT_CHOICES}
                onChange={setEvent}
                disabled={pending}
                triggerAriaLabel="change event"
                triggerClassName="flex h-8 w-fit min-w-44 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-1 pr-2 pl-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
                renderTrigger={(v) => (
                  <>
                    {eventLabel(v)}
                    <ChevronDown
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  </>
                )}
                renderOption={(v, selected) => (
                  <span className={cn(selected && "text-foreground")}>
                    {eventLabel(v)}
                  </span>
                )}
              />
            </FormField>
            <FormField label="do">
              <div className="flex gap-1" role="radiogroup" aria-label="hook type">
                {HOOK_TYPES.map((t) => {
                  const TypeIcon = t === "command" ? Terminal : Webhook;
                  const selected = t === type;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={pending}
                      onClick={() => setType(t)}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors",
                        selected
                          ? "border-ring bg-muted text-foreground"
                          : "border-border text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground",
                      )}
                    >
                      <TypeIcon className="size-3.5" aria-hidden />
                      {t}
                    </button>
                  );
                })}
              </div>
            </FormField>
          </div>
          {type === "command" ? (
            <FormField
              label="run"
              hint={
                cmdMode === "inline"
                  ? "inline code — add a shebang (e.g. #!/usr/bin/env node) or it runs in the platform shell."
                  : "a shell command or path to a script. runs with the event JSON on stdin and TASKDIR_* env vars."
              }
            >
              <div className="flex flex-col gap-2">
                <div
                  className="flex gap-1"
                  role="radiogroup"
                  aria-label="command source"
                >
                  {CMD_MODES.map((m) => {
                    const ModeIcon = m === "file" ? FileCode : Code2;
                    const selected = m === cmdMode;
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={pending}
                        onClick={() => setCmdMode(m)}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors",
                          selected
                            ? "border-ring bg-muted text-foreground"
                            : "border-border text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground",
                        )}
                      >
                        <ModeIcon className="size-3.5" aria-hidden />
                        {m === "file" ? "command / file" : "inline code"}
                      </button>
                    );
                  })}
                </div>
                {cmdMode === "inline" ? (
                  <CodeEditor
                    value={script}
                    onChange={setScript}
                    placeholder={"#!/usr/bin/env bash\nnotify-send \"$TASKDIR_EVENT\""}
                  />
                ) : (
                  <Input
                    value={command}
                    onChange={(e) => setCommand(e.currentTarget.value)}
                    disabled={pending}
                    placeholder='e.g. notify-send "$TASKDIR_EVENT"'
                    className="font-mono"
                  />
                )}
              </div>
            </FormField>
          ) : (
            <FormField
              label="url"
              hint="receives a POST with a JSON body { event, timestamp, data }."
            >
              <Input
                value={url}
                onChange={(e) => setUrl(e.currentTarget.value)}
                disabled={pending}
                placeholder="https://example.com/webhook"
                className="font-mono"
              />
            </FormField>
          )}
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
                "add hook"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
