# AGENTS.md — apps/web 局部指令

> 包级 scoped 指令（渐进披露第 2 层），补充根 AGENTS.md。

## 本包职责
Next.js(App Router) 前端 + 面向用户的 API route handlers。CAP-WEB / CAP-UI。

## 局部约束
- **DB 不散写**：所有 Postgres 访问走 `@repo/data` 的仓储函数，禁止在 route 里写裸 SQL。
- **入队走封装**：任务入队用 `@repo/queue` 的 `makeQueue`/`QUEUE_NAMES`，不硬编码队列名。
- **API 错误结构化**：route 返回 `{ error }` + 合适状态码，不抛裸异常给客户端。
- 用到 pg/bullmq 的 route 必须 `export const runtime = "nodejs"`（不能跑 edge）。
- UI 组件走 shadcn 惯用法（`cn` + variant），样式用 Tailwind，别内联魔法值。
- 验证见 `.harness/instructions/testing-standards.md` 的「CAP-WEB」段。

---

## UI 质量强制要求（生产标准）

> **开始写任何页面/组件前先读** `.harness/instructions/uiux-standards.md` 的「Feature UI 完成定义（DON）」清单（U1-U8）。
> 完成后跑 `pnpm lint-design` 本地验证，不通过不能提交。

### 每个 UI feature 必须实现的三态

**不允许**数据加载期间出现空白页面、列表为空时没有提示、请求失败时静默无反馈。

```tsx
// ─── 标准 page 骨架（带数据获取）────────────────────────────────────────────
"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Item = { id: number; name: string };

export default function ExamplePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setError("加载失败，请刷新重试"))
      .finally(() => setLoading(false));
  }, []);

  // U1: loading skeleton
  if (loading) {
    return (
      <div data-testid="loading" className="flex flex-col gap-3 animate-pulse p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">页面标题</h1>

      {/* U3: error state */}
      {error && (
        <p role="alert" data-testid="err-page" className="text-sm text-destructive">{error}</p>
      )}

      {/* U2: empty state */}
      {items.length === 0 && !error ? (
        <div data-testid="empty"
          className="flex flex-col items-center gap-4 rounded-lg border border-dashed
                     border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">还没有内容，创建第一个试试</p>
          <Button size="sm">新建</Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}
              className={cn(
                "flex items-center justify-between rounded-lg border bg-card px-4 py-3",
                "text-card-foreground shadow-sm",
                // U4: hover + transition
                "transition-all duration-200 hover:shadow-md hover:border-border/70 cursor-pointer"
              )}>
              <span className="text-sm font-medium">{item.name}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

### Auth 页面骨架（login/register/reset-password）

Auth 页面不带全局 shell，居中卡片布局，**必须**有 Label + Input 配对：

```tsx
// ─── Auth 表单标准写法 ────────────────────────────────────────────────────────
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 字段单元：Label + Input + inline error（无障碍配对）
function Field({
  id, label, error, ...inputProps
}: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-describedby={error ? `${id}-err` : undefined} {...inputProps} />
      {error && (
        <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

// 页面层：居中卡片
export default function AuthPage() {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">登录 BoardX</CardTitle>
          <p className="text-sm text-muted-foreground">欢迎回来，请输入你的账号信息。</p>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4">
            <Field id="email" label="邮箱" type="email" placeholder="you@example.com" />
            <Field id="password" label="密码" type="password" placeholder="••••••••" />

            {formError && (
              <p role="alert" data-testid="err-form" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full transition-all duration-200 active:scale-[0.98]"
            >
              {submitting ? "提交中…" : "登录"}
            </Button>
          </form>

          <div className="mt-4 flex justify-between text-sm">
            <a href="/forgot-password"
              className="text-muted-foreground underline-offset-4 transition-colors
                         hover:text-foreground hover:underline">
              忘记密码？
            </a>
            <a href="/register"
              className="text-foreground underline-offset-4 transition-colors hover:underline">
              创建账号
            </a>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
```

### 提交前自检（每次写完 UI feature 必过）

```
□ U1 loading skeleton（data-testid="loading" + animate-pulse）
□ U2 empty state（data-testid="empty" + 引导 CTA）
□ U3 error state（role="alert" + data-testid="err-*" + text-destructive）
□ U4 hover: + transition-* 成对出现；focus-visible:ring-2 在输入元素上
□ U5 无 hex/palette 硬编码；无 [Npx] 任意值
□ U6 无裸 <input>/<select>/<button>（app/ 层）
□ U7 每个 Input 有对应 <Label htmlFor>；<img> 有 alt
□ U8 pnpm lint-design 通过
```
