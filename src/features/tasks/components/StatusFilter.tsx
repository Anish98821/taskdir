"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check, Filter } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  statusLabel,
  statusTextTone,
} from "@/features/tasks/components/statusDisplay";
import type { StatusDef } from "@/lib/statuses-types";
import type { Status } from "@/lib/task-types";
import { cn } from "@/lib/utils";

interface Props {
  statuses: StatusDef[];
}

export function StatusFilter({ statuses }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("status");
  const isFiltered = !!current && statuses.some((s) => s.id === current);

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
          buttonVariants({ variant: "outline", size: "sm" }),
          "font-mono text-xs font-normal",
          isFiltered
            ? statusTextTone(statuses, current)
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Filter className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">
          {isFiltered ? statusLabel(statuses, current) : "filter"}
        </span>
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
        {statuses.map((s) => {
          const selected = current === s.id;
          return (
            <DropdownMenuItem
              key={s.id}
              onClick={() => setStatus(s.id)}
              className={cn("text-xs", selected && "bg-accent/60")}
            >
              <span
                className={cn(
                  statusTextTone(statuses, s.id),
                  selected && "font-semibold",
                )}
              >
                {s.label}
              </span>
              {selected && <Check className="ml-auto size-3" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
