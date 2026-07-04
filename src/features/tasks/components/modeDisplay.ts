import { FileCheck2, ListChecks, Pencil, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Mode } from "@/lib/task-types";

export const MODE_LABEL: Record<Mode, string> = {
  plan_only: "plan only",
  plan_and_execute: "plan + execute",
  fast_execute: "fast execute",
  report_only: "report only",
};

export const MODE_ICON: Record<Mode, LucideIcon> = {
  plan_only: Pencil,
  plan_and_execute: ListChecks,
  fast_execute: Zap,
  report_only: FileCheck2,
};
