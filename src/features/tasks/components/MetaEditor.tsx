"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { setMeta } from "@/app/actions";
import { PickerDropdown } from "@/components/ui/picker-dropdown";
import { MODE_ICON, MODE_LABEL } from "@/features/tasks/components/modeDisplay";
import {
  PRIORITY_ICON,
  PRIORITY_TONE,
} from "@/features/tasks/components/PriorityBadge";
import type { Agent, AgentsConfig } from "@/lib/agent-types";
import { ProviderIcon } from "@/features/tasks/components/providerIcon";
import {
  MODES,
  PRIORITIES,
  type Mode,
  type Priority,
  type TaskMeta,
} from "@/lib/task-types";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  meta: TaskMeta;
  agentsConfig: AgentsConfig;
}

export function MetaEditor({ taskId, meta, agentsConfig }: Props) {
  const [pending, startTransition] = useTransition();
  const [optimisticMeta, addOptimisticPatch] = useOptimistic(
    meta,
    (current, patch: Parameters<typeof setMeta>[1]): TaskMeta => {
      const { agent: pAgent, ...rest } = patch;
      const next: TaskMeta = { ...current, ...rest };
      if (pAgent !== undefined) {
        if (pAgent) next.agent = pAgent;
        else delete next.agent;
      }
      return next;
    },
  );

  const patch = (p: Parameters<typeof setMeta>[1]) => {
    if (pending) return;
    startTransition(async () => {
      addOptimisticPatch(p);
      await setMeta(taskId, p);
    });
  };

  return (
    <div
      aria-busy={pending}
      className={cn(
        "flex flex-col gap-2 transition-opacity",
        pending && "pointer-events-none opacity-60",
      )}
    >
      <PriorityModeAndTags
        priority={optimisticMeta.priority}
        mode={optimisticMeta.mode}
        tags={optimisticMeta.tags}
        agent={optimisticMeta.agent ?? ""}
        agentsConfig={agentsConfig}
        onPriority={(priority) => patch({ priority })}
        onMode={(mode) => patch({ mode })}
        onTags={(tags) => patch({ tags })}
        onAgent={(agent) => patch({ agent: agent || null })}
        disabled={pending}
      />
      <TitleEditor
        key={optimisticMeta.title}
        value={optimisticMeta.title}
        onSave={(title) => patch({ title })}
        disabled={pending}
      />
    </div>
  );
}

function PriorityModeAndTags({
  priority,
  mode,
  tags,
  agent,
  agentsConfig,
  onPriority,
  onMode,
  onTags,
  onAgent,
  disabled,
}: {
  priority: Priority;
  mode: Mode;
  tags: string[];
  agent: string;
  agentsConfig: AgentsConfig;
  onPriority: (p: Priority) => void;
  onMode: (m: Mode) => void;
  onTags: (t: string[]) => void;
  onAgent: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <PickerDropdown
        value={priority}
        options={PRIORITIES}
        onChange={onPriority}
        disabled={disabled}
        triggerAriaLabel="change priority"
        triggerClassName={cn(
          "inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-xs leading-none transition-colors hover:opacity-90",
          PRIORITY_TONE[priority],
        )}
        renderTrigger={(p) => {
          const Icon = PRIORITY_ICON[p];
          return (
            <>
              <Icon className="size-3" aria-hidden />
              {p}
              <ChevronDown className="size-3" aria-hidden />
            </>
          );
        }}
        renderOption={(p, selected) => {
          const Icon = PRIORITY_ICON[p];
          return (
            <>
              <Icon className="size-3 opacity-60" />
              <span className={cn(selected ? "text-foreground" : undefined)}>
                {p}
              </span>
            </>
          );
        }}
      />
      <span>·</span>
      <PickerDropdown
        value={mode}
        options={MODES}
        onChange={onMode}
        disabled={disabled}
        triggerAriaLabel="change mode"
        triggerClassName="inline-flex items-center gap-1 border border-border px-1.5 py-0.5 leading-none hover:border-foreground hover:text-foreground"
        renderTrigger={(m) => {
          const Icon = MODE_ICON[m];
          return (
            <>
              <Icon className="size-3 opacity-80" aria-hidden />
              {MODE_LABEL[m]}
              <ChevronDown className="size-3" aria-hidden />
            </>
          );
        }}
        renderOption={(m, selected) => {
          const Icon = MODE_ICON[m];
          return (
            <>
              <Icon className="size-3 opacity-60" />
              <span className={cn(selected ? "text-foreground" : undefined)}>
                {MODE_LABEL[m]}
              </span>
            </>
          );
        }}
      />
      <span>·</span>
      <TagChips tags={tags} onChange={onTags} disabled={disabled} />
      <span>·</span>
      <AgentPicker
        value={agent}
        agents={agentsConfig.agents}
        onChange={onAgent}
        disabled={disabled}
      />
    </div>
  );
}

