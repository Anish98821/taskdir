"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { deleteAgent, saveAgent } from "@/app/actions";
import { PickerDropdown } from "@/components/ui/picker-dropdown";
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

interface Props {
  config: AgentsConfig;
}

const EMPTY_DRAFT = { name: "", provider: "anthropic" as Provider };

export function AgentsEditor({ config }: Props) {
  const [pending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    config,
    (_current, next: AgentsConfig) => next,
  );

  const upsertRow = (agent: Agent) => {
    const cleaned: Agent = {
      id: agent.id.trim(),
      name: agent.name.trim() || agent.id,
      provider: agent.provider,
    };
    if (!cleaned.id) return;
    const without = optimistic.agents.filter((a) => a.id !== cleaned.id);
    const next: AgentsConfig = { agents: [...without, cleaned] };
    startTransition(async () => {
      applyOptimistic(next);
      await saveAgent(cleaned);
    });
  };

  const removeRow = (id: string) => {
    const next: AgentsConfig = {
      agents: optimistic.agents.filter((a) => a.id !== id),
    };
    startTransition(async () => {
      applyOptimistic(next);
      await deleteAgent(id);
    });
  };

  const addDraft = (draft: typeof EMPTY_DRAFT) => {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return;
    const id = generateAgentId(
      trimmedName,
      optimistic.agents.map((a) => a.id),
    );
    upsertRow({ id, name: trimmedName, provider: draft.provider });
  };

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <p className="text-xs text-muted-foreground">
        define the agents that can pick up tasks (claude code, codex, gemini,
        custom). agents can also self-register via the{" "}
        <code>register_agent</code> mcp tool.
      </p>
      <div className="flex flex-col gap-2">
        {optimistic.agents.length === 0 && (
          <p className="text-xs text-muted-foreground/60">no agents defined</p>
        )}
        {optimistic.agents.map((a) => (
          <AgentRow
            key={a.id}
            initial={a}
            disabled={pending}
            onSave={upsertRow}
            onRemove={() => removeRow(a.id)}
          />
        ))}
      </div>
      <DraftRow disabled={pending} onAdd={addDraft} />
    </div>
  );
}

function AgentRow({
  initial,
  disabled,
  onSave,
  onRemove,
}: {
  initial: Agent;
  disabled?: boolean;
  onSave: (a: Agent) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [provider, setProvider] = useState<Provider>(initial.provider);

  const dirty = name !== initial.name || provider !== initial.provider;

  const save = () => {
    onSave({ id: initial.id, name, provider });
  };

  return (
    <div className="flex flex-col gap-2 border border-border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2">
          <ProviderIcon provider={provider} size={16} />
          <span className="text-sm text-foreground">{name || initial.id}</span>
          <span className="font-mono text-xs text-muted-foreground/70">
            {initial.id}
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground"
          aria-label={`remove agent ${initial.id}`}
        >
          <X className="size-3" />
        </button>
      </div>
      <RowField
        label="name"
        value={name}
        onChange={setName}
        disabled={disabled}
        placeholder="e.g. Claude Code"
      />
      <ProviderRow value={provider} onChange={setProvider} disabled={disabled} />
      {dirty && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={disabled}
            className="border border-border px-2 py-0.5 text-xs hover:border-foreground"
          >
            save
          </button>
        </div>
      )}
    </div>
  );
}

function DraftRow({
  disabled,
  onAdd,
}: {
  disabled?: boolean;
  onAdd: (draft: typeof EMPTY_DRAFT) => void;
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const commit = () => {
    if (!draft.name.trim()) return;
    onAdd(draft);
    setDraft(EMPTY_DRAFT);
  };

  return (
    <div className="flex flex-col gap-2 border border-dashed border-border px-3 py-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        new agent
      </span>
      <RowField
        label="name"
        value={draft.name}
        onChange={(name) => setDraft((d) => ({ ...d, name }))}
        disabled={disabled}
        placeholder="e.g. Claude Code"
      />
      <ProviderRow
        value={draft.provider}
        onChange={(provider) => setDraft((d) => ({ ...d, provider }))}
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground/60">
        id will be generated from the name on save.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={commit}
          disabled={disabled || !draft.name.trim()}
          className="inline-flex items-center gap-1 border border-border px-2 py-0.5 text-xs hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3" />
          add agent
        </button>
      </div>
    </div>
  );
}

function ProviderRow({
  value,
  onChange,
  disabled,
}: {
  value: Provider;
  onChange: (v: Provider) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="w-32 shrink-0">provider</span>
      <PickerDropdown
        value={value}
        options={PROVIDERS}
        onChange={onChange}
        disabled={disabled}
        triggerAriaLabel="change provider"
        triggerClassName="inline-flex items-center gap-1.5 border border-border px-2 py-0.5 text-sm leading-none text-foreground hover:border-foreground"
        renderTrigger={(v) => (
          <>
            <ProviderIcon provider={v} />
            {providerLabel(v)}
            <ChevronDown className="size-3" aria-hidden />
          </>
        )}
        renderOption={(v, selected) => (
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              selected ? "text-foreground" : undefined,
            )}
          >
            <ProviderIcon provider={v} />
            {providerLabel(v)}
          </span>
        )}
      />
    </div>
  );
}

function RowField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="w-32 shrink-0">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 border border-border bg-background px-2 py-0.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none disabled:opacity-60"
      />
    </label>
  );
}
