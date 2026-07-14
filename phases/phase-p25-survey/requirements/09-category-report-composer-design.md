# Survey Category Report Composer Design

## Goal

Redesign the survey report planning workflow into a category-driven report composer. The user should classify all survey questions with a real LLM, configure how each category contributes to the report, reorder categories, and preview a professional report assembled in that exact order.

The selected UI direction is option 3: **Report Composer**. The center of the screen is the report canvas, the left side controls the report outline and category order, and the right side configures the selected category.

## Why This Change

The current report planning UI is still too close to a flat template editor. It asks for generic pages, blocks, metrics, charts, and caveats, so different categories produce similar-looking report sections. The new model should be based on the survey's actual questions:

1. The system groups questions into meaningful report categories.
2. Each category has its own input modes, such as text, chat insight, chart, and image.
3. Users can add a custom category and assign specific questions into it.
4. The report preview is assembled category by category, in user-controlled order.
5. The final report generation follows the same category order and input mode configuration.

The project is still in development, so backward compatibility with the old flat report template is not required for the product model. Existing code can be migrated or replaced where it serves this cleaner design.

## Primary User Flow

1. The user enters **报告规划** for a selected survey.
2. If no category plan exists, the page shows an empty planning state with a primary action: **AI 分类问题**.
3. Clicking **AI 分类问题** calls a real model with the survey title, description, and all questions.
4. The model returns a category plan: category names, descriptions, assigned question IDs, recommended input modes, and suggested writing prompts.
5. The left outline lists categories in report order. The user can select a category, move it up or down, and add a custom category.
6. The right inspector lets the user configure the selected category:
   - category name
   - description
   - assigned questions
   - input modes: `文本`, `Chat 洞察`, `报表`, `图片`
   - category-specific report prompt
7. The center canvas renders a professional report preview assembled from all categories in order.
8. Saving the plan persists the category plan.
9. Generating the formal report uses the saved category plan and real model generation for the narrative parts.
10. Export supports PDF and Word. The UI should not mention PPT for this workflow.

## UIUX Direction

### Overall Layout

The page keeps the existing global rail and the BoardX Survey workspace navigation. Only the report planning workspace changes.

The report planning page uses a three-panel layout:

- **Left Outline Panel**: category list, ordering controls, status, and custom category creation.
- **Center Report Canvas**: professional report preview, shown as the primary surface.
- **Right Inspector Panel**: configuration for the selected category and generation settings.

This intentionally makes the report output visible while planning. Users should not need to scroll far down before seeing whether their category and input decisions produce the right report.

### Left Outline Panel

The left panel is dense and operational:

- Header: `报告结构`
- Primary button: `AI 分类问题`
- Secondary button: `新增分类`
- Category rows show:
  - order number
  - category name
  - assigned question count
  - input mode chips
  - warning state if no questions or no input modes
- Each selected row has clear active styling.
- Reorder uses up/down icon buttons for the first implementation. Full drag-and-drop sorting is out of scope for this pass.

### Center Report Canvas

The canvas should look like a professional report, not a form preview.

Top of canvas:

- report title
- survey context
- generation status
- selected model name
- export actions: `导出 PDF`, `导出 Word`

Report body:

- cover-like header for the whole report
- executive summary generated from all categories
- category sections in the current outline order
- each section visibly reflects its selected input modes:
  - **文本 only**: narrative prose, findings, limitations, and recommendations only.
  - **文本 + 图片**: narrative plus a generated-image preview/prompt card.
  - **文本 + 报表**: narrative plus chart/table modules.
  - **文本 + Chat 洞察**: narrative plus model dialogue/insight callouts.
  - **报表 only**: chart/table modules with minimal labels.
  - **图片 only**: image/prompt-led visual section with minimal text.
  - Multiple modes combine in a consistent order: text, chart, image, chat insight.

The preview may use deterministic sample content before the final report is generated, but it must clearly reflect the configured modes and question assignments.

### Right Inspector Panel

The right inspector edits only the selected category.

Sections:

- **分类设置**
  - category name
  - category description
  - included questions list
- **输入方式**
  - multi-select toggle group for `文本`, `Chat 洞察`, `报表`, `图片`
  - at least one mode must be selected
- **生成策略**
  - model prompt text area
  - report tone selector: professional, concise, analytical
  - chart preference if `报表` is selected
  - image brief if `图片` is selected
- **质量提示**
  - missing question warning
  - insufficient mode warning
  - export readiness state

## Data Model

Replace the old flat template shape:

```ts
interface SurveyReportTemplateInput {
  title: string;
  sections: string[];
  metrics: string[];
  chartSlots: string[];
  caveats: string[];
}
```

with a category plan:

```ts
type ReportInputMode = "text" | "chat" | "chart" | "image";

interface SurveyReportCategoryPlanInput {
  title: string;
  description: string;
  categories: SurveyReportCategoryInput[];
}

interface SurveyReportCategoryInput {
  id: string;
  name: string;
  description: string;
  questionIds: number[];
  inputModes: ReportInputMode[];
  prompt: string;
  order: number;
  isCustom: boolean;
}
```

