import {
  Beaker,
  BookOpen,
  Bot,
  Bug,
  ClipboardList,
  FileCheck2,
  Flag,
  GitBranch,
  Hammer,
  ListChecks,
  Pencil,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  iconKeyForMode,
  labelForMode,
  type ModeDef,
} from "@/lib/modes-types";

// Curated icon palette for modes. Keys are stored in modes.toml; unknown keys
// fall back to a sensible default so old/hand-edited configs never crash.
export const MODE_ICONS: Record<string, LucideIcon> = {
  pencil: Pencil,
  "list-checks": ListChecks,
  zap: Zap,
  "file-check": FileCheck2,
  bug: Bug,
  rocket: Rocket,
  search: Search,
  wrench: Wrench,
  beaker: Beaker,
  book: BookOpen,
  shield: Shield,
  sparkles: Sparkles,
  "git-branch": GitBranch,
  clipboard: ClipboardList,
  hammer: Hammer,
  flag: Flag,
  bot: Bot,
};

export const MODE_ICON_KEYS: string[] = Object.keys(MODE_ICONS);

const FALLBACK_ICON: LucideIcon = ListChecks;

export function modeIcon(key: string): LucideIcon {
  return MODE_ICONS[key] ?? FALLBACK_ICON;
}

export function modeIconFor(modes: ModeDef[], id: string): LucideIcon {
  return modeIcon(iconKeyForMode(modes, id));
}

export function modeLabel(modes: ModeDef[], id: string): string {
  return labelForMode(modes, id);
}
