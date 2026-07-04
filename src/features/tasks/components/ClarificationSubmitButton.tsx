"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function ClarificationSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 self-start border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-foreground disabled:cursor-wait disabled:opacity-60"
    >
      {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
      {pending ? "unblocking" : "unblock"}
    </button>
  );
}
