"use client";

import { BarChart3, ClipboardList, Eye, Home, LayoutTemplate, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export type SurveyNavigationTarget = "home" | "workspace" | "templates" | "reports" | "insights";

interface SurveyNavigationSidebarProps {
  active: SurveyNavigationTarget;
  onNavigate: (target: SurveyNavigationTarget) => void;
}

const NAVIGATION = [
  { id: "home", label: "主页", group: "工作台", icon: Home },
  { id: "workspace", label: "我的问卷", icon: ClipboardList },
  { id: "templates", label: "问卷模版", group: "模版库", icon: LayoutTemplate },
  { id: "reports", label: "报告模版", icon: BarChart3 },
  { id: "insights", label: "洞察报告", group: "参考", icon: Eye },
] as const;

export function SurveyNavigationSidebar({ active, onNavigate }: SurveyNavigationSidebarProps) {
  return (
    <aside
      data-testid="survey-source-sidebar"
      className="sticky top-0 hidden h-screen flex-col border-r border-border bg-background py-5.5 pl-survey-sidebar-inset pr-4.5 lg:flex"
    >
      <div className="flex items-center gap-3 px-1">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-foreground text-background">
          <ListChecks className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <div>
          <p className="text-15 font-bold">BoardX Survey</p>
          <p className="text-12 text-muted-foreground">咨询诊断工作台</p>
        </div>
      </div>

      <nav aria-label="Survey navigation" className="mt-5 grid gap-1">
        {NAVIGATION.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <div key={item.id}>
              {"group" in item ? (
                <p className={`${item.id === "home" ? "" : "mt-7"} mb-2 px-3 text-11 font-medium text-muted-foreground`}>
                  {item.group}
                </p>
              ) : null}
              <Button
                data-testid={`survey-nav-${item.id}`}
                type="button"
                variant="ghost"
                className={`h-11 w-full justify-start gap-3 rounded-lg border-0 px-3 text-14 transition-colors duration-200 ${
                  isActive
                    ? "!bg-foreground !text-background hover:!bg-foreground hover:!text-background"
                    : "bg-transparent text-foreground hover:bg-secondary"
                }`}
                onClick={() => onNavigate(item.id)}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center text-current" aria-hidden="true">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                {item.label}
              </Button>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto rounded-lg border border-border bg-surface-1 p-3.5">
        <div className="flex items-center gap-2 text-12 font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-survey" strokeWidth={1.7} />
          AI 助手默认开启
        </div>
        <p className="mt-1 text-12 leading-5 text-muted-foreground">新建问卷时可直接用对话生成第一版，再逐步迭代。</p>
      </div>
    </aside>
  );
}

export function SurveyMobileNavigation({ active, onNavigate }: SurveyNavigationSidebarProps) {
  return (
    <header
      data-testid="survey-mobile-navigation"
      className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background px-4 py-3 lg:hidden"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground text-background">
        <ListChecks className="h-4 w-4" strokeWidth={1.7} />
      </div>
      <Select
        aria-label="问卷导航"
        value={active}
        onChange={(event) => onNavigate(event.target.value as SurveyNavigationTarget)}
        className="min-w-0 flex-1"
      >
        {NAVIGATION.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </Select>
    </header>
  );
}
