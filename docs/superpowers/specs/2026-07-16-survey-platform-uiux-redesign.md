# Survey Platform UIUX Redesign

Date: 2026-07-16

## 1. Goal

Redesign the complete BoardX Survey product around the interaction and visual system demonstrated by:

`AI 问卷诊断平台(1).html`

The implementation must preserve the current Survey data model, permissions, Qwen AI integration, public answer flow, reporting capabilities, and five-step workflow. This is a product-wide UIUX redesign, not a replacement prototype or a static visual clone.

## 2. Product Principles

1. Survey is an AI-assisted research and diagnosis workspace, not only a form builder.
2. The primary journey is:
   create survey -> design report template -> publish and collect -> review responses -> generate insights.
3. AI is available throughout the workflow, but every generated change is previewed before it is applied.
4. Each surface has one primary responsibility. Navigation, editing, configuration, preview, and analysis must not repeat the same content.
5. Operational pages prioritize scanning, comparison, and repeated action over decorative presentation.

## 3. Application Shell

### 3.1 Navigation

Keep the existing BoardX global rail as the leftmost navigation.

Add a Survey workspace sidebar beside it:

- Home
- My Surveys
- Survey Templates
- Report Templates
- Insight Reports

The Survey sidebar displays the product identity, grouped navigation, relevant item counts, and a compact AI availability note. It may collapse to icon-only mode.

Survey editors and report-template builders use an immersive workspace mode. The Survey sidebar is hidden or collapsed so the content, preview, and AI assistant receive the available width.

### 3.2 Page Header

Every page uses:

- one literal page title;
- one concise supporting sentence;
- primary actions aligned to the upper right;
- no repeated feature descriptions inside the page body.

## 4. Visual System

- Neutral white, zinc, and black form the primary palette.
- Survey purple is reserved for AI actions, selection, progress, and key metrics.
- Success, warning, and destructive colors retain semantic meanings.
- Cards use a maximum radius of 8px.
- Page sections are unframed or contained by a single boundary. Nested decorative cards are prohibited.
- Lists and tables use dividers and aligned columns instead of repeated standalone cards.
- Text uses compact operational sizing. Large display type is limited to the workspace greeting and report cover.
- Existing semantic Tailwind and shadcn tokens remain authoritative. No new hard-coded color system is introduced.

## 5. Information Architecture

### 5.1 Survey Home

The home page includes:

- personalized greeting and current organization context;
- workspace metrics: active surveys, monthly responses, generated reports, completion rate;
- organization summary;
- community or recommended-template signal;
- a three-step diagnostic method;
- recommended templates;
- recent surveys in a compact list.

Primary actions:

- New Survey
- Browse Templates

### 5.2 My Surveys

The page begins with three creation paths:

- AI conversation;
- template;
- blank survey.

Surveys are displayed as a compact table-like list with:

- title and context;
- status;
- response progress;
- completion rate;
- next recommended action.

Actions depend on state:

- draft -> continue editing;
- collecting -> open collection or responses;
- complete -> view report.

### 5.3 Survey Template Center

Templates are managed independently from report templates.

Capabilities:

- tag filter;
- system and team ownership;
- two-column desktop layout;
- title, description, tags, question count, estimated time;
- linked report-template summary;
- use template;
- inspect linked report template;
- AI-generated template;
- manual template creation.

### 5.4 Report Template Center

Report templates define how collected evidence becomes a professional report.

Each template exposes:

- target audience and report purpose;
- enabled modules;
- expected chart and narrative components;
- compatible survey templates;
- preview action;
- edit action.

### 5.5 Survey Editor

Use the existing five-step workflow:

1. Design Survey
2. Report Template
3. Publish and Collect
4. Review Responses
5. Analyze Report

The Design Survey screen contains:

- compact survey metadata;
- continuous question editor;
- collapsible question outline when needed;
- simplified AI assistant;
- preview, save, and next-step actions.

The editor must not contain separate Responses or Settings tabs. Those responsibilities belong to the workflow steps.

AI behavior:

- user describes a goal or modification;
- AI returns a structured preview of additions, removals, rewrites, or reordering;
- user applies all or selected changes;
- applied questions immediately appear in the editor.

### 5.6 Report Template Builder

Use a three-column desktop workspace:

- left: ordered module list with enable, disable, and reorder controls;
- center: live module preview;
- right: AI assistant and module configuration.

Supported module families:

