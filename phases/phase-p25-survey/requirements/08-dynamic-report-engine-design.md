# Survey Dynamic Report Engine Design

## Goal

Build a professional AI survey report system that does not use one fixed report template and does not require a full custom template per survey. The report should be generated from reusable report blocks, deterministic rules, and AI planning so different surveys produce different report structures while the product remains maintainable.

The first production target is the survey results report page and AI Report Agent. The summary and individual-answer views can remain statistical workspaces; the report tab should become the professional deliverable.

## Problem

The current report behaves like a generic dashboard. It renders similar sections for every survey:

- response count and completion quality
- question type structure
- generic AI summary
- generic findings, risks, and recommendations
- question snapshots

This makes product feedback, NPS, satisfaction, market research, and event feedback reports feel identical. The issue is structural, not only visual: the backend AI report shape and frontend renderer are both fixed.

## Product Principles

1. Reports are metadata-driven. Survey title, description, intent canvas, question wording, question type, options, tags, and responses determine the report structure.
2. Reports are block-composed. The system reuses a library of report blocks instead of maintaining many full templates.
3. AI plans and writes insights. Rules select stable blocks and charts; AI names the business meaning, writes findings, and explains limitations.
4. Low-sample reports are allowed but must show confidence, sample boundaries, and "directional only" language.
5. Visual design is consistent across reports, but report sections, charts, and narrative must vary by survey intent.

## Architecture

```text
Survey Definition
  title, description, questions, options, intent canvas, responses
        |
        v
Report Planner
  classifies report type, maps questions to business dimensions, selects blocks
        |
        v
Report Block Library
  reusable UI and chart modules
        |
        v
Report Composer
  orders blocks, chooses layout density, binds chart data, handles empty states
        |
        v
Insight Generator
  creates block-level findings, risks, recommendations, and executive summary
        |
        v
Theme Engine
  commercial report visual language, page structure, typography, Chart.js charts
```

## First Version Report Categories

The Planner should support these categories first:

- `product_feedback`: product experience, purchase motivation, price perception, improvement priority.
- `satisfaction_nps`: satisfaction, NPS, pain points, risk signals, loyalty drivers.
- `market_research`: audience profile, brand awareness, purchase behavior, competitor and opportunity analysis.
- `event_training_feedback`: participation quality, content or session rating, process feedback, next-event improvements.
- `general_research`: fallback for surveys that do not strongly match a category.

The category is not a full template. It is a hint that changes block selection, chart labels, narrative language, and ordering.

## Report Blocks

First-version block library:

- `executive_summary`: report title, category, top findings, confidence, sample boundary.
- `response_overview`: sample size, completion rate, response quality, valid-response notes.
- `demographic_profile`: demographic and persona-related questions such as age, role, region, industry.
- `satisfaction_score`: rating, Likert, CSI, CES-like questions.
- `nps_analysis`: recommendation intent and NPS-like questions.
- `choice_distribution`: business interpretation for single, multiple, and dropdown questions.
- `purchase_behavior`: purchase frequency, usage frequency, purchase reason, repurchase intent.
- `price_perception`: price acceptance, value-for-money, budget, willingness to pay.
- `brand_competitor`: brand awareness, competitor preference, comparison questions.
- `open_text_insight`: themes, representative feedback, negative signals, unresolved questions.
- `priority_matrix`: improvement priority based on frequency, rating, importance, or AI-inferred priority.
- `recommendation`: action plan, next research questions, suggested business decisions.
- `methodology`: data source, sample boundary, confidence, and unsupported conclusions.

Each block should define:

- `id`: stable block id.
- `title`: business-facing section title.
- `purpose`: why the block appears.
- `chartType`: Chart.js visualization or text-only.
- `sourceQuestionIds`: questions used by the block.
- `metrics`: computed metrics used by the block.
- `insights`: AI-generated findings for that block.
- `limitations`: sample or method caveats.

## Planner Rules

The Planner combines deterministic rules and AI classification.

