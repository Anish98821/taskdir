"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Bot, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteAgent, saveAgent } from "@/app/actions";
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
import { PickerDropdown } from "@/components/ui/picker-dropdown";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";
import {
  ProviderIcon,
  providerLabel,
} from "@/features/tasks/components/providerIcon";
import {
  generateAgentId,
  PROVIDERS,
  type Agent,
  type AgentsConfig,
  type Provider,
} from "@/lib/agent-types";
import { cn } from "@/lib/utils";
import {
  FormField,
  SettingsEmptyState,
  SettingsItem,
  SettingsList,
  SettingsSection,
} from "./shared";

interface Props {
  config: AgentsConfig;
}

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; agent: Agent }
  | null;

export function AgentsSettings({ config }: Props) {
  const [pending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    config,
    (_current, next: AgentsConfig) => next,
  );
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<Agent | null>(null);

  const upsert = (agent: Agent) => {
    const without = optimistic.agents.filter((a) => a.id !== agent.id);
    startTransition(async () => {
      applyOptimistic({ agents: [...without, agent] });
      await saveAgent(agent);
    });
    setDialog(null);
  };

  const submit = (name: string, provider: Provider) => {
    if (dialog?.kind === "edit") {
      upsert({ id: dialog.agent.id, name, provider });
    } else {
      const id = generateAgentId(
        name,
        optimistic.agents.map((a) => a.id),
      );
      upsert({ id, name, provider });
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      applyOptimistic({
        agents: optimistic.agents.filter((a) => a.id !== id),
      });
      await deleteAgent(id);
    });
    setDeleting(null);
  };

  const addButton = (
    <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
      <Plus data-icon="inline-start" />
      add agent
    </Button>
  );

  return (
    <SettingsSection
      title="agents"
      description={
        <>
          agents that can pick up tasks. they can also self-register via the{" "}
          <code>register_agent</code> mcp tool.
        </>
      }
      action={optimistic.agents.length > 0 ? addButton : undefined}
    >
      {optimistic.agents.length === 0 ? (
        <SettingsEmptyState
          icon={Bot}
          title="no agents yet"
          action={addButton}
        />
      ) : (
        <SettingsList>
          {optimistic.agents.map((agent) => (
            <SettingsItem key={agent.id}>
              <ProviderIcon provider={agent.provider} size={16} />
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                <span className="truncate text-sm text-foreground">
                  {agent.name || agent.id}
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground/70">
                  {agent.id}
                </span>
              </div>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {providerLabel(agent.provider)}
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() => setDialog({ kind: "edit", agent })}
                  aria-label={`edit agent ${agent.id}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() => setDeleting(agent)}
                  aria-label={`remove agent ${agent.id}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </SettingsItem>
          ))}
        </SettingsList>
      )}

      {dialog && (
        <AgentDialog
          key={dialog.kind === "edit" ? dialog.agent.id : "create"}
          initial={dialog.kind === "edit" ? dialog.agent : null}
          pending={pending}
          onCancel={() => setDialog(null)}
          onSubmit={submit}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`remove agent "${deleting?.name ?? ""}"?`}
        description="tasks assigned to it keep the assignment."
        confirmLabel="remove"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
      />
    </SettingsSection>
  );
}

function AgentDialog({
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  initial: Agent | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (name: string, provider: Provider) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [provider, setProvider] = useState<Provider>(
    initial?.provider ?? "anthropic",
  );
  const canSave = name.trim().length > 0 && !pending;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "edit agent" : "add agent"}</DialogTitle>
          <DialogDescription>
            {initial ? (
              <>
                stored in <code>.taskdir/agents.toml</code> as{" "}
                <code>{initial.id}</code>.
              </>
            ) : (
              "id is generated from the name."
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSubmit(name.trim(), provider);
          }}
        >
          <FormField label="name">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              disabled={pending}
              placeholder="e.g. Claude Code"
            />
          </FormField>
          <FormField label="provider">
            <PickerDropdown
              value={provider}
              options={PROVIDERS}
              onChange={setProvider}
              disabled={pending}
              triggerAriaLabel="change provider"
              triggerClassName="flex h-8 w-fit min-w-40 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-1 pr-2 pl-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
              renderTrigger={(v) => (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <ProviderIcon provider={v} />
                    {providerLabel(v)}
                  </span>
                  <ChevronDown
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </>
              )}
              renderOption={(v, selected) => (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    selected && "text-foreground",
                  )}
                >
                  <ProviderIcon provider={v} />
                  {providerLabel(v)}
                </span>
              )}
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
                "add agent"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
