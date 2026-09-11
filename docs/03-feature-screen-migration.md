# PRD — Phase 3: Feature Screen Migration

## Objective

Migrate existing dashboard screens to the Design System V2 created in Phase 2.

The primary UX goal is to make the dashboard feel like a cohesive operational application instead of a collection of independently designed screens.

The primary implementation goal is to reuse existing business logic while replacing page-level presentation structure.

---

## Prerequisites

Phase 1 must be complete:

- lazy-loaded views
- React Query/server-state architecture
- shared query patterns

Phase 2 must be complete:

- `PageShell`
- `PageHeader`
- `PageTabs`
- `Toolbar` / `FilterBar`
- `DataTableShell`
- `Metric`
- `StatusBadge`
- loading/error/empty states
- `DetailPanel`
- `SplitPane`
- `EditorSurface`

Do not compensate for missing Phase 2 components with new one-off card layouts.

---

## Migration order

Use this order:

1. Sentiment
2. Analytics
3. Prompts
4. Model Testing
5. Feedbacks
6. Learnings
7. Intro
8. Code Text
9. AI Analysis
10. Settings

Commit/refactor each screen as independently as practical.

Do not rewrite all screens in one massive component diff.

---

# 1. Sentiment

## Goal

Use Sentiment as the canonical data-table screen.

## Target layout

```text
Sentiment                                     [Bot: FR]

Review conversation sentiment and resolution

Sentiment ▾    Date range        Status ▾       Reset      Refresh
──────────────────────────────────────────────────────────────────
Date          Topics             Status       Sentiment      ID
...
──────────────────────────────────────────────────────────────────
Previous                     Page 1                       Next
```

## Changes

Replace:

- filter card
- separate table card/container
- duplicated page padding
- ad-hoc status colors

With:

- `PageShell`
- `PageHeader`
- `FilterBar`
- `DataTableShell`
- `StatusBadge`
- `PaginationBar`
- `DetailPanel`

## Loading

Initial table load:

- skeleton rows

Background refetch:

- keep current rows visible
- subtle refresh indicator

## Conversation detail

Use the standardized `DetailPanel`.

---

# 2. Analytics

## Goal

Create a clean analytical overview without decorative KPI cards.

## Target structure

```text
Analytics                                     [Bot: FR]

Date range                                     Update

Conversations      Users      Resolution      AI Cost
1,428              981        82%             $12.43
──────────────────────────────────────────────────────

Activity
[chart]

──────────────────────────────────────────────────────

Sentiment                               Resolution
[chart]                                  [chart]
```

## Metrics

Replace individual decorated cards with:

- `MetricGrid`
- separators
- compact values
- no decorative colored circles/background blobs

## Charts

Charts should live in simple sections.

Use:

- section title
- optional description
- chart

Do not wrap every chart in nested cards.

## Current Phase 3 limitation

Keep the Phase 1 frontend aggregation implementation.

Phase 4 will replace the expensive backend/data path.

---

# 3. Prompts

## Goal

This is one of the most important UX redesigns.

Turn Prompt Management into an editor workspace.

Do not present Testing, Live and Legacy as layers of cards.

## Target desktop structure

```text
Prompts                                          [Bot: FR]

Testing        Live        History
─────────────────────────────────────────────────────────────────

Test prompt                                 Modified 2 hours ago
Customer Support FR                         ● Unsaved

Prompt
─────────────────────────────────────────────────────────────────
 1  You are the BAYROL assistant...
 2
 3  ## Instructions
 4  ...
 5
─────────────────────────────────────────────────────────────────

Preview        Compare                       Save draft   Push live
```

## Tabs

Use `PageTabs` for:

- Testing
- Live
- History

Do not wrap tabs in a card.

## Testing mode

Primary object:

- editable label
- `EditorSurface`
- metadata
- actions

Actions:

- Preview
- Compare
- Save draft
- Push live

Keep destructive/publishing confirmation dialog where appropriate.

