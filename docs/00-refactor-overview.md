# Dashboard Bayrol V2 — Refactor Overview

## Goal

Refactor `dashboardBayrol` in four sequential phases to improve:

1. Runtime performance and perceived responsiveness.
2. UI/UX consistency and maintainability.
3. Screen-level usability across the main dashboard workflows.
4. Analytics loading architecture so large date ranges no longer require the browser to download and aggregate the full Botpress dataset.

The refactor must preserve existing business behavior unless a phase explicitly says otherwise.

## Current architecture

The application is a React 19 + TypeScript + Vite application using:

- Tailwind CSS 4
- shadcn/Radix primitives
- Botpress Client
- Supabase Edge Functions for secure configuration/authentication
- Recharts
- Local React state and `useEffect`-driven data loading

Main issues observed in the current codebase:

- All main views are statically imported from `src/App.tsx`.
- Large screens such as `ModelTesting.tsx` are included in the initial application dependency graph.
- Data fetching is implemented independently inside each page.
- There is no shared query cache.
- Several screens request up to 1,000 Botpress table rows at once.
- `Analytics.tsx` sequentially fetches all pages for the selected period before computing metrics in the browser.
- UI composition is inconsistent.
- Many screens rely heavily on nested cards instead of clear page hierarchy, toolbars, dividers, tables, editors and split panes.
- Visual decisions are frequently implemented directly in feature components.

## Refactor sequence

### Phase 1 — Performance architecture

Introduce:

- route/view-level lazy loading
- TanStack Query
- a shared Botpress data/query layer
- consistent caching and invalidation
- smaller paginated list queries where appropriate
- improved loading states without changing the overall UI design yet

Primary output:

- faster initial load
- fewer repeated API requests
- reusable data hooks
- no regressions in existing workflows

See: `01-performance-architecture.md`

---

### Phase 2 — Design System V2

Create a dashboard-specific design system on top of the existing shadcn primitives.

Introduce:

- layout rules
- standardized page structure
- design tokens
- reusable dashboard components
- card-usage rules
- common loading/error/empty states
- consistent toolbars, tabs and data surfaces

This phase should update the global shell and build the component foundation, but should not attempt a complete rewrite of every feature screen.

See: `02-design-system-v2.md`

---

### Phase 3 — Feature screen migration

Migrate the existing feature screens to the V2 design system.

Recommended order:

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

Special attention must be given to Prompts and Model Testing: they should become workspace-style tools rather than collections of nested cards.

See: `03-feature-screen-migration.md`

---

### Phase 4 — Analytics backend aggregation

Move expensive analytics aggregation away from the browser.

Introduce a backend analytics endpoint or cache layer using the existing Supabase Edge Function infrastructure.

Target flow:

```text
Botpress
   ↓
aggregation / short-lived cache
   ↓
Supabase Edge Function
   ↓
Dashboard
```

The frontend should receive aggregated data instead of downloading thousands of conversation-analysis rows when the user only needs summary metrics and chart data.

See: `04-analytics-backend-aggregation.md`

---

## Global principles

### Preserve behavior first

Do not combine unrelated product changes with infrastructure refactors.

### Progressive migration

The application must remain usable after every phase.

### No big-bang rewrite

Reuse working logic and gradually move it behind better interfaces.

### Keep Botpress semantics isolated

Feature components should not need to know the low-level details of Botpress pagination, filtering or table response shapes.

### UI should be content-first

Avoid creating a visual hierarchy through nested containers.

Preferred hierarchy:

```text
Page
  Header
  Toolbar / filters
  Divider
  Main content
  Secondary panel / metadata
```

Avoid:

```text
Page
  Card
    Card
      Card
        Content
```

### Performance measurement

Each phase should be verified with objective signals where possible:

- Vite production build
- generated chunk sizes
- number of requests during common navigation
- time to usable content
- React Query cache reuse
- Botpress request count for representative workflows

## Global verification

For every phase:

```bash
pnpm install
pnpm build
pnpm lint
```

Also run the existing test suite used by the repository.

Any new pure helper logic should have focused unit tests.