Deterministic examples:

- If a question type is `nps`, include `nps_analysis`.
- If a title includes recommend, referral, NPS, or willingness to recommend, include `nps_analysis` even if the type is rating.
- If rating or linear scale questions exist, include `satisfaction_score`.
- If questions mention price, budget, value, expensive, cheap, or willingness to pay, include `price_perception`.
- If questions mention purchase, buy, usage frequency, repurchase, or trial, include `purchase_behavior`.
- If questions mention brand, competitor, alternative, or comparison, include `brand_competitor`.
- If demographic-like questions exist, include `demographic_profile`.
- If text questions have responses, include `open_text_insight`.
- Always include `executive_summary`, `response_overview`, `recommendation`, and `methodology`.

AI classification should refine:

- report category
- business dimension for each question
- block titles and section order
- which optional blocks should be omitted
- what conclusions are too strong for the sample size

## AI Report Shape

The AI report response should move from one fixed field list to a planned report:

```ts
interface PlannedSurveyReport {
  title: string;
  category: "product_feedback" | "satisfaction_nps" | "market_research" | "event_training_feedback" | "general_research";
  audienceLabel: string;
  decisionContext: string;
  confidence: "low" | "medium" | "high";
  executiveSummary: {
    headline: string;
    keyFindings: string[];
    decisionImplications: string[];
    caveat: string;
  };
  blocks: ReportBlock[];
  methodology: {
    sampleSize: number;
    dataSources: string[];
    limitations: string[];
  };
}
```

The legacy fields can be preserved temporarily for backward compatibility, but the report renderer should prefer `blocks` when present.

## UI Requirements

The report tab should feel like a professional report, not a form analytics page.

The first screen of the report tab should show:

- report cover header with report category and decision context
- executive summary with 3-5 key findings
- confidence and sample boundary
- generated date and model
- primary action buttons: regenerate, refine, export

The body should render block sections:

- each block has a strong business title, short AI insight, and visual chart or evidence panel
- Chart.js charts are used for numeric and categorical visuals
- text insights are displayed as quotes, themes, risks, and actions rather than raw answer dumps
- sections vary by block plan, not by a fixed sequence

The summary tab can remain a statistics dashboard. It should not be mistaken for the professional report.

## Data And Persistence

The planned report should continue using existing AI session, trace, and report artifact tables:

- `survey_ai_sessions`: stores report generation session and status.
- `survey_ai_model_traces`: stores planner prompt, model response, status, and latency.
- `survey_ai_report_artifacts`: stores the planned report JSON.

No new database table is required for the first version. If block plans become reusable later, a `survey_report_plans` table can be added.

## Error Handling

- If AI fails, generate a deterministic fallback plan from rules.
- If there are zero responses, render the planned structure with "insufficient data" states.
- If a block has no valid source data, omit it unless it is a required block.
- If the report JSON is malformed, clean it into the planned schema and record the model trace.

## Testing

Minimum verification:

- Unit tests for category and block planning rules.
- API tests or route-level tests for mock report output containing category and blocks.
- E2E coverage that product feedback and NPS-like surveys produce different report block structures.
- Existing summary and individual-answer flows should continue to work.
- Design lint and typecheck must pass.

## Out Of Scope For First Version

- Drag-and-drop report dashboards.
- Full BI-style filters and cross-tab builder.
- Advanced regression or statistical significance engine.
- Maintaining a separate full report template for every survey type.
- Pixel-perfect PDF generation.

## Acceptance Criteria

1. Two different survey intents produce visibly different report structures.
2. A product feedback survey includes product, purchase, price, improvement, and recommendation-oriented blocks when questions support them.
3. An NPS or satisfaction survey includes satisfaction and recommendation-specific blocks when questions support them.
4. The report page renders from a `blocks` plan rather than a fixed list of report fields.
5. Chart.js visuals are embedded inside relevant blocks.
6. Low-sample reports display confidence and limitations.
7. AI session, trace, and report artifact persistence remains intact.

