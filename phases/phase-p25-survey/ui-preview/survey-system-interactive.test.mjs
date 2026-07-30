import assert from "node:assert/strict";
import fs from "node:fs";

const htmlPath = new URL("./survey-system-interactive.html", import.meta.url);
const html = fs.readFileSync(htmlPath, "utf8");
const buttonTags = [...html.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);
const persistentIds = /id="(?:previewBtn|saveBtn|backBtn|closePreview|submitPreview)"/;
const delegatedContracts = /data-(?:action|step|question|chapter|response|module)=/;
const segmentContract = /class="[^"]*\bsegment\b/;
const unboundButtons = buttonTags.filter(
  (tag) => !persistentIds.test(tag) && !delegatedContracts.test(tag) && !segmentContract.test(tag),
);

assert.deepEqual(
  unboundButtons,
  [],
  `Every visible button must have an interaction contract. Missing:\n${unboundButtons.join("\n")}`,
);

for (const action of [
  "home-create",
  "home-my",
  "home-templates",
  "home-report-templates",
  "home-insights",
  "close-create",
  "create-ai",
  "create-template",
  "create-blank",
  "continue-edit",
  "template-filter",
  "outline-menu",
  "chapter-settings",
  "publish-section",
  "add-response-view",
  "filter-responses",
  "close-response",
  "select-report-chapter",
  "edit-report",
]) {
  assert.match(html, new RegExp(action), `Missing interactive action: ${action}`);
}

const declaredActions = [...new Set([...html.matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]))]
  .filter((action) => !action.includes("${"));
const handledActions = [...new Set([...html.matchAll(/action === "([^"]+)"/g)].map((match) => match[1]))];
const missingHandlers = declaredActions.filter((action) => !handledActions.includes(action));

assert.deepEqual(
  missingHandlers,
  [],
  `Every delegated action must have a handler. Missing:\n${missingHandlers.join("\n")}`,
);

assert.doesNotMatch(
  html,
  /<span>⋯<\/span>/,
  "Overflow menus that look clickable must be real buttons",
);

assert.match(
  html,
  /state\.questions\.map\(\(question, index\) => questionCard\(question, index, categories\)\)/,
  "Design view must render every survey question instead of only the selected question",
);

for (const contract of [
  "data-question-title",
  "data-question-type",
  "data-question-category",
  "data-question-required",
  "data-question-index",
]) {
  assert.match(html, new RegExp(contract), `Missing multi-question editor contract: ${contract}`);
}

assert.match(html, /function previewWorkspace\(\)/, "Missing full-page survey preview");
assert.match(html, /fluent-research-header\.webp/, "Preview must use the current Survey header asset");
assert.match(html, /state\.questions\.map\(\(question, index\) => `<section class="answer-question"/, "Preview must render all questions");
assert.match(html, /id="previewBtn"/, "Merged workflow header must expose the design preview action");
assert.match(html, /id="saveBtn"/, "Merged workflow header must expose the save action");
assert.match(html, /\.app\.preview-only \.topbar, \.app\.preview-only \.workflow \{ display: none; \}/, "Standalone preview must hide the editor chrome");
assert.match(html, /class="btn dashed add-question-bottom" data-action="add-question"/, "Design view must provide a bottom Add Question action");
assert.match(html, /grid-template-rows: 76px 108px minmax\(0, 1fr\)/, "Merged workflow header must remain above the scrolling workspace");
assert.doesNotMatch(html, /design-toolbar/, "Design view must not render a duplicate command toolbar");
assert.doesNotMatch(html, /preview-stage|preview-modal/, "Legacy modal preview must not remain");

const designWorkspaceSource = html.match(/function designWorkspace\(\)[\s\S]+?function previewAnsweredCount\(\)/)?.[0] ?? "";
const previewWorkspaceSource = html.match(/function previewWorkspace\(\)[\s\S]+?function chapterSide\(\)/)?.[0] ?? "";
assert.doesNotMatch(designWorkspaceSource, /报告模版/, "Design toolbar must not repeat the Report Template action");
assert.doesNotMatch(previewWorkspaceSource, /报告模版/, "Preview command bar must not show the Report Template action");
assert.doesNotMatch(previewWorkspaceSource, /preview-command|edit-survey|return-list/, "Standalone preview must only render the questionnaire");

console.log(`interaction contract ok: ${buttonTags.length} buttons, ${declaredActions.length} actions`);
