"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
}

export function MarkdownPreview({ content }: Props) {
  if (!content.trim()) {
    return (
      <div className="p-6 text-muted-foreground">empty file.</div>
    );
  }
  return (
    <div className="markdown-preview prose-mono px-6 py-4 text-sm leading-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1 className="mt-4 mb-3 text-lg font-semibold text-foreground" {...props} />
          ),
          h2: (props) => (
            <h2 className="mt-4 mb-2 text-base font-semibold text-foreground" {...props} />
          ),
          h3: (props) => (
            <h3 className="mt-3 mb-2 text-sm font-semibold text-foreground" {...props} />
          ),
          p: (props) => <p className="my-2 text-foreground" {...props} />,
          ul: (props) => (
            <ul className="my-2 list-disc pl-6 marker:text-muted-foreground" {...props} />
          ),
          ol: (props) => (
            <ol className="my-2 list-decimal pl-6 marker:text-muted-foreground" {...props} />
          ),
          li: (props) => <li className="my-0.5" {...props} />,
          a: (props) => (
            <a className="text-sky-400 underline underline-offset-2 hover:text-sky-300" {...props} />
          ),
          code: ({ className, children, ...rest }) => {
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) {
              return (
                <code className="block" {...rest}>
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-muted/60 px-1 py-0.5 text-foreground" {...rest}>
                {children}
              </code>
            );
          },
          pre: (props) => (
            <pre className="my-3 overflow-x-auto rounded border border-border bg-muted/30 p-3 text-xs" {...props} />
          ),
          blockquote: (props) => (
            <blockquote
              className="my-3 border-l-2 border-border pl-3 text-muted-foreground"
              {...props}
            />
          ),
          hr: () => <hr className="my-4 border-border" />,
          table: (props) => (
            <table className="my-3 border-collapse text-xs" {...props} />
          ),
          th: (props) => (
            <th className="border border-border px-2 py-1 text-left font-semibold" {...props} />
          ),
          td: (props) => <td className="border border-border px-2 py-1" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
