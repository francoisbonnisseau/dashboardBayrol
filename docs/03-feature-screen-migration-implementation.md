# Phase 3 implementation

All ten PRD screens now use the V2 presentation system. The existing Layout owns
PageShell, so features start with PageHeader rather than nesting a second shell.

## Screen coverage

- Sentiment and Feedbacks use FilterBar, DataTableShell, PaginationBar, semantic
  StatusBadge variants, skeleton initial loads and retained rows during refresh.
  Both conversation inspectors use DetailPanel. Feedback comments are visible in
  the table as well as the inspector.
- Analytics uses MetricGrid and simple chart sections. Existing metrics and
  frontend aggregation remain; no Phase 4 endpoint or data changes were made.
- Prompts has Testing, Live and History tabs, an EditorSurface-based editor,
  contextual preview, and inline SplitPane comparison with positional line
  highlighting. History is a compact table with the selected version below it.
  Publishing still archives the old live row and promotes the saved testing row.
  Unsaved changes must be saved before the publishing confirmation is enabled.
- Model Testing has Single / Compare tabs, a compact composer, model selectors,
  secondary settings dialog, SplitPane results and compact time/token/cost/model
  metadata. Active reasoning and temperature remain visible in the toolbar.
  Response rendering, tool traces, response metadata and composition are extracted
  under `src/features/model-testing`. Execution, saved-mode history and publishing
  payloads are preserved.
- Learnings, Intro and Code Text share compact searchable table management.
  CRUD confirmations and Intro publication semantics remain. Code Text opens long
  content in a DetailPanel with an EditorSurface. Searches filter the complete
  cached dataset and do not narrow Intro's publication selection.
- AI Analysis separates selection, instructions, execution status and results.
  Its selection preview shows the first 20 selected conversations and explicitly
  states the total; execution continues to use the complete selection.
- Settings uses sections and bordered rows. Synchronization retains its existing
  iframe request mechanism; the UI says “Sync requested” rather than claiming
  backend completion.

## Shared foundation additions

EditorSurface supports a compact size for the model composer. DetailPanel restores
focus to its invoking control when closed. DatePicker provides explicit date and
clear-button accessible names and uses the existing semantic popover colors.

## Verification

- All 42 Node tests pass: existing regressions plus prompt
  promotion/draft/history and prompt comparison tests.
- `pnpm build` passes. Feature chunks remain split (Model Testing approximately
  84 kB and Analytics 406 kB before gzip).
- `pnpm lint` reports the unchanged baseline of 13 errors and 12 warnings.
- Isolated, fixture-backed browser checks: Sentiment and Feedback detail panels;
  prompt unsaved/save/preview/history/compare; model Single and Compare runs;
  knowledge search/reset/edit; Code Text long-content panel; AI Analysis selection
  and instruction steps; Analytics metrics/charts; Settings sections.
- Responsive checks at 390, 768, 1280 and 1600 pixels, including stacked comparison
  panes, full-width mobile preview, focus trapping and return focus.
- Authenticated production workflows were not exercised: the existing local app
  required sign-in. Browser checks used temporary isolated fixtures; no production
  publish, deletion, model execution or synchronization was performed.

## PRD interpretations and limits

- Reused the shell already supplied by Phase 2 instead of adding PageShell to
  every feature.
- Retained all existing analytics metrics and arranged charts in responsive
  sections; did not replace the frontend aggregation path.
- Retained the existing model settings dialog, a permitted secondary-settings
  pattern, instead of adding another settings panel.
- Kept feature entry files in `src/components`; moved presentation code only where
  it improved decomposition. No changes to lazy view imports or query hooks.
- Full lint has the same recorded Phase 2 baseline: 13 errors and 12 warnings.
  Unrelated baseline errors were not folded into this phase.
