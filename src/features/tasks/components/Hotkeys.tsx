"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

function isTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  if (el.closest(".cm-editor")) return true;
  return false;
}

export function Hotkeys() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = isTextField(e.target);

      if (e.key === "Escape") {
        if (params.get("task") || params.get("new")) {
          const sp = new URLSearchParams(params.toString());
          sp.delete("task");
          sp.delete("file");
          sp.delete("new");
          const qs = sp.toString();
          router.replace(qs ? `/?${qs}` : "/", { scroll: false });
        } else if (inField && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      if (inField || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[name="search"]')?.focus();
        return;
      }

      const rows = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("[data-task-row]"),
      );
      const currentIndex = rows.findIndex((a) => a === document.activeElement);

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const idx = currentIndex < 0 ? 0 : Math.min(rows.length - 1, currentIndex + 1);
        rows[idx]?.focus();
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = currentIndex < 0 ? 0 : Math.max(0, currentIndex - 1);
        rows[idx]?.focus();
        return;
      }
      if (e.key === "Enter") {
        const focused = document.activeElement;
        if (focused?.matches?.("a[data-task-row]")) {
          (focused as HTMLAnchorElement).click();
        }
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [params, router]);

  return null;
}
