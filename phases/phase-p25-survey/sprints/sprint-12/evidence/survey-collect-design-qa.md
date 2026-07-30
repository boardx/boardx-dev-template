# Survey Collect Design QA

## Comparison

- Reference: `phases/phase-p25-survey/ui-preview/collect-simplified-selected.png`
- Implementation: `phases/phase-p25-survey/sprints/sprint-12/evidence/survey-collect-simplified-desktop.png`
- Combined comparison: `phases/phase-p25-survey/sprints/sprint-12/evidence/survey-collect-design-comparison.png`
- Mobile capture: `phases/phase-p25-survey/sprints/sprint-12/evidence/survey-collect-simplified-mobile.png`
- Viewport: `1487x1058` for the desktop reference and implementation.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: the implemented status band omits the decorative circular send icon from
  the concept image. This keeps the production workspace simpler without
  changing hierarchy or task completion.
- P3: the implementation uses the existing BoardX shell navigation and type
  scale, so some shell labels and spacing differ slightly from the generated
  concept.

## Interaction Verification

- Collection status uses an accessible switch with pending and disabled states.
- Immediate start and long-term availability disable their associated inputs.
- Invalid time ordering produces an inline error and disables save.
- The respondent link is disabled while collection is paused.
- Advanced settings are collapsed by default and preserve existing fields.
- The mobile workspace has no horizontal overflow.

final result: passed
