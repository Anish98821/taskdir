"use client";

import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { cn } from "@/lib/utils";

// A small, syntax-agnostic code editor: monospace, dark, line numbers. Used for
// authoring inline hook scripts. Deliberately plainer than MarkdownEditor (no
// markdown grammar, mention picker, or file-drop) so it reads as a code pane.
const editorTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily:
      "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "12.5px",
    lineHeight: "1.6",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "color-mix(in oklab, currentColor 35%, transparent)",
  },
  ".cm-content": { padding: "8px 0" },
});

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  editable?: boolean;
  height?: string;
  className?: string;
}

export function CodeEditor({
  value,
  onChange,
  placeholder,
  editable = true,
  height = "220px",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-input bg-[#282c34] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        theme={oneDark}
        placeholder={placeholder}
        editable={editable}
        extensions={[editorTheme, EditorView.lineWrapping]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: false,
          autocompletion: false,
        }}
        height={height}
      />
    </div>
  );
}
