import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// F01 只建 /admin 骨架与模块导航；具体子页面（用户/团队/AI Store 审核·精选）是
// 独立的后续 feature（F02-F05，各自 owner），此处只提供占位目的地，不实现业务逻辑。
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <Link
        href="/admin"
        data-testid="back-to-admin-home"
        className="inline-flex items-center gap-1 text-13 text-muted-foreground transition-colors duration-200 hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        返回后台首页
      </Link>
      <div
        data-testid="coming-soon"
        className="mt-5 flex flex-col items-center justify-center rounded-12 border border-dashed border-border-strong px-6 py-14 text-center"
      >
        <h1 className="text-17 font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-13 text-muted-foreground">该模块即将上线，敬请期待。</p>
      </div>
    </div>
  );
}
