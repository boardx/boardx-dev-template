// 工作区通用无权限占位（p30-F03）：由服务端 resolveWorkspaceAccess() 判定 forbidden
// 时渲染，绝不携带任何项目专属数据（governance binding / approval queue 等一律不进
// 这条渲染路径的 props）——这是「服务端裁剪」而非「拿到数据后前端隐藏」的关键证据。
// 无状态纯展示，可直接在 Server Component 里使用，无需 "use client"。
import { Button } from "@/components/ui/button";

export function WorkspaceNoAccess({
  testid,
  title,
  body,
}: {
  testid: string;
  title: string;
  body: string;
}) {
  return (
    <div
      data-testid={testid}
      className="flex flex-col items-center gap-3 rounded-12 border border-border bg-surface-1 py-14 text-center"
    >
      <span aria-hidden className="text-21">
        🔒
      </span>
      <p className="text-15 font-semibold text-foreground">{title}</p>
      <p className="max-w-brand text-13 leading-relaxed text-muted-foreground">{body}</p>
      <Button size="sm" variant="outline">
        ✋ 举手反映问题
      </Button>
    </div>
  );
}
