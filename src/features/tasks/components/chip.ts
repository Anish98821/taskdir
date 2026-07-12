// Shared look for the small metadata chips (status, priority, mode, tags, …)
// used across the task views. Colored tones pair a tinted background with a
// soft border so chips read as UI, not plain text.

export const CHIP =
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs leading-none transition-colors";

export const CHIP_NEUTRAL =
  "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground";

export const CHIP_STATIC_NEUTRAL = "border-border bg-muted/30 text-muted-foreground";