- cover and executive summary;
- sample-quality statement;
- hypothesis validation;
- radar and maturity views;
- score comparison;
- segment comparison;
- AI theme coding;
- NPS distribution;
- priority matrix;
- key quotations;
- action roadmap;
- image, chart, and text modules.

Configuration covers:

- chart type;
- X axis;
- Y axis;
- dimensions;
- metrics;
- sorting;
- colors;
- labels and legend;
- benchmark line;
- source footnote;
- data-generation prompt;
- layout position and size;
- text or image generation prompt.

AI may recommend a module structure for a stated audience, such as a ten-minute CEO briefing. Recommendations must be previewed before application.

### 5.7 Publish and Collect

Display:

- publication state;
- response identity mode;
- access scope;
- date window;
- response limit;
- one-response rule;
- confirmation message;
- public link;
- copy and preview actions.

Avoid repeating question editing or report-template configuration.

### 5.8 Review Responses

Display:

- response totals and collection progress;
- sample-quality overview;
- filters and segments;
- response list;
- single-response detail;
- invalid or flagged response states.

Raw responses must remain protected by existing authorization boundaries.

### 5.9 Analyze Report

The report is a professional research document, not a sequence of generic chart cards.

Recommended structure:

1. cover and executive summary;
2. sample and methodology;
3. sample-quality statement;
4. hypothesis validation;
5. key dimensions and benchmark comparisons;
6. segment differences;
7. qualitative themes and quotations;
8. priority matrix;
9. recommendations and action roadmap;
10. limitations and evidence notes.

Charts must use actual survey dimensions and compatible question types. AI narrative must reference evidence, limits, and sample quality.

### 5.10 Public Answer Page

Keep the current public, unauthenticated answer contract.

The page uses:

- professional branded header;
- compact progress;
- continuous paper-like question flow;
- inline question-type labels;
- clear required state;
- accessible radio, checkbox, rating, text, date, file, and scale controls;
- persistent submit action on long surveys;
- success and validation states.

## 6. Responsive Behavior

### Desktop

- global rail + Survey sidebar on management pages;
- two-column template grids;
- three-column report-template builder;
- compact table lists.

### Tablet

- Survey sidebar collapses;
- report builder uses outline drawer + preview + inspector drawer;
- actions remain in one command bar.

### Mobile

- single-column content;
- filter controls move into a sheet;
- AI assistant opens as a full-height drawer;
- creation paths become a vertical list;
- report modules use a preview-first flow.

## 7. Data and Architecture

- Reuse existing Survey API routes and data contracts.
- Do not replace room, team, or owner authorization.
- Do not copy the reference prototype's in-memory data model.
- Qwen remains the AI provider through existing project interfaces.
- Existing ECharts-based report rendering remains available, but chart configuration is reorganized around report modules.
- Shared shell and page components should be extracted only where they remove real duplication across Survey pages.

## 8. Error and Empty States

- Database or API errors render a stable in-page error state instead of crashing the entire Server Component tree where feasible.
- Empty survey, template, response, and report states include one primary action.
- AI failure preserves current edits and offers retry or manual continuation.
- Long-running AI operations show progress and remain cancellable.
- Unsaved editor changes are not discarded by workflow navigation without confirmation.

## 9. Accessibility

- All controls remain keyboard accessible.
- Focus indicators use the existing semantic ring token.
- Icon-only controls include accessible names and tooltips.
- Status is communicated by text in addition to color.
- Charts provide textual summaries.
- Mobile controls meet minimum target sizes.
- Reduced-motion preferences are respected.

## 10. Verification

The redesign is complete only when:

- management pages use the new Survey shell;
- editor pages use the five-step workflow without Responses or Settings tabs;
- AI previews can be applied and visibly update the editor;
- templates and report templates remain independently manageable;
- public answer flow remains unauthenticated and functional;
- collection, response review, and report generation use real APIs;
- desktop and mobile screenshots show no overlap, clipping, or blank chart canvases;
- Survey Playwright suites, typecheck, unit tests, design lint, and harness verification pass;
- screenshots and command output are stored in phase evidence.

## 11. Delivery Strategy

Implement in vertical slices:

1. shell, home, and My Surveys;
2. survey-template and report-template centers;
3. survey editor and AI change preview;
4. report-template builder;
5. publish and response review;
6. professional report;
7. public answer page and responsive audit.

Each slice must preserve the existing routes and behavior while replacing the corresponding visual surface.
