"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

export function NewTaskButton() {
  const params = useSearchParams();

  const href = (() => {
    const sp = new URLSearchParams(params.toString());
    sp.set("new", "1");
    sp.delete("task");
    sp.delete("file");
    return `/?${sp.toString()}`;
  })();

  return (
    <Link
      href={href}
      scroll={false}
      className="inline-flex h-8 items-center gap-1 border border-foreground bg-foreground px-2 text-xs font-semibold text-background hover:bg-foreground/85"
    >
      <Plus className="size-3.5" />
      new
    </Link>
  );
}