## Live mode

Read-only editor/content surface.

Show:

- label
- deploy date
- version status
- prompt content

Primary action can be:

- compare to testing

Do not place read-only content inside large rounded cards.

## History mode

Prefer a compact list/table:

```text
Version      Label              Deployed        Action
Legacy       Support v12        02 Sep 2026     View
...
```

Selecting a version should open:

- contextual panel
- or replace the main editor surface

Avoid card-per-version history.

## Preview

Preferred:

- right-side panel on wide desktop
- full-width detail panel on narrow screens

Preview is secondary to the editor.

## Compare

Preferred desktop:

```text
Live                                  Testing
────────────────────────┬──────────────────────────────
line 1                   │ line 1
line 2 removed           │ line 2 changed
...                      │ ...
```

Use `SplitPane`.

The comparison itself may have line-level diff highlighting.

Do not open compare inside a nested card stack.

## Prompt-specific statuses

Use centralized variants:

- Live
- Testing
- Legacy
- Unsaved

---

# 4. Model Testing

## Goal

Turn Model Testing into a playground/workbench.

This screen should feel closer to an AI testing console than a dashboard of cards.

## Single mode

Target:

```text
Model Testing                                      [Bot: FR]

Single       Compare

Prompt
──────────────────────────────────────────────────────────
How should I treat cloudy pool water?
──────────────────────────────────────────────────────────

Model: GPT-... ▾     Thinking: Medium ▾              Run

Response
──────────────────────────────────────────────────────────
...
──────────────────────────────────────────────────────────
1.2 s          1,840 tokens          $0.0042
```

## Compare mode

Target:

```text
Model Testing

Prompt
──────────────────────────────────────────────────────────
...
──────────────────────────────────────────────────────────

Model A                                  Model B
GPT-... ▾                                GPT-... ▾
Thinking ...                             Thinking ...
──────────────────────────────┬────────────────────────────
Response A                    │ Response B
                              │
...                           │ ...
──────────────────────────────┼────────────────────────────
1.2 s · $0.004                │ 2.8 s · $0.012
```

Use `SplitPane`.

## Settings

Secondary advanced settings should not permanently consume the main canvas.

Preferred patterns:

- compact toolbar controls
- popover
- side settings panel
- collapsible advanced section

Avoid a Card per setting group.

## Result metadata

Standardize:

- latency
- tokens
- cost
- model
- thinking/reasoning configuration

Use compact metadata rows.

## Preserve logic

Do not rewrite model-execution logic unless required by the presentation refactor.

`ModelTesting.tsx` is large and should be decomposed carefully into feature subcomponents during migration.

Recommended structure:

```text
src/features/model-testing/
  ModelTestingPage.tsx
  TestComposer.tsx
  ModelSelector.tsx
  TestSettingsPanel.tsx
  ResponsePanel.tsx
  ComparisonWorkspace.tsx
  ResponseMetrics.tsx
```

Avoid premature generic abstractions for logic unique to model testing.

---

# 5. Feedbacks

## Goal

Reuse the Sentiment list pattern.

Target:

```text
Feedbacks

Bot ▾       Reaction ▾       Date range       Refresh
──────────────────────────────────────────────────────
Date       Reaction       Message       Comment
...
──────────────────────────────────────────────────────
pagination
```

Click opens standardized detail panel.

Remove redundant visual logic that differs from Sentiment without reason.

---

# 6. Learnings

## Goal

Make CRUD management faster and denser.

Target structure:

```text
Learnings                                      Add learning

Bot ▾      Search
────────────────────────────────────────────────────────
Question                 Tags          Updated      ...
...
```

Add/edit can use:

- dialog for simple form
- side panel if form complexity grows

Do not make every learning a card.

---

# 7. Intro

Use the same CRUD table system as Learnings.

Avoid custom page layout unless the underlying data genuinely requires it.

---

# 8. Code Text

Use the same management pattern.

If content is long:

