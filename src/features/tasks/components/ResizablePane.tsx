"use client";

import { useRef, type ReactNode } from "react";
import { usePersistentState } from "@/hooks/use-persistent-state";

const DEFAULT_WIDTH = 520;
const MIN_WIDTH = 380;

/**
 * Right-hand pane (task detail / new task draft) with a draggable left edge.
 * Width persists across sessions; double-click the handle to reset; the
 * handle is a focusable separator so arrow keys resize it too.
 */
export function ResizablePane({ children }: { children: ReactNode }) {
  const [width, setWidth] = usePersistentState("detailPane.width", DEFAULT_WIDTH);
  const dragging = useRef(false);

  const clamp = (w: number) =>
    Math.min(
      Math.max(w, MIN_WIDTH),
      Math.max(MIN_WIDTH, Math.round(window.innerWidth * 0.75)),
    );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setWidth(clamp(window.innerWidth - e.clientX));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setWidth((w) => clamp(w + 24));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setWidth((w) => clamp(w - 24));
    }
  };

  return (
    // Full-screen overlay on small screens; a resizable side pane from md up.
    <div
      className="fixed inset-0 z-40 flex bg-background md:relative md:inset-auto md:z-auto md:w-(--pane-width) md:min-w-(--pane-min-width) md:max-w-[75vw] md:flex-shrink-0"
      style={
        {
          "--pane-width": `${width}px`,
          "--pane-min-width": `${MIN_WIDTH}px`,
        } as React.CSSProperties
      }
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="resize pane"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
        onKeyDown={onKeyDown}
        className="absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize touch-none outline-none transition-colors hover:bg-ring/30 focus-visible:bg-ring/40 active:bg-ring/40 md:block"
      />
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
