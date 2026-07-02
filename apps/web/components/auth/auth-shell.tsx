import type { ReactNode } from "react";

/**
 * AuthShell — BoardX Prototype 认证页两栏外壳。
 * 左：深色品牌面（仅桌面 lg+ 显示）；右：表单区，居中，内容宽 340px。
 * 见 docs/design/boardx-prototype-mapping.md §2.1。
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen">
      {/* 品牌面 — 桌面 only */}
      <aside className="hidden flex-1 flex-col justify-between bg-surface-darkest p-12 text-surface-dark-foreground lg:flex">
        <div className="flex items-center">
          <img src="/logo-full.png" alt="BoardX Logo" className="h-9 object-contain" />
        </div>
        <div>
          <h1 className="max-w-brand text-34 font-bold leading-tight tracking-tight">
            A collaborative canvas with AI built in.
          </h1>
          <p className="mt-4 max-w-brand text-15 leading-relaxed text-placeholder">
            Boards, rooms, AVA chat, AI Store, surveys and studio — one workspace
            for your team.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">© 2026 BoardX · Prototype</div>
      </aside>

      {/* 表单区 */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-85">{children}</div>
      </div>
    </main>
  );
}

/** 表单字段标签（12px / 500，对齐设计）。 */
export function AuthLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
      {children}
    </label>
  );
}

/** "OR" 分隔线。 */
export function AuthDivider() {
  return (
    <div className="my-4.5 flex items-center gap-2.5">
      <div className="h-px flex-1 bg-border" />
      <span className="text-11 text-placeholder">OR</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
