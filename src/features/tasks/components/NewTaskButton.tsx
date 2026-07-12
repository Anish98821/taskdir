"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      className={cn(
        buttonVariants({ size: "sm" }),
        "font-mono text-xs",
      )}
    >
      <Plus className="size-3.5" />
      new
    </Link>
  );
}
