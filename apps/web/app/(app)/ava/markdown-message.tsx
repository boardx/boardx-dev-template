"use client";
// apps/web/app/(app)/ava/markdown-message.tsx — AVA 消息内容渲染（Markdown / 代码块，P9 F01/F11）
//
// 不依赖 Tailwind typography 插件（本仓未装），手写最小必要的元素样式，
// 覆盖标题/列表/行内代码/代码块，满足 F01 验收（Markdown/代码块可渲染）。
//
// P9 F11：每个代码块（<pre><code>…</code></pre>）自带独立的复制按钮，只复制该代码块的
// 纯文本内容——与消息级「复制」（复制整条消息文本）区分开，满足「代码块只复制代码块」。
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Check, Copy } from "lucide-react";

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = typeof children === "string" ? children : String(children ?? "");

  async function copyCode() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text.replace(/\n$/, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用：静默失败，按钮态不变，用户可手动选中代码块文本复制。
    }
  }

  return (
    <div data-testid="code-block" className="group relative">
      <pre className="overflow-x-auto rounded-9 bg-surface-1 p-3 pr-10 text-13">
        <code className={className}>{children}</code>
      </pre>
      <button
        type="button"
        data-testid="code-block-copy"
        aria-label="Copy code block"
        onClick={() => void copyCode()}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-6 border border-border bg-background text-muted-foreground opacity-0 transition-opacity hover:bg-surface-1 group-hover:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
      </button>
    </div>
  );
}

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
  // react-markdown 把代码块渲染成 <pre><code class="language-…">…</code></pre>；用自定义 pre
  // 包一层复制按钮（上面的 code renderer 只负责块内 <code> 本身的样式，不重复渲染 <pre>）。
  pre: ({ children }) => {
    const child = Array.isArray(children) ? children[0] : children;
    const className =
      child && typeof child === "object" && "props" in child
        ? (child.props as { className?: string }).className
        : undefined;
    const codeChildren =
      child && typeof child === "object" && "props" in child
        ? (child.props as { children?: React.ReactNode }).children
        : children;
    return <CodeBlock className={className}>{codeChildren}</CodeBlock>;
  },
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
