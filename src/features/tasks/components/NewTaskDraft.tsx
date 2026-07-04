"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { createTaskAction } from "@/app/actions";
import { PickerDropdown } from "@/components/ui/picker-dropdown";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";
import { MarkdownEditor } from "@/features/tasks/components/MarkdownEditor";
import { MODE_ICON, MODE_LABEL } from "@/features/tasks/components/modeDisplay";
import {
  PRIORITY_ICON,
  PRIORITY_TONE,
} from "@/features/tasks/components/PriorityBadge";
import type { Agent, AgentsConfig } from "@/lib/agent-types";
import { ProviderIcon } from "@/features/tasks/components/providerIcon";
import { MODES, PRIORITIES, type Mode, type Priority } from "@/lib/task-types";
import { cn } from "@/lib/utils";

interface Props {
  closeHref: string;
  agentsConfig: AgentsConfig;
}

export function NewTaskDraft({ closeHref, agentsConfig }: Props) {
  const router = useRouter();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("med");
  const [mode, setMode] = useState<Mode>("plan_and_execute");
  const [tags, setTags] = useState<string[]>([]);
  const [generateReport, setGenerateReport] = useState(true);
  const [agent, setAgent] = useState("");
  const [context, setContext] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.focus();
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const autoSizeTitle = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const canSave = title.trim().length > 0 && !pending;

  const save = () => {
    if (!canSave) return;
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("priority", priority);
    fd.set("mode", mode);
    fd.set("tags", tags.join(", "));
    fd.set("generate_report", generateReport ? "true" : "false");
    fd.set("agent", agent);
    fd.set("context", context);
    startTransition(async () => {
      await createTaskAction(fd);
    });
  };

  const onTitleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      router.replace(closeHref, { scroll: false });
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>draft</span>
            <span className="border border-border px-1.5 py-0.5 text-muted-foreground">
              pending
            </span>
          </div>
          <Link
            href={closeHref}
            scroll={false}
            className="text-muted-foreground hover:text-foreground"
            aria-label="close"
          >
            <X className="size-4" />
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <PickerDropdown
              value={priority}
              options={PRIORITIES}
              onChange={setPriority}
              disabled={pending}
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
              onChange={setMode}
              disabled={pending}
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
            <TagChips tags={tags} onChange={setTags} disabled={pending} />
            <label className="inline-flex items-center gap-1 border border-border px-1.5 py-0.5 leading-none text-muted-foreground hover:border-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={generateReport}
                onChange={(e) => setGenerateReport(e.currentTarget.checked)}
                disabled={pending}
                className="size-3 accent-foreground"
              />
              report
            </label>
            <AgentPicker
              value={agent}
              agents={agentsConfig.agents}
              onChange={setAgent}
              disabled={pending}
            />
          </div>

          <textarea
            ref={titleRef}
            value={title}
            rows={1}
            placeholder="title"
            onChange={(e) => {
              setTitle(e.target.value);
              autoSizeTitle(e.currentTarget);
            }}
            onKeyDown={onTitleKey}
            disabled={pending}
            className="block w-full resize-none overflow-hidden border border-border bg-background px-1 py-0.5 font-mono text-base leading-snug text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          context.md{" "}
          <span className="opacity-60">
            (optional · type # to link a project file)
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <MarkdownEditor
            value={context}
            onChange={setContext}
            editable={!pending}
            lineNumbers={false}
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs">
          <span className="text-muted-foreground">
            nothing is on disk yet — click save to create.
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={closeHref}
              scroll={false}
              className="border border-border px-2 py-1 text-muted-foreground hover:text-foreground hover:border-foreground"
            >
              cancel
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-foreground hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <>
                  saving
                  <InProgressDots />
                </>
              ) : (
                "save (⌘↵)"
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
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
    const a = agents.find((x) => x.id === id);
    if (!a) return null;
    return <ProviderIcon provider={a.provider} />;
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