- compact table/list for selection
- editor/detail panel for content

Do not render large code/text blobs directly inside many cards.

---

# 9. AI Analysis

## Goal

Separate:

- input selection/configuration
- execution status
- results

If the screen runs analysis across multiple conversations, make the action flow explicit.

Recommended structure:

```text
AI Analysis

Filters / selection
────────────────────────
selected conversations...

Run analysis

Results
────────────────────────
...
```

Avoid hiding the primary workflow among multiple equally weighted cards.

---

# 10. Settings

## Goal

Use a Linear-style settings hierarchy.

Recommended:

```text
Settings

General
────────────────────────────────────────
Workspace ID         ...

Bots
────────────────────────────────────────
FR                   ...
DE                   ...
ES                   ...

Security
────────────────────────────────────────
...
```

Settings sections may use simple bordered rows.

Do not use a large card for every settings category.

---

## Feature file organization

As screens are migrated, split oversized components into feature folders.

Recommended:

```text
src/features/
  sentiment/
  analytics/
  prompts/
  model-testing/
  feedbacks/
  knowledge/
  analysis/
  settings/
```

Example:

```text
src/features/prompts/
  PromptManagementPage.tsx
  PromptEditor.tsx
  PromptHistory.tsx
  PromptCompare.tsx
  PromptPreview.tsx
```

Do not move files solely for aesthetics; move when it improves ownership and decomposition.

---

## Shared interaction rules

### Refresh

- background refresh should keep existing content visible

### Mutations

- disable affected controls
- show progress locally
- show toast after success/failure
- update/invalidate cache

### Destructive actions

Require explicit confirmation.

### Publishing/promoting prompts

Require explicit confirmation.

### Tables

- row hover
- clear clickable affordance
- no excessive row height
- optional sticky header
- pagination footer integrated with the table surface

### Empty states

Explain what is empty and provide the relevant action if one exists.

---

## Accessibility

For all migrated screens:

- controls must have labels
- icon-only buttons need accessible names/tooltips
- keyboard focus must be visible
- tab navigation must work
- dialogs/panels must trap focus correctly through Radix primitives
- status must not rely only on color

---

## Responsive behavior

### Desktop

Use available width.

Prompts and Model Testing should support wide workspaces.

### Tablet

Toolbars may wrap.

Split panes may remain side-by-side if practical.

### Mobile

- split panes stack
- sidebar uses existing mobile behavior
- detail panel becomes full-width
- data tables may horizontally scroll where unavoidable

Do not attempt to force every dense table into card-based mobile tiles.

---

## Acceptance criteria

### Consistency

All migrated screens use the V2 page primitives.

No migrated screen should reintroduce:

- nested generic cards
- arbitrary page padding
- feature-specific raw status colors when a semantic token exists

### Prompts

- Testing / Live / History are easy to distinguish.
- Main prompt editor dominates the workspace.
- Compare is genuinely side-by-side on desktop.
- Preview is secondary/contextual.
- Save/publish actions are obvious.

### Models

- Single test is easy to run.
- Compare is clearly side-by-side.
- Response metadata is easy to scan.
- Settings do not overwhelm the main workspace.

### Sentiment / Feedbacks

- compact table workflow
- consistent filters
- consistent detail panel
- pagination visible and predictable

### Analytics

- no decorative KPI-card grid
- visual hierarchy is created through metrics, sections and charts

### Technical

```bash
pnpm build
pnpm lint
```

must pass or introduce no new baseline errors.

Regression-test existing workflows after each screen migration.

---

## Guardrails

Do not:

- change API schemas
- combine Phase 4 analytics backend changes into this phase
- change prompt publishing semantics
- change model testing behavior
- replace working query hooks with feature-local fetches
- add new cards just because a section needs padding
- add decorative animation

---

## Definition of done

Phase 3 is complete when all main feature screens follow one clear design language, Prompts and Model Testing operate as workspace-style tools, and the dashboard no longer feels like a collection of nested cards.
