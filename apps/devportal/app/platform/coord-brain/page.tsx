// /platform/coord-brain — CoordBrain 影子决策列表（R1 影子模式，p30-F10）。
//
// 这是运维观察面而非终端用户视图（治理面路由，middleware.ts 头注：/platform 走
// Access JWT 逐路由验签，不进 OAuth 会话 matcher），最简只读表格即可满足
// "人核对影子决策"的验收诉求——UI 先行确认关卡（ADR-003）只对 has_ui 阶段的
// 终端用户界面生效，本页是运维观察面，故不走 ui-signoff，采用最保守的朴素表格
// 呈现（无交互、无图表、无自定义视觉语言），符合"若判断需要 UI 先行则保守处理"的
// 指导原则。
//
// CoordBrain 只观察不执行（feature 红线），本页同样只读——没有任何"确认/驳回/
// 执行"按钮，纯粹是给人核对"它将会做的决策"用的台账视图。
import { headers } from "next/headers";
import { accessUser } from "@/lib/access";
import { fetchShadowDecisions, type ShadowDecision } from "@/lib/coord-gateway";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const RULE_LABEL: Record<string, string> = {
  merge_ready: "全绿可合并",
  dispatch_suggested: "ready-for-dev 派工",
  pr_nudge: "PR 超时催办",
  stale_lease_reclaim: "stale 租约回收",
  andon_freeze: "andon 冻结",
};

export default async function CoordBrainShadowPage() {
  const user = await accessUser(headers());

  if (!user) {
    return (
      <main className="mx-auto max-w-content px-9 pb-14 pt-7">
        <h1 className="text-21 font-bold text-foreground">CoordBrain 影子决策</h1>
        <p className="mt-2 text-13 text-muted-foreground">
          请通过 https://develop.boardx.us 访问（Cloudflare Access · GitHub 登录）。
        </p>
      </main>
    );
  }

  const result = await fetchShadowDecisions(200);

  return (
    <main className="mx-auto max-w-content px-9 pb-14 pt-7">
      <h1 className="text-21 font-bold text-foreground">CoordBrain 影子决策（R1）</h1>
      <p className="mt-2 text-13 text-muted-foreground">
        只读观察面：以下是 CoordBrain 每 tick 判定「它将会做的决策」的记录——它从不真的执行任何合并/派工/回收动作。
        供人核对影子周期内是否零误判（对照台账见 evidence/R1-shadow-audit.md）。
      </p>

      {!result.configured && (
        <p className="mt-6 text-13 text-muted-foreground" data-testid="shadow-not-configured">
          协调网关未配置（COORD_GATEWAY_URL/COORD_API_TOKEN/GITHUB_REPO），暂无数据。
        </p>
      )}

      {result.configured && "error" in result && (
        <p className="mt-6 text-13 text-destructive" data-testid="shadow-error">
          影子决策暂不可达：{result.error}
        </p>
      )}

      {result.configured && "decisions" in result && (
        <div className="mt-6 overflow-x-auto" data-testid="shadow-decisions-table">
          <table className="w-full min-w-[720px] border-collapse text-13">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4">时间</th>
                <th className="py-2 pr-4">规则</th>
                <th className="py-2 pr-4">对象</th>
                <th className="py-2 pr-4">决策</th>
                <th className="py-2 pr-4">理由</th>
              </tr>
            </thead>
            <tbody>
              {result.decisions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-muted-foreground" data-testid="shadow-empty">
                    暂无影子决策记录（CoordBrain cron 尚未跑过 tick，或本仓无任何 tick 观测对象）。
                  </td>
                </tr>
              )}
              {result.decisions.map((d: ShadowDecision) => (
                <tr key={d.event_id} className="border-b border-border/60">
                  <td className="py-2 pr-4 text-muted-foreground">{d.at}</td>
                  <td className="py-2 pr-4">{RULE_LABEL[d.rule] ?? d.rule}</td>
                  <td className="py-2 pr-4">{d.subject_id}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={d.decision ? "text-foreground font-medium" : "text-muted-foreground"}
                      data-testid={`shadow-decision-${d.decision ? "true" : "false"}`}
                    >
                      {d.decision ? "会执行" : "不执行"}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{d.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
