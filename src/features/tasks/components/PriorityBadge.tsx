import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CHIP } from "@/features/tasks/components/chip";
import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/task-types";

export const PRIORITY_ICON: Record<Priority, LucideIcon> = {
  high: ArrowUp,
  med: Minus,
  low: ArrowDown,
};

// med is deliberately neutral: most tasks are med, and a column of colored
// chips drowns out the high/low outliers that actually deserve attention.
export const PRIORITY_TONE: Record<Priority, string> = {
  high: "text-rose-400 border-rose-400/30 bg-rose-400/10",
  med: "text-muted-foreground border-border bg-muted/30",
  low: "text-sky-400 border-sky-400/30 bg-sky-400/10",
};

interface Props {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: Props) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <span className={cn(CHIP, PRIORITY_TONE[priority], className)}>
      <Icon className="size-3" aria-hidden />
      {priority}
    </span>
  );
}
