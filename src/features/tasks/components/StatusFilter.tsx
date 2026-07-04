"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUSES, type Status } from "@/lib/task-types";
import { cn } from "@/lib/utils";

const LABEL: Record<Status, string> = {
  pending: "pending",
  in_progress: "in progress",
  awaiting_approval: "awaiting approval",
  blocked: "blocked",
  done: "done",
};

const TONE: Record<Status, string> = {
  blocked: "text-amber-400",
  awaiting_approval: "text-violet-400",
  in_progress: "text-sky-400",
  pending: "text-muted-foreground",
  done: "text-emerald-500",
};

export function StatusFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("status");
  const isFiltered = !!current && (STATUSES as string[]).includes(current);

  const setStatus = (next: Status | null) => {
    const sp = new URLSearchParams(params.toString());
    if (next) sp.set("status", next);
    else sp.delete("status");
    const qs = sp.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="filter by status"
        className={cn(
          "inline-flex h-8 items-center gap-1 border border-border px-2 font-mono text-xs leading-none hover:text-foreground hover:border-foreground",
          isFiltered
            ? TONE[current as Status]
            : "text-muted-foreground",
        )}
      >
        <Filter className="size-3.5" aria-hidden />
        {isFiltered ? LABEL[current as Status] : "filter"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="font-mono">
        <DropdownMenuItem
          onClick={() => setStatus(null)}
          className={cn("text-xs", !isFiltered && "bg-accent/60")}
        >
          <span className={!isFiltered ? "text-foreground" : undefined}>
            all
          </span>
          {!isFiltered && <Check className="ml-auto size-3" />}
        </DropdownMenuItem>
        {STATUSES.map((s) => {
          const selected = current === s;
          return (
            <DropdownMenuItem
              key={s}
              onClick={() => setStatus(s)}
              className={cn("text-xs", selected && "bg-accent/60")}
            >
              <span className={cn(TONE[s], selected && "font-semibold")}>
                {LABEL[s]}
              </span>
              {selected && <Check className="ml-auto size-3" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
