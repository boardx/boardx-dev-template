"use client";
// W5 /p/:slug/people 花名册（p30 UI 先行原型，UC-03 / UC-05③）。
// 👤→🤖 两段式缩进树：成员行（角色徽章/在做什么）→ 名下 agents 缩进 → 点号 sub 再缩进。
// 👤/🤖 计数分开；行悬停卡显示完整 @handle/agent-name（D6）。
// ⚠️ 全部 mock（lib/mock/p30.ts）；真实实现时按项目 slug 拉取花名册。
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { HeartbeatDot } from "@/components/portal/heartbeat-dot";
import { EmptyState, IdentityChip, LoadingSkeleton, PrototypeHeader, useMockLoading } from "@/components/p30/shared";
import { MOCK_ROSTER, rosterCounts, type RosterAgentNode, type RosterMember } from "@/lib/mock/p30";

const HEARTBEAT_MIN = { fresh: 1, aging: 12, stale: 42 } as const;

const ROLE_BADGE: Record<RosterMember["role"], "default" | "secondary" | "outline"> = {
  owner: "default",
  maintainer: "secondary",
  approver: "secondary",
  contributor: "outline",
};

/** 行悬停卡：完整标识 + 归属链。group-hover 展现（含 focus-within 键盘可达）。 */
function HoverCard({ lines }: { lines: readonly string[] }) {
  return (
    <span
      data-testid="roster-hovercard"
      role="tooltip"
      className="pointer-events-none absolute left-8 top-full z-10 mt-1 hidden w-max max-w-brand rounded-10 border border-border bg-surface-dark px-3 py-2 text-12 leading-relaxed text-surface-dark-foreground shadow-lg transition-opacity group-hover:block group-focus-within:block"
    >
      {lines.map((l) => (
        <span key={l} className="block font-mono">
          {l}
        </span>
      ))}
    </span>
  );
}

function AgentRow({ node, depth, ownerHandle }: { node: RosterAgentNode; depth: 1 | 2; ownerHandle: string }) {
  return (
    <>
      <li
        data-testid={depth === 1 ? "roster-agent-row" : "roster-subagent-row"}
        tabIndex={0}
        className={`group relative flex flex-wrap items-center gap-2 rounded-8 border-l-2 border-l-tag-purple py-1.5 pr-2 transition-colors hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${depth === 1 ? "ml-8 pl-3" : "ml-16 pl-3"}`}
      >
        <HeartbeatDot minutes={HEARTBEAT_MIN[node.heartbeat]} />
        <IdentityChip kind="agent" className="font-mono">
          {node.id.split("/")[1] ?? node.id}
        </IdentityChip>
        {depth === 2 && <span className="text-11 text-muted-foreground">sub</span>}
        <span className={`min-w-0 flex-1 truncate text-12 ${node.heartbeat === "stale" ? "text-destructive" : "text-muted-foreground"}`}>{node.doing}</span>
        <HoverCard lines={[node.id, `owner：@${ownerHandle}${depth === 2 ? ` · parent：${node.id.split(".")[0] ?? ""}` : ""}`]} />
      </li>
      {node.subs.map((s) => (
        <AgentRow key={s.id} node={s} depth={2} ownerHandle={ownerHandle} />
      ))}
    </>
  );
}

function MemberBlock({ m }: { m: RosterMember }) {
  return (
    <li className="py-2">
      <div
        data-testid="roster-member-row"
        tabIndex={0}
        className="group relative flex flex-wrap items-center gap-2 rounded-10 border-l-2 border-l-tag-blue bg-surface-1 py-2 pl-3 pr-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IdentityChip kind="human">@{m.handle}</IdentityChip>
        <span className="text-13 font-medium text-foreground">{m.name}</span>
        <Badge variant={ROLE_BADGE[m.role]} className="text-11">{m.role}</Badge>
        <Badge variant="outline" className="text-11">{m.trust}</Badge>
        <span className="min-w-0 flex-1 truncate text-12 text-muted-foreground">{m.doing}</span>
        <span className="shrink-0 text-11 text-muted-foreground">🤖 ×{m.agents.reduce((n, a) => n + 1 + a.subs.length, 0)}</span>
        <HoverCard lines={[`@${m.handle} · ${m.name}`, `${m.role} · 信任级 ${m.trust}`]} />
      </div>
      <ul className="mt-1 space-y-1">
        {m.agents.map((a) => (
          <AgentRow key={a.id} node={a} depth={1} ownerHandle={m.handle} />
        ))}
      </ul>
    </li>
  );
}

export function PeopleRoster({ slug }: { slug: string }) {
  const loading = useMockLoading();
  const [emptyDemo, setEmptyDemo] = useState(false);
  const roster = emptyDemo ? [] : MOCK_ROSTER;
  const counts = rosterCounts(roster);

  return (
    <div className="mx-auto max-w-content space-y-4 px-6 pb-14 pt-7 md:px-9">
      <PrototypeHeader
        title="花名册"
        subtitle={`项目工作区 /p/${slug} · 人类是一等实体：👤 与 🤖 严格区分，owner 与 parent 两条关系并存`}
        emptyDemo={emptyDemo}
        onToggleEmptyDemo={() => setEmptyDemo((v) => !v)}
      />

      <div className="flex items-center gap-2">
        <IdentityChip kind="project">{slug}</IdentityChip>
        <span data-testid="roster-count-humans" className="rounded-full bg-tag-blue px-2.5 py-0.5 text-12 font-medium tabular-nums text-foreground">
          👤 成员 {counts.humans}
        </span>
        <span data-testid="roster-count-agents" className="rounded-full bg-tag-purple px-2.5 py-0.5 text-12 font-medium tabular-nums text-foreground">
          🤖 agent {counts.agents}
        </span>
        <span className="text-11 text-muted-foreground">（分开计数，UC-03；悬停任一行看完整标识）</span>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : roster.length === 0 ? (
        <EmptyState testid="roster-empty">这个项目还没有成员——从公开主页（P2）招募，或用接入向导邀请。</EmptyState>
      ) : (
        <ul data-testid="people-roster" className="divide-y divide-border rounded-12 border border-border bg-background px-3">
          {roster.map((m) => (
            <MemberBlock key={m.handle} m={m} />
          ))}
        </ul>
      )}

      <p className="text-11 text-muted-foreground">
        缩进语义：👤 成员（蓝）→ 名下 🤖 agent（紫，缩进一级）→ 点号 sub-agent（紫，缩进两级）；归属沿 parent 追溯到 owner。
      </p>
    </div>
  );
}
