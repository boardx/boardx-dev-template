"use client";
// p23/F08 — 性能：按 开发者→agents 配对分组 + C-cycle 周期报告。
// 界面契约 = p23 ui-signoff confirmed 的原型 PerfTab 三层结构：
//   👤 开发者分组头（人类，绝不作为 agent 行出现）→ 🤖 agents 行 → sub-agent 按 parent 缩进（└）。
// 数据源：/api/portal/agents（registry.yaml 按 owner 分组 + coord-service 租约标注）。
// 诚实降级：per-agent flow-time / 周期承诺当前无数据源 → 列显示"数据积累中"（不造假）；
// coord_configured:false → 整列省略"当前租约"；C-cycle 周期报告无 Web 数据源 → unconfigured 态。
import { Fragment, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PortalCard, type PortalCardState } from "@/components/portal/portal-card";

interface AgentNode {
  id: string;
  kind: string;
  role: string | null;
  active: boolean;
  parent: string | null;
  lease: string | null;
  sub_agents: AgentNode[];
}

interface DeveloperGroup {
  owner: string | null;
  is_me: boolean;
  agent_count: number;
  agents: AgentNode[];
}

interface AgentsPayload {
  coord_configured: boolean;
  developers: DeveloperGroup[];
}

function AgentRow({ a, indent, showLease }: { a: AgentNode; indent: boolean; showLease: boolean }) {
  return (
    <tr className="border-t border-border transition-colors duration-200 hover:bg-muted">
      <td className={`py-2 text-foreground ${indent ? "pl-9" : "pl-4"}`}>{indent ? "└ " : ""}🤖 {a.id}</td>
      <td className="py-2">
        <Badge variant="outline" className="text-11">{a.kind}</Badge>
        {!a.active && <Badge variant="muted" className="ml-1 text-11">已停用</Badge>}
      </td>
      {/* per-agent flow-time / 周期承诺归因尚无数据源（ADR-010 差距）——诚实显示积累中，不造假 */}
      <td className="py-2 text-11 text-muted-foreground">数据积累中</td>
      <td className="py-2 text-11 text-muted-foreground">数据积累中</td>
      {showLease && <td className="py-2 text-11 text-muted-foreground">{a.lease ?? "—"}</td>}
    </tr>
  );
}

export function PerfTab() {
  const [state, setState] = useState<PortalCardState>("loading");
  const [data, setData] = useState<AgentsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/portal/agents");
        if (!res.ok) {
          if (!cancelled) setState("degraded");
          return;
        }
        const body = (await res.json()) as AgentsPayload;
        if (!cancelled) {
          setData(body);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("degraded");
      }
    }
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const showLease = data?.coord_configured ?? false;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <PortalCard state={state} wide title="表现：按 开发者 → 其 agents 分组（开发者是人，agent 是队伍）">
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-13">
              <thead>
                <tr className="text-left text-11 uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">开发者 / Agent</th>
                  <th className="pb-2 font-medium">类型</th>
                  <th className="pb-2 font-medium">流动时长</th>
                  <th className="pb-2 font-medium">周期承诺达成</th>
                  {/* coord 未配置 → 整列省略（诚实降级），不是渲染一列空值 */}
                  {showLease && <th className="pb-2 font-medium">当前租约</th>}
                </tr>
              </thead>
              <tbody data-testid="perf-dev-groups">
                {data.developers.map((g) => (
                  <Fragment key={g.owner ?? "__unowned__"}>
                    {/* 开发者分组头：人类（👤），绝不作为 agent 行出现 */}
                    <tr data-testid="perf-dev-header" className="border-t border-border bg-surface-2">
                      <td className="py-2 font-medium text-foreground" colSpan={2}>
                        👤 {g.owner ?? "未登记归属"}
                        {g.is_me && <Badge variant="secondary" className="ml-2 text-11">我</Badge>}
                      </td>
                      <td className="py-2 text-11 text-muted-foreground" colSpan={showLease ? 3 : 2}>
                        带来 {g.agent_count} 个 agent
                      </td>
                    </tr>
                    {g.agents.map((a) => (
                      <Fragment key={a.id}>
                        <AgentRow a={a} indent={false} showLease={showLease} />
                        {/* sub-agent 按 parent 派生树缩进（└），owner 与 parent 两条关系并存 */}
                        {a.sub_agents.map((s) => (
                          <AgentRow key={s.id} a={s} indent showLease={showLease} />
                        ))}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {!showLease && (
              <p className="mt-2 text-11 text-muted-foreground">当前租约列未显示：COORD_SERVICE_URL 未配置（部署中间态，不是故障）。</p>
            )}
          </div>
        )}
      </PortalCard>

      {/* C-cycle 周期报告：当前无 Web 数据源——unconfigured 态如实提示接线中，不渲染假表 */}
      <PortalCard state="unconfigured" wide title="工作周期报告（C-cycle）" unconfiguredHint="cycle-report CLI 数据接线中——该表将呈现每个 3h 周期的计划数 / 完成 / 流动时长 / 超 SLA。">
        <span />
      </PortalCard>
    </div>
  );
}
