"use client";

import { CheckCircle2, ClipboardCheck, ExternalLink, ShieldCheck, TestTube2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    id: "F07",
    title: "AI 引导创建问卷",
    owner: "wrk-survey-web",
    status: "passing",
    evidence: "phases/phase-p13-survey/sprints/sprint-08/evidence/F07.verify.log",
    command: "pnpm --filter @repo/web exec playwright test e2e/survey-007-ai-guided-survey-creation.spec.ts",
    conclusion: "Create with AI、待确认草稿、Apply to Builder 已验收。",
  },
  {
    id: "F08",
    title: "AI 优化问卷",
    owner: "wrk-survey-web",
    status: "passing",
    evidence: "phases/phase-p13-survey/sprints/sprint-09/evidence/F08.verify.log",
    command: "pnpm --filter @repo/web exec playwright test e2e/survey-008-ai-optimize-change-set.spec.ts",
    conclusion: "待应用 change set、逐项确认、发布前检查已验收。",
  },
  {
    id: "F09",
    title: "AI Report Agent",
    owner: "wrk-survey-web",
    status: "passing",
    evidence: "phases/phase-p13-survey/sprints/sprint-11/evidence/F09.verify.log",
    command: "pnpm --filter @repo/web exec playwright test e2e/survey-009-ai-report-agent.spec.ts",
    conclusion: "报告生成、追问改写、导出和 report artifact 已验收。",
  },
  {
    id: "F10",
    title: "模型选择与失败切换",
    owner: "wrk-survey-web",
    status: "passing",
    evidence: "phases/phase-p13-survey/sprints/sprint-10/evidence/F10.verify.log",
    command: "pnpm --filter @repo/web exec playwright test e2e/survey-010-ai-model-switching.spec.ts",
    conclusion: "模型能力标签、失败 trace、备用模型切换已验收。",
  },
  {
    id: "F11",
    title: "Agent 操作审计与任务进度",
    owner: "wrk-survey-data",
    status: "passing",
    evidence: "phases/phase-p13-survey/sprints/sprint-07/evidence/F11.verify.log",
    command: "pnpm --filter @repo/web exec playwright test e2e/survey-011-ai-session-trace.spec.ts",
    conclusion: "AI session、draft、change set、report artifact、model trace 可恢复可审计。",
  },
];

const RISKS = [
  "真实外部模型需要配置 QWEN_API_KEY 或 DASHSCOPE_API_KEY；e2e 使用 SURVEY_AI_MOCK 保持确定性。",
  "PDF 导出当前为浏览器下载的最小可验证报告产物，后续可替换为服务端 PDF 渲染。",
  "change set 当前按题目顺序应用，复杂并发编辑场景后续应引入稳定 question identity。",
];

export default function SurveyAcceptancePage() {
  const passingCount = FEATURES.filter((feature) => feature.status === "passing").length;
  const ready = passingCount === FEATURES.length;

  return (
    <div data-testid="acceptance-professional-shell" className="min-h-full bg-secondary/20">
    <main data-testid="survey-acceptance-panel" className="mx-auto max-w-content px-9 py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant={ready ? "success" : "muted"}>{ready ? "Ready for PM acceptance" : "Acceptance pending"}</Badge>
          <h1 className="mt-3 text-30 font-bold tracking-tight text-foreground">Commercial Survey Acceptance</h1>
          <p className="mt-2 max-w-3xl text-14 leading-6 text-muted-foreground">
            Survey-only 商业版 AI 能力验收面板：汇总需求范围、F07-F11 进度、owner、验证命令、evidence 和剩余风险。
          </p>
        </div>
        <Button data-testid="back-to-surveys" variant="outline" size="sm" onClick={() => { window.location.href = "/surveys"; }}>
          <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
          Surveys
        </Button>
      </div>

      <section className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">验收功能</p>
          <p data-testid="acceptance-feature-count" className="mt-1 text-26 font-bold text-foreground">{passingCount}/{FEATURES.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">阻塞项</p>
          <p data-testid="acceptance-blockers" className="mt-1 text-26 font-bold text-foreground">0</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">证据状态</p>
          <p data-testid="acceptance-evidence" className="mt-1 text-26 font-bold text-foreground">Complete</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">PM 结论</p>
          <p data-testid="pm-conclusion" className="mt-1 text-18 font-bold text-foreground">
            {ready ? "Acceptable for production hardening" : "Pending evidence"}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" strokeWidth={1.5} />
          <h2 className="text-18 font-bold text-foreground">需求范围</h2>
        </div>
        <div data-testid="acceptance-scope" className="mt-4 grid gap-3 md:grid-cols-3">
          {["AI 创建问卷", "AI 优化问卷", "AI 报告生成", "模型失败切换", "操作审计恢复", "PM/QA 验收"].map((item) => (
            <div key={item} className="rounded-lg border border-border bg-background px-3 py-2 text-13 text-foreground">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <TestTube2 className="h-5 w-5 text-primary" strokeWidth={1.5} />
          <h2 className="text-18 font-bold text-foreground">Feature 验收证据</h2>
        </div>
        <div data-testid="feature-acceptance-list" className="mt-4 flex flex-col gap-3">
          {FEATURES.map((feature) => (
            <article key={feature.id} data-testid={`acceptance-${feature.id}`} className="rounded-lg border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">{feature.status}</Badge>
                    <h3 className="text-15 font-bold text-foreground">{feature.id} · {feature.title}</h3>
                  </div>
                  <p className="mt-2 text-13 text-muted-foreground">{feature.conclusion}</p>
                </div>
                <p className="text-12 text-muted-foreground">owner: {feature.owner}</p>
              </div>
              <dl className="mt-3 grid gap-2 text-12 md:grid-cols-[120px_1fr]">
                <dt className="text-muted-foreground">evidence</dt>
                <dd data-testid={`evidence-${feature.id}`} className="break-all text-foreground">{feature.evidence}</dd>
                <dt className="text-muted-foreground">verification</dt>
                <dd data-testid={`verify-${feature.id}`} className="break-all text-foreground">{feature.command}</dd>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <article className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" strokeWidth={1.5} />
            <h2 className="text-18 font-bold text-foreground">最近 AI Session 风险</h2>
          </div>
          <ul data-testid="acceptance-risks" className="mt-4 space-y-2 text-13 leading-6 text-muted-foreground">
            {RISKS.map((risk) => (
              <li key={risk} className="rounded-lg border border-border bg-background px-3 py-2">{risk}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" strokeWidth={1.5} />
            <h2 className="text-18 font-bold text-foreground">QA 可执行路径</h2>
          </div>
          <div data-testid="qa-paths" className="mt-4 flex flex-col gap-2 text-13 text-foreground">
            <p className="rounded-lg border border-border bg-background px-3 py-2">pnpm harness verify --sprint p13/07 --feature F11</p>
            <p className="rounded-lg border border-border bg-background px-3 py-2">pnpm harness verify --sprint p13/08 --feature F07</p>
            <p className="rounded-lg border border-border bg-background px-3 py-2">pnpm harness verify --sprint p13/09 --feature F08</p>
            <p className="rounded-lg border border-border bg-background px-3 py-2">pnpm harness verify --sprint p13/10 --feature F10</p>
            <p className="rounded-lg border border-border bg-background px-3 py-2">pnpm harness verify --sprint p13/11 --feature F09</p>
          </div>
        </article>
      </section>
    </main>
    </div>
  );
}
