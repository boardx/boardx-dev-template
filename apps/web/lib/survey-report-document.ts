import type { ProfessionalSurveyReportDocument } from "./survey-professional-report";
import type { PublicTemplateDrivenSurveyReportView } from "./survey-template-report";

export type SurveyReportDocument =
  | ProfessionalSurveyReportDocument
  | PublicTemplateDrivenSurveyReportView;

export function isTemplateDrivenSurveyReport(
  report: SurveyReportDocument
): report is PublicTemplateDrivenSurveyReportView {
  return "schemaVersion" in report
    && report.schemaVersion === "template-driven-report-v1";
}