Persist the plan as a single JSON-backed category plan for the survey. The implementation can either replace the old `survey_report_templates` payload with this shape or add a new `category_plan` JSON column and stop reading the old fields in the app. Since compatibility is not required, application code should treat the category plan as the source of truth.

## Real LLM Classification

Add a server route for classification:

```text
POST /api/surveys/[id]/report-categories
```

Request body:

```ts
{
  force?: boolean;
}
```

Server behavior:

1. Load the survey and all questions through `@repo/data`.
2. Call the real configured model through the existing Qwen/OpenAI-compatible helper used by survey AI routes.
3. Ask the model to group every question into a business-readable category.
4. Ask the model to recommend input modes per category.
5. Validate and clean the model JSON.
6. Persist the category plan.
7. Return the saved plan.

Model output schema:

```ts
{
  title: string;
  description: string;
  categories: Array<{
    name: string;
    description: string;
    questionIds: number[];
    inputModes: Array<"text" | "chat" | "chart" | "image">;
    prompt: string;
  }>;
}
```

Failure behavior:

- If the model call fails, return `{ error }` with a proper HTTP status.
- Do not silently pretend a real model ran.
- The UI may offer a deterministic fallback button, but it must label the result as local fallback rather than AI classification.

## Custom Categories

Users can add a custom category from the left panel.

Rules:

- Custom categories start with no assigned questions.
- The user can assign existing questions to the custom category.
- A question can belong to multiple categories only if explicitly allowed by the UI. First implementation should keep one primary category per question to reduce ambiguity.
- Moving a question from one category to another updates the report preview immediately.
- Custom categories participate in ordering and final report generation like model-generated categories.

## Report Assembly

The report renderer consumes the saved category plan:

1. Sort categories by `order`.
2. For each category, read assigned questions and selected input modes.
3. Build category-level report blocks according to selected modes.
4. Generate narrative text with the real model when the user generates the formal report.
5. Use deterministic preview content while editing, but keep the layout faithful to final output.

Section order is always the category order. Reordering categories in the outline changes the preview and final report order.

## Formal Report Generation

The existing AI report route should be refactored so the saved category plan drives the planned report blocks.

For each category:

- `text`: generate professional summary, evidence, risks, and recommendations.
- `chat`: generate expert-style insight cards or dialogue-derived interpretation.
- `chart`: compute chart/table data from assigned question responses.
- `image`: generate an image prompt or visual brief tied to the category. This pass must render a professional image slot or existing generated visual when available; integrating a new image-generation service is out of scope.

The final report should be more professional than the editor preview:

- stronger executive summary
- business-readable section titles
- clear evidence and limitation language
- stable visual hierarchy
- no placeholder copy

## Export

The report actions must be:

- `导出 PDF`
- `导出 Word`

No PPT export should appear in this report workflow.

Export should use the generated report artifact or current preview content:

- PDF opens the browser print/export flow or downloads a PDF if server-side PDF exists.
- Word downloads a `.doc` or `.docx` file with report title, summary, categories, text blocks, chart summaries, image captions, and limitations.
- Empty or ungenerated reports must show a visible error state instead of a no-op button.

## Error And Empty States

- No survey selected: show the existing workspace empty state.
- No questions: show `还没有问题，先完成问卷设计后再规划报告。`
- No category plan: show an AI classification call to action.
- Classification running: show a loading state in the left outline and canvas.
- Classification failed: show the server error and retry action.
- Category has no questions: show an inline warning and exclude it from formal generation until fixed.
- Category has no input modes: block save and show an inspector error.
- Model generation failed: keep the saved plan and show a retry action.

## Testing

Minimum verification:

- Unit tests for category plan cleaning and validation.
- Unit tests for category ordering and report assembly.
- API route test or focused integration test for `/api/surveys/[id]/report-categories` with mocked model output.
- UI test for:
  - AI classification creates categories.
  - selecting a category updates the inspector.
  - changing input modes updates preview sections.
  - reordering categories changes report section order.
  - PDF and Word buttons are visible and do not include PPT.
- `pnpm --filter @repo/web typecheck`
- `pnpm --filter @repo/web build`
- `pnpm --filter @repo/web lint` or the project-specific design lint command if available.

## Out Of Scope For This Pass

- Full drag-and-drop sorting.
- Live collaborative editing.
- Real image generation service integration if the existing app has no image endpoint yet.
- Backward compatibility with old flat report template fields in the UI.
- Pixel-perfect PDF pagination.

## Acceptance Criteria

1. Report planning uses the Report Composer layout: left category outline, center report canvas, right inspector.
2. A real model can classify all survey questions into report categories.
3. Users can add a custom category and assign questions to it.
4. Users can choose one or more input modes per category: text, chat insight, chart, image.
5. The preview changes based on selected input modes.
6. Category order controls report section order.
7. The formal report generation follows the saved category plan.
8. Export actions are PDF and Word only, and both provide visible success or error behavior.
9. The left global rail remains present.
10. The old flat template model is no longer the product source of truth.

