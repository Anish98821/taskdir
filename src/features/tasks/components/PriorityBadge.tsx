import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/task-types";

export const PRIORITY_ICON: Record<Priority, LucideIcon> = {
  high: ArrowUp,
  med: Minus,
  low: ArrowDown,
};

export const PRIORITY_TONE: Record<Priority, string> = {
  high: "text-rose-400 border-rose-400/40",
  med: "text-amber-400 border-amber-400/40",
  low: "text-sky-400 border-sky-400/40",
};

interface Props {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: Props) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-xs leading-none",
        PRIORITY_TONE[priority],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {priority}
    </span>
  );
}
