"use client";

import { useRef, useState } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  FileMentionPicker,
  type MentionRequest,
} from "@/features/tasks/components/FileMentionPicker";

const editorTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", height: "100%" },
  ".cm-scroller": {
    fontFamily:
      "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "13px",
  },
  ".cm-gutters": { backgroundColor: "transparent", border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-content": { padding: "8px 0" },
});

function uriListToPaths(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      if (line.startsWith("file://")) {
        try {
          return decodeURIComponent(new URL(line).pathname);
        } catch {
          return line;
        }
      }
      return line;
    });
}

function markdownLinks(paths: string[]): string {
  return paths.map((p) => `[${p}](${p})`).join("\n");
}

const fileDropExtension = EditorView.domEventHandlers({
  drop(event, view) {
    const dt = event.dataTransfer;
    if (!dt) return false;

    let paths: string[] = [];
    const uriList = dt.getData("text/uri-list");
    if (uriList) paths = uriListToPaths(uriList);

    if (paths.length === 0 && dt.files && dt.files.length > 0) {
      paths = Array.from(dt.files).map((f) => f.name);
    }

    if (paths.length === 0) return false;

    event.preventDefault();
    const pos =
      view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
      view.state.selection.main.head;
    const insert = markdownLinks(paths);
    view.dispatch({
      changes: { from: pos, to: pos, insert },
      selection: { anchor: pos + insert.length },
    });
    return true;
  },
});

const MENTION_TRIGGER = /(^|\s)#([\w./-]*)$/;

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  lineNumbers?: boolean;
  editable?: boolean;
  height?: string;
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  lineNumbers = true,
  editable = true,
  height = "100%",
  className,
}: Props) {
  const viewRef = useRef<EditorView | null>(null);
  const [request, setRequest] = useState<MentionRequest | null>(null);

  const detectAndShow = (view: EditorView) => {
    const state = view.state;
    const head = state.selection.main.head;
    const lineStart = state.doc.lineAt(head).from;
    const before = state.sliceDoc(lineStart, head);
    const match = before.match(MENTION_TRIGGER);
    if (!match) {
      setRequest(null);
      return;
    }
    const hashIdx = lineStart + (match.index ?? 0) + match[1].length;
    const query = match[2];
    const coords = view.coordsAtPos(hashIdx);
    if (!coords) return;
    setRequest({
      query,
      anchor: { x: coords.left, y: coords.bottom },
      onSelect: (path) => {
        const insert = `[${path}](${path})`;
        viewRef.current?.dispatch({
          changes: { from: hashIdx, to: head, insert },
          selection: { anchor: hashIdx + insert.length },
        });
        viewRef.current?.focus();
      },
      onCancel: () => {
        viewRef.current?.focus();
      },
    });
  };

  const mentionWatcher = EditorView.updateListener.of((update) => {
    if (!update.docChanged && !update.selectionSet) return;
    detectAndShow(update.view);
  });

  return (
    <>
      <CodeMirror
        value={value}
        onChange={onChange}
        theme={oneDark}
        placeholder={placeholder}
        editable={editable}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
        extensions={[
          markdown(),
          editorTheme,
          EditorView.lineWrapping,
          mentionWatcher,
          fileDropExtension,
        ]}
        basicSetup={{
          lineNumbers,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          autocompletion: false,
        }}
        height={height}
        className={className}
      />
      <FileMentionPicker request={request} setRequest={setRequest} />
    </>
  );
}
