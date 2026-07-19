import type { ProfessionalSurveyReportDocument } from "./survey-professional-report";
import type { PublicTemplateDrivenSurveyReport } from "./survey-template-report";

export type SurveyReportDocument =
  | ProfessionalSurveyReportDocument
  | PublicTemplateDrivenSurveyReport;

export function isTemplateDrivenSurveyReport(
  report: SurveyReportDocument
): report is PublicTemplateDrivenSurveyReport {
  return "schemaVersion" in report
    && report.schemaVersion === "template-driven-report-v1";
}
