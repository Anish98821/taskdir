"use client";

import { type ReactNode } from "react";
import { Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface PickerDropdownProps<T extends string> {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  renderTrigger: (current: T) => ReactNode;
  renderOption: (option: T, selected: boolean) => ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  disabled?: boolean;
  align?: "start" | "end";
  contentClassName?: string;
}

export function PickerDropdown<T extends string>({
  value,
  options,
  onChange,
  renderTrigger,
  renderOption,
  triggerClassName,
  triggerAriaLabel,
  disabled,
  align = "start",
  contentClassName,
}: PickerDropdownProps<T>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={triggerAriaLabel}
        disabled={disabled}
        className={triggerClassName}
      >
        {renderTrigger(value)}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn("font-mono", contentClassName)}
      >
        {options.map((option) => {
          const selected = option === value;
          return (
            <DropdownMenuItem
              key={option}
              onClick={() => !selected && onChange(option)}
              disabled={disabled}
              className={cn("text-xs", selected && "bg-accent/60")}
            >
              {renderOption(option, selected)}
              {selected && <Check className="ml-auto size-3" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
