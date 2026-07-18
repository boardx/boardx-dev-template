import type { PublicTemplateDrivenSurveyReport } from "./survey-template-report";

export function reportOutlineItems(report: PublicTemplateDrivenSurveyReport) {
  return report.templateSnapshot.chapters.map((chapter) => ({
    id: chapter.id,
    label: chapter.title,
    outputType: chapter.outputType,
  }));
}
