"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { setStatus } from "@/app/actions";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";

interface Props {
  taskId: string;
}

export function ApprovePlanBanner({ taskId }: Props) {
  const [pending, startTransition] = useTransition();

  const approve = () => {
    if (pending) return;
    startTransition(async () => {
      await setStatus(taskId, "in_progress");
    });
  };

  const reject = () => {
    if (pending) return;
    startTransition(async () => {
      await setStatus(taskId, "blocked");
    });
  };

  return (
    <section className="flex items-center justify-between gap-3 border-b border-border bg-violet-400/5 px-4 py-3">
      <p className="text-xs text-violet-400">approve plan to start execution.</p>
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={reject}
          disabled={pending}
          className="inline-flex items-center gap-1 border border-border px-2 py-1 text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-60"
        >
          <X className="size-3" aria-hidden />
          request changes
        </button>
        <button
          type="button"
          onClick={approve}
          disabled={pending}
          className="inline-flex items-center gap-1 border border-violet-400/40 bg-violet-400/10 px-2 py-1 text-violet-400 hover:border-violet-400 disabled:opacity-60"
        >
          {pending ? (
            <>
              approving
              <InProgressDots />
            </>
          ) : (
            <>
              <Check className="size-3" aria-hidden />
              approve
            </>
          )}
        </button>
      </div>
    </section>
  );
}
