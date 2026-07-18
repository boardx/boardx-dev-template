import type { SurveyReportGenerationStatus } from "./survey-report-generation";

type ReportGenerationStatusVariant = "outline" | "muted" | "destructive" | "success";

export interface ReportGenerationEligibility {
  canGenerate: boolean;
  message: string | null;
}

export interface ReportGenerationDisplayStatus {
  label: string;
  detail: string;
  variant: ReportGenerationStatusVariant;
}

export function getReportGenerationEligibility(input: {
  draftDirty: boolean;
  saving: boolean;
  generating: boolean;
}): ReportGenerationEligibility {
  if (input.draftDirty || input.saving) {
    return {
      canGenerate: false,
      message: "请先保存要求，保存完成后即可生成。",
    };
  }
  if (input.generating) {
    return {
      canGenerate: false,
      message: "报告正在生成，请等待完成。",
    };
  }
  return { canGenerate: true, message: null };
}

export function getReportGenerationStatus(
  generation: SurveyReportGenerationStatus | undefined,
  draftDirty: boolean,
  requirementsChangedOverride = false
): ReportGenerationDisplayStatus {
  if (draftDirty) {
    return {
      label: "草稿未保存",
      detail: "请先保存要求，保存完成后再判断报告版本状态。",
      variant: "outline",
    };
  }
  if (requirementsChangedOverride) {
    return {
      label: "要求已修改",
      detail: "分析报告保留最近成功版本，请生成新版本应用新要求。",
      variant: "outline",
    };
  }
  if (!generation?.latestArtifact) {
    return {
      label: "尚未生成",
      detail: "请先保存要求，再手动生成首个可追溯报告版本。",
      variant: "muted",
    };
  }
  if (generation.stale) {
    const count = generation.latestArtifact.newResponseCount;
    return {
      label: "数据有更新",
      detail: count > 0
        ? `新增 ${count} 份答卷；分析报告保留最近成功版本，请生成新版本以纳入更新。`
        : "事实库已变化；分析报告保留最近成功版本，请生成新版本。",
      variant: "destructive",
    };
  }
  if (generation.requirementChanged) {
    return {
      label: "要求已修改",
      detail: "分析报告保留最近成功版本，请生成新版本应用新要求。",
      variant: "outline",
    };
  }
  return {
    label: "最新版本",
    detail: "当前报告与问卷事实库及章节要求一致。",
    variant: "success",
  };
}
