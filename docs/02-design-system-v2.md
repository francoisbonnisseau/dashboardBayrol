# PRD — Phase 2: Design System V2

## Objective

Create a professional, restrained and reusable dashboard design system on top of the existing Tailwind + shadcn/Radix stack.

The goal is not to create a new visual brand from scratch.

The goal is to stop feature screens from inventing their own layout, spacing, status colors, toolbars, cards and loading states.

## Design references

Use these products as directional references:

- Linear: hierarchy, restrained surfaces, typography, spacing
- Supabase Studio: dense operational tools, data tables, editors, side panels
- Vercel Dashboard: application shell, navigation clarity, low visual noise

Do not reproduce their branding.

The resulting Bayrol UI should feel like a focused internal product tool rather than a generic SaaS template.

---

## Core principle

### Content is the surface

Do not place every section inside a card.

Preferred composition:

```text
Page
  Page header
  Toolbar / filters
  Divider
  Main content
  Contextual side panel or secondary section
```

Avoid:

```text
Card
  Card
    Card
      Card
```

### Hard rule

Do not nest generic `Card` components inside other generic `Card` components.

Exceptions must represent genuinely independent objects and should be rare.

---

## Scope

### In scope

- Update global visual tokens.
- Standardize page width and page padding.
- Standardize page headers.
- Standardize tabs and toolbars.
- Create dashboard-level reusable components.
- Standardize data-table surfaces.
- Standardize metrics.
- Standardize status badges.
- Standardize empty/error/loading states.
- Standardize detail panels/drawers.
- Standardize editor and split-pane surfaces.
- Simplify global application shell.
- Remove unnecessary decorative shadows/background circles.
- Establish explicit UI rules in `DESIGN.md`.

### Out of scope

- Migrating every feature page completely.
- Changing feature business behavior.
- Backend changes.
- Analytics aggregation.
- Rebuilding all existing shadcn primitives.
- Adding a large new UI framework.
- Adding decorative motion.

---

## Visual direction

## 1. Color

Use a nearly monochrome base.

Suggested semantic model:

```text
background
surface
surface-subtle
border
foreground
muted-foreground

primary
success
warning
danger
info
```

Primary accent should be used for:

- selected state
- primary call to action
- focused/high-value interactive state

Do not use accent colors to decorate arbitrary cards.

Status colors should communicate state only.

Examples:

- green → success / resolved / positive
- red → error / destructive / negative
- amber → warning
- blue → active/info when appropriate

---

## 2. Typography

Recommended scale:

```text
Page title       20–24px / semibold
Section title    14–16px / semibold
Body             13–14px
Control label    12–13px / medium
Metadata         12px / muted
Code/editor      12–13px / mono
```

Avoid oversized dashboard headings.

Prefer hierarchy through weight and spacing rather than large font-size jumps.

---

## 3. Radius

Use restrained radius values.

Recommended:

```text
inputs/buttons: 6–8px
panels:         8–10px
dialogs:        10–12px
```

Avoid repeated `rounded-2xl` / `rounded-[24px]` product surfaces unless justified.

---

## 4. Shadows

Use almost none.

Default hierarchy should be:

- background difference
- thin border
- spacing
- typography

Use shadows mainly for floating elements:

- popovers
- dialogs
- menus
- command palettes

Do not use shadows as the default container treatment.

---

## 5. Spacing

The shell owns main page padding.

Feature pages must not add a second full page `px-6` if `PageShell` already provides it.

Define spacing tokens/patterns rather than custom spacing on every page.

Recommended vertical rhythm:

```text
page header → 20–24px
major section → 24px
toolbar → 12–16px
field group → 8–12px
```

---

## Design-system components

Create:

```text
src/components/dashboard/
  PageShell.tsx
  PageHeader.tsx
  PageTabs.tsx
  Toolbar.tsx
  FilterBar.tsx
  DataTableShell.tsx
  PaginationBar.tsx
  Metric.tsx
  MetricGrid.tsx
  StatusBadge.tsx
  EmptyState.tsx
  ErrorState.tsx
  LoadingState.tsx
  DetailPanel.tsx
  SplitPane.tsx
  EditorSurface.tsx
  Section.tsx
```

Names may be adjusted if equivalent reusable components already exist.

Do not create components that only wrap one `div` without enforcing a meaningful design rule.

---

## Component requirements

## PageShell

Responsible for:

- standard page width
- horizontal padding
- vertical spacing
- responsive behavior

Feature pages should generally start with:

```tsx
<PageShell>
  ...
</PageShell>
```

No duplicated outer padding.

---

## PageHeader

Supports:

```ts
title
description?
actions?
eyebrow?
```

Example:

```tsx
<PageHeader
  title="Prompts"
  description="Manage testing and live prompts"
  actions={<BotSelector />}
/>
```

Keep compact.

---

## PageTabs

Used for high-level page states:

- Testing / Live / History
- Single / Compare
- other feature-level modes

Tabs should be visually integrated into the page, not placed inside a card.

---

## Toolbar / FilterBar

One consistent height and control rhythm.

Supports:

- bot selector
- date filters
- status filters
- search
- refresh
- export
- reset filters

The toolbar may wrap on small screens, but desktop layout should remain compact.

Do not put a generic Card around the toolbar.

Use borders/dividers if separation is needed.

---

## DataTableShell

The table itself is the primary surface.

Recommended structure:

```text
toolbar
────────────
table header
rows
────────────
pagination
```

Requirements:

