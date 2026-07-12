"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function ClarificationSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 self-start rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-400 transition-colors hover:border-amber-400/60 disabled:cursor-wait disabled:opacity-60"
    >
      {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
      {pending ? "unblocking" : "unblock"}
    </button>
  );
}
