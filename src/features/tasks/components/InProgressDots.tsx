import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function InProgressDots({ className }: Props) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex items-end gap-[2px] leading-none", className)}
    >
      <span className="size-[3px] rounded-full bg-current animate-loop-bounce [animation-delay:0ms]" />
      <span className="size-[3px] rounded-full bg-current animate-loop-bounce [animation-delay:150ms]" />
      <span className="size-[3px] rounded-full bg-current animate-loop-bounce [animation-delay:300ms]" />
    </span>
  );
}