- optional sticky header
- subtle row hover
- selected state
- loading overlay or skeleton
- empty state
- pagination
- compact density
- no enclosing decorative card required

---

## Metric / MetricGrid

Replace ad-hoc analytics cards.

Example:

```tsx
<Metric
  label="Conversations"
  value="1,428"
  helper="+12% vs previous period"
/>
```

Metrics should generally use:

- label
- value
- optional helper/trend
- optional compact icon

Avoid:

- colored blobs
- arbitrary gradient backgrounds
- oversized icons
- decorative circles

A metric grid can be visually separated by borders rather than individual cards.

Example:

```text
Conversations | Users | Resolution | AI Cost
---------------------------------------------
1,428         | 981   | 82%        | $12.43
```

---

## StatusBadge

Centralize variants.

Suggested variants:

```text
neutral
primary
success
warning
danger
info
```

Feature-level labels map onto these variants.

Examples:

```text
Live          → primary
Testing       → info
Legacy        → neutral
Resolved      → success
Unresolved    → warning or neutral
Negative      → danger
Positive      → success
```

Feature components should not hardcode raw green/red/blue Tailwind class strings.

---

## EmptyState

Supports:

```ts
title
description?
icon?
action?
```

Keep it small and contextual.

Do not put an empty state inside multiple nested containers.

---

## ErrorState

Support inline page-section errors.

Distinguish:

- fatal page load error
- local action error
- field validation

Prefer local errors to global page failures.

---

## LoadingState

Create variants:

```text
page
table
panel
inline
```

Prefer skeletons for known content structures.

Use spinners for actions or unknown duration tasks.

---

## DetailPanel

Standardize side-panel behavior used by:

- conversation detail
- feedback detail
- future contextual inspectors

Desktop:

- slide-over panel or split workspace

Mobile:

- full-width sheet

The main list should remain visible where space allows.

---

## SplitPane

Required for:

- Prompt compare
- Model compare
- other side-by-side editor/result workflows

Requirements:

- equal columns by default
- clear vertical divider
- responsive stacking
- optional panel headers
- independent scroll areas if needed

---

## EditorSurface

Used for prompt editing and other text/code editing.

The editor itself should be a first-class surface.

It may have:

- line numbers
- monospace type
- border
- optional header/footer

It should not require a Card wrapper.

---

## Application shell

Update `src/components/Layout.tsx` and sidebar composition.

Goals:

- sidebar remains restrained
- one global page header area
- no unnecessary nested containers
- main content uses full useful width
- consistent page title behavior
- no page-level fade animation that delays perceived responsiveness

Review the current:

```text
container mx-auto p-6 max-w-7xl
```

A fixed `max-w-7xl` may be too restrictive for:

- model comparisons
- prompt comparison
- large tables
- analytics

Use page-specific width modes if necessary:

```ts
width="default"
width="wide"
width="full"
```

---

## CSS cleanup

Review `src/index.css`.

Remove or reduce:

- duplicated root definitions
- legacy custom styles that are no longer used
- hardcoded light-only backgrounds
- global fixes that override component behavior with `!important`
- inconsistent custom scrollbar styling if it clashes with the target UI

Preserve any styles still required by conversation rendering.

---

## DESIGN.md rewrite

Replace the current high-level document with explicit rules.

Required sections:

```text
Design principles
Color tokens
Typography
Spacing
Radius
Borders and shadows
Page composition
Card usage
Tables
Forms
Toolbars
Tabs
Editors
Panels
Status colors
Loading/error/empty states
Responsive behavior
Examples
Anti-patterns
```

Include explicit anti-pattern:

```text
Never use Card solely to create spacing or grouping.
Never nest generic Card components.
```

---

## Phase 2 migration scope

Do not migrate every feature screen yet.

Phase 2 should modify:

1. App shell.
2. Global tokens/styles.
3. Shared dashboard components.
4. One or two lightweight examples where needed to validate the system.

Recommended validation target:

- global Layout
- a simple existing table or non-critical page section

Do not fully redesign Prompts or Models in Phase 2; Phase 3 handles that.

---

## Suggested files

New:

```text
src/components/dashboard/*
```

Modified:

```text
src/index.css
src/App.css
src/components/Layout.tsx
src/components/Sidebar.tsx
DESIGN.md
```

Potentially modified:

```text
src/components/ui/*
```

Only change primitive components when a global primitive behavior truly needs changing.

---

## Acceptance criteria

### Visual

- Main application shell is visually coherent.
- No nested generic cards in new V2 components.
- Page padding is controlled in one place.
- Typography follows the defined scale.
- Primary color is not used decoratively.
- Shadows are limited to floating surfaces.
- Status colors are centralized.
- Wide workspace screens can use more horizontal space.

### Component API

The same `PageHeader`, `Toolbar`, `StatusBadge`, `EmptyState`, `LoadingState` and `SplitPane` components can be reused by multiple features.

### Responsive

Verify:

- desktop
- medium laptop
- tablet-width
- mobile

Wide comparison screens must stack cleanly on narrow screens.

### Technical

```bash
pnpm build
pnpm lint
```

must pass or introduce no new baseline errors.

---

## Non-goals / guardrails

Do not:

- rewrite feature business logic
- create a large theme engine
- add Framer Motion solely for decoration
- replace every shadcn component
- put every UI pattern into a generic abstraction
- turn the design system into a component library project disconnected from actual dashboard needs

---

## Definition of done

Phase 2 is complete when the app has a clear, documented visual system and reusable dashboard components that make it difficult for later feature migrations to fall back into nested-card UI.