const ANY = "__any__";

function AgentPicker({
  value,
  agents,
  onChange,
  disabled,
}: {
  value: string;
  agents: Agent[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const ids = agents.map((a) => a.id);
  const showsUnknown = value && !ids.includes(value);
  const current = value || ANY;
  const allOptions = showsUnknown ? [ANY, value, ...ids] : [ANY, ...ids];
  const labelFor = (id: string): string => {
    if (id === ANY) return "agent any";
    return agents.find((a) => a.id === id)?.name ?? id;
  };
  const renderIcon = (id: string) => {
    if (id === ANY) return null;
    const agent = agents.find((a) => a.id === id);
    if (!agent) return null;
    return <ProviderIcon provider={agent.provider} />;
  };
  return (
    <PickerDropdown
      value={current}
      options={allOptions}
      onChange={(next) => onChange(next === ANY ? "" : next)}
      disabled={disabled}
      triggerAriaLabel="change agent"
      triggerClassName="inline-flex items-center gap-1 border border-border px-1.5 py-0.5 leading-none text-muted-foreground hover:border-foreground hover:text-foreground"
      renderTrigger={(v) => (
        <>
          {renderIcon(v)}
          {labelFor(v)}
          <ChevronDown className="size-3" aria-hidden />
        </>
      )}
      renderOption={(v, selected) => (
        <span className={cn("inline-flex items-center gap-1", selected ? "text-foreground" : undefined)}>
          {renderIcon(v)}
          {labelFor(v)}
        </span>
      )}
    />
  );
}

function TagChips({
  tags,
  onChange,
  disabled,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const commitAdd = () => {
    const t = draft.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="group inline-flex items-center gap-0.5 border border-border px-1.5 py-0.5"
        >
          <span>{t}</span>
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`remove tag ${t}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitAdd();
            } else if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          onBlur={commitAdd}
          placeholder="tag"
          className="w-16 border border-border bg-background px-1 py-0.5 font-mono focus:border-foreground focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={disabled}
          className="inline-flex items-center gap-0.5 border border-transparent px-1 py-0.5 text-muted-foreground hover:border-border hover:text-foreground"
          aria-label="add tag"
        >
          <Plus className="size-3" />
        </button>
      )}
    </div>
  );
}

function TitleEditor({
  value,
  onSave,
  disabled,
}: {
  value: string;
  onSave: (v: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      const el = taRef.current;
      if (el) {
        el.focus();
        el.select();
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    }
  }, [editing]);

  const autoSize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const commit = () => {
    const t = draft.trim();
    setEditing(false);
    if (t && t !== value) onSave(t);
    else setDraft(value);
  };

  if (editing) {
    return (
      <textarea
        ref={taRef}
        value={draft}
        rows={1}
        onChange={(e) => {
          setDraft(e.target.value);
          autoSize(e.currentTarget);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        onBlur={commit}
        className="block w-full resize-none overflow-hidden border border-border bg-background px-1 py-0.5 font-mono text-base leading-snug text-foreground focus:border-foreground focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      className="block w-full cursor-text whitespace-pre-wrap break-words text-left text-base leading-snug text-foreground hover:bg-muted/30"
      title="click to edit title"
    >
      {value}
    </button>
  );
}
