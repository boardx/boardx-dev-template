"use client";
// 04-F16：团队 Home——Dashboard 统计壳（Active Members / AI Tools / Pending Reviews /
// Total Tokens）+ 管理入口卡片 + AI Store 分组（Explore / Subscribe / Approval），
// 全部以当前团队为上下文。统计取自既有 API：成员列表、team-scope Store 项目、
// 待审核队列（无审批权限显示 —）、团队 Credit 钱包 total_consumed（无权限显示 —）。
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Bot, ClipboardCheck, Coins, Settings, Store } from "lucide-react";

interface StatCardProps {
  testid: string;
  label: string;
  value: string;
  icon: typeof Users;
}

function StatCard({ testid, label, value, icon: Icon }: StatCardProps) {
  return (
    <div data-testid={testid} className="rounded-12 border border-border p-4">
      <div className="flex items-center gap-2 text-13 text-muted-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
        {label}
      </div>
      <div className="mt-2 text-22 font-bold text-foreground">{value}</div>
    </div>
  );
}

function EntryCard({ testid, title, description, href }: { testid: string; title: string; description: string; href: string }) {
  return (
    <Link
      data-testid={testid}
      href={href}
      className="block rounded-12 border border-border p-4 transition-all hover:border-border-strong hover:bg-surface-1"
    >
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <p className="mt-1 text-13 text-muted-foreground">{description}</p>
    </Link>
  );
}

export default function TeamHomePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const teamId = Number(params.id);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [members, setMembers] = useState<number | null>(null);
  const [aiTools, setAiTools] = useState<number | null>(null);
  const [pendingReviews, setPendingReviews] = useState<number | null>(null);
  const [totalTokens, setTotalTokens] = useState<number | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await (await fetch("/api/auth/session")).json();
      if (!alive) return;
      if (!s.user) {
        router.replace("/login");
        return;
      }
      const [teamsRes, membersRes, itemsRes, reviewRes, walletRes] = await Promise.all([
        fetch("/api/teams"),
        fetch(`/api/teams/${teamId}/members`),
        fetch("/api/ai-store/items?pageSize=50"),
        fetch(`/api/teams/${teamId}/ai-store-review`),
        fetch("/api/credits/wallet?scope=team"),
      ]);
      if (!alive) return;
      if (membersRes.status === 403 || membersRes.status === 401) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      if (teamsRes.ok) {
        const ts = await teamsRes.json();
        const t = (ts.teams ?? []).find((x: { id: number | string }) => String(x.id) === String(teamId));
        if (alive) setTeamName(t?.name ?? null);
      }
      if (membersRes.ok) {
        const m = await membersRes.json();
        if (alive) setMembers((m.members ?? []).length);
      }
      if (itemsRes.ok) {
        const it = await itemsRes.json();
        if (alive) setAiTools(((it.items ?? []) as Array<{ scope: string }>).filter((x) => x.scope === "team").length);
      }
      if (reviewRes.ok) {
        const rv = await reviewRes.json();
        if (alive) setPendingReviews((rv.items ?? []).length);
      }
      if (walletRes.ok) {
        const w = await walletRes.json();
        if (alive) setTotalTokens(w.wallet?.total_consumed ?? 0);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [router, teamId]);

  if (loading) {
    return (
      <div data-testid="loading" className="mx-auto max-w-content animate-pulse px-9 py-10">
        <div className="h-8 w-1/3 rounded bg-muted" />
        <div className="mt-6 h-24 w-full rounded bg-muted" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div data-testid="team-home-forbidden" className="mx-auto max-w-content px-9 py-10">
        <p className="text-sm text-muted-foreground">你不是该团队成员，无法查看团队管理页。</p>
      </div>
    );
  }

  const fmt = (n: number | null) => (n === null ? "—" : String(n));

  return (
    <div data-testid="team-home" className="mx-auto max-w-content px-9 pb-14 pt-10">
      <h1 className="text-22 font-bold tracking-tight text-foreground">
        Team Home{teamName ? <span data-testid="team-home-name"> · {teamName}</span> : null}
      </h1>

      {/* Dashboard 统计卡片 */}
      <section data-testid="team-dashboard" className="mt-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard testid="stat-active-members" label="Active Members" value={fmt(members)} icon={Users} />
        <StatCard testid="stat-ai-tools" label="AI Tools" value={fmt(aiTools)} icon={Bot} />
        <StatCard testid="stat-pending-reviews" label="Pending Reviews" value={fmt(pendingReviews)} icon={ClipboardCheck} />
        <StatCard testid="stat-total-tokens" label="Total Tokens" value={fmt(totalTokens)} icon={Coins} />
      </section>

      {/* 管理入口卡片 */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-1.5 text-13 font-semibold text-foreground">
          <Settings className="h-4 w-4" strokeWidth={1.5} /> Manage
        </h2>
        <div data-testid="team-entries" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <EntryCard testid="entry-general" title="Team General" description="Rename, description and team lifecycle." href="/teams" />
          <EntryCard testid="entry-members" title="Team Members" description="Invite, roles and membership." href="/teams" />
          <EntryCard testid="entry-credits" title="Team Credits" description="Wallet, usage and transactions." href="/credits" />
          <EntryCard testid="entry-memory" title="Team Memory" description="Reusable AI collaboration context." href={`/teams/${teamId}/memory`} />
          <EntryCard testid="entry-knowledge" title="Knowledge Base" description="Team knowledge and files." href="/knowledge-base" />
          <EntryCard testid="entry-surveys" title="Team Surveys" description="Create and analyze surveys." href="/surveys" />
        </div>
      </section>

      {/* AI Store 分组 */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-1.5 text-13 font-semibold text-foreground">
          <Store className="h-4 w-4" strokeWidth={1.5} /> AI Store
        </h2>
        <div data-testid="team-ai-store-group" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <EntryCard testid="store-explore" title="Store Explore" description="Browse agents and tools in the current team context." href="/ai-store" />
          <EntryCard testid="store-subscribe" title="Store Subscribe" description="Items subscribed by you and this team." href="/ai-store?nav=subscribe" />
          <EntryCard testid="store-approval" title="Store Approval" description="Review items submitted to this team." href={`/teams/${teamId}/ai-store-review`} />
        </div>
      </section>

      <p className="mt-8 text-11 text-placeholder">Stats are scoped to the current team.</p>
    </div>
  );
}
