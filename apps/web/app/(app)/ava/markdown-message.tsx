"use client";
// apps/web/app/(app)/ava/markdown-message.tsx — AVA 消息内容渲染（Markdown / 代码块，P9 F01）
//
// 不依赖 Tailwind typography 插件（本仓未装），手写最小必要的元素样式，
// 覆盖标题/列表/行内代码/代码块，满足 F01 验收（Markdown/代码块可渲染）。
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: (p) => <h1 className="mt-2 text-17 font-semibold text-foreground first:mt-0" {...p} />,
  h2: (p) => <h2 className="mt-2 text-15 font-semibold text-foreground first:mt-0" {...p} />,
  h3: (p) => <h3 className="mt-2 text-14 font-semibold text-foreground first:mt-0" {...p} />,
  p: (p) => <p className="leading-relaxed" {...p} />,
  ul: (p) => <ul className="ml-5 list-disc space-y-0.5" {...p} />,
  ol: (p) => <ol className="ml-5 list-decimal space-y-0.5" {...p} />,
  a: (p) => <a className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer" {...p} />,
  code: ({ className, children, ...rest }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-4 bg-surface-1 px-1 py-0.5 text-13" {...rest}>
        {children}
      </code>
    );
  },
  pre: (p) => <pre className="overflow-x-auto rounded-9 bg-surface-1 p-3 text-13" {...p} />,
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div data-testid="markdown-content" className="max-w-none break-words text-sm text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
