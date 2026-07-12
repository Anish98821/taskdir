"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PickerDropdown } from "@/components/ui/picker-dropdown";
import { cn } from "@/lib/utils";

export const TASK_SORTS = ["latest", "priority", "status"] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

const SORT_LABEL: Record<TaskSort, string> = {
  latest: "latest",
  priority: "priority",
  status: "status",
};

export function getTaskSort(value: string | null | undefined): TaskSort {
  return TASK_SORTS.includes(value as TaskSort) ? (value as TaskSort) : "latest";
}

export function SortDropdown() {
  const router = useRouter();
  const params = useSearchParams();
  const current = getTaskSort(params.get("sort"));

  const setSort = (next: TaskSort) => {
    const sp = new URLSearchParams(params.toString());
    if (next === "latest") sp.delete("sort");
    else sp.set("sort", next);
    const qs = sp.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  };

  return (
    <PickerDropdown
      value={current}
      options={TASK_SORTS}
      onChange={setSort}
      triggerAriaLabel="sort tasks"
      triggerClassName={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "font-mono text-xs font-normal text-muted-foreground hover:text-foreground",
      )}
      renderTrigger={(sort) => (
        <>
          <ArrowDownUp className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">{SORT_LABEL[sort]}</span>
        </>
      )}
      renderOption={(sort, selected) => (
        <span className={cn(selected && "text-foreground font-semibold")}>
          {SORT_LABEL[sort]}
        </span>
      )}
    />
  );
}
