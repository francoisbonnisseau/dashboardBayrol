# Design System V2

## Design principles

Bayrol teams use this internal tool at a desk during daily bot operations. Keep the existing light default, support the existing `.dark` tokens, and use restrained neutrals. Hierarchy comes from content, type, whitespace and thin dividers. Primary color marks actions and selection; semantic colors communicate state.

Phase 2 changes the shell and reusable foundations only. Preserve lazy feature imports, QueryClientProvider, scoped query keys, cached/placeholder data, cancellation and mutation invalidation. Components in `src/components/dashboard` are presentation components and never fetch data.

## Color tokens

Use Tailwind semantic utilities backed by the `@theme inline` mapping in `src/index.css`:

| Role | Token |
| --- | --- |
| Canvas / text | `background`, `foreground` |
| Work surface / subtle surface | `surface`, `surface-subtle` |
| Dividers / controls | `border`, `input`, `ring` |
| Secondary copy | `muted-foreground` |
| Main action / selected state | `primary`, `primary-foreground` |
| State | `success`, `warning`, `danger`, `info` |
| Floating content | `popover`, `popover-foreground` |

Light and dark semantic colors are defined centrally. Status tint backgrounds are derived from the status token and surface. Never use raw green/red/blue classes for new feature status treatments. Conversation message styling remains supported. Chart colors are reserved for data series.

## Typography

System sans; mono for code. Page titles: 24px semibold. Section titles: 14–16px semibold. Body: 13–14px. Control labels: 12–13px medium. Metadata: 12px muted. Editors: 13px mono, 1.6 line height. Use tabular numerals for metrics. Explanatory prose stays under 70 characters per line where possible.

## Spacing

`--space-page`: 24px desktop, 16px mobile. `--space-section`: 24px. `--space-toolbar`: 12px. Field groups: 8–12px. Header-to-content: 24px. Layout owns exactly one PageShell; feature pages start with PageHeader or a fragment, never another padded PageShell. Standalone contexts may own their own PageShell.

## Radius

Controls: 6px (`rounded-md`). Panels/editors: 8px (`rounded-lg`). Dialogs: 12px (`rounded-xl`). No repeated 24px corners or pill-shaped containers.

## Borders and shadows

Use 1px semantic borders and subtle surface differences. New tables, editors, sections, toolbars and metrics have no shadows. Shadows belong to floating menus, popovers and dialogs. Existing feature card treatments remain migration debt.

## Page composition

Layout supplies navigation context, a skip link, main landmark and PageShell. Its navigation label is not a second h1. PageHeader owns the feature h1 and optional description, eyebrow and actions. Keep a single feature heading.

PageShell widths: default 90rem, wide 110rem, full unrestricted. All remain fluid. The shell uses full for Prompts/Models and wide for other current views. Existing feature-local constraints are retained until Phase 3.

## Card usage

Never use Card solely to create spacing or grouping.
Never nest generic Card components.

Use Section for a titled division, Toolbar for controls, DataTableShell for rows, EditorSurface for editing, SplitPane for comparisons and DetailPanel for inspection. A card is reserved for a genuinely independent object, not a default layout wrapper.

## Tables

DataTableShell owns toolbar → divider → table → pagination. Pass an actual semantic table (native or existing shadcn Table), including accessible headers and a caption where needed. Rows are compact with 8px vertical cell padding; hover is subtle. Selection uses `data-state="selected"` or `aria-selected="true"`; provide actual selection controls when needed.

`stickyHeader` constrains the scroll area to 65dvh. It supports the existing shadcn table container. Horizontal overflow belongs to the table, not the page. PaginationBar accepts explicit availability flags and caller-provided summary, so both known totals and cursor/unknown totals work without inventing counts.

Use `loading` only without usable data. During a background refetch use `refreshing`, retain cached rows, and disable conflicting actions only where required. Pass local ErrorState/EmptyState content. An error takes precedence over the table when supplied; keep stale rows and place local action errors outside the table if the data is still useful.

## Forms

Reuse Button, Input, Textarea, Select and Label. Keep explicit labels, help text and native disabled behavior. Required/invalid state must be textual, not color only. Associate ErrorState variant="field" through an id and aria-describedby; set aria-invalid on the input. Toolbar controls are at least 32px high. Do not override primitive colors globally.

## Toolbars

Toolbar provides wrapping controls and trailing actions, 12px rhythm and a bottom divider. It is an accessible group, not an ARIA toolbar requiring custom arrow-key behavior. FilterBar adds an optional reset action with an explicit disabled state. No Card wrapper.

## Tabs

PageTabs, PageTabList, PageTab and PageTabPanel retain Radix state, keyboard navigation and tab-panel associations. Give PageTabList an aria-label. Use matching value props; inactive panels follow Radix mounting semantics. Tabs are underline-based, scroll horizontally when needed, and sit directly in page flow.

## Editors

EditorSurface supplies title/actions, a mono content area and optional footer. The caller owns editor state and provides a labeled textarea/editor. No surrounding Card. Editors resize vertically; the surface never initiates reads or writes.

## Panels

DetailPanel uses the existing Radix Sheet for focus trapping, Escape, close control and focus return. It is full width on mobile and up to 36rem on desktop, leaving the underlying list visible where space permits. Content scrolls independently and the footer stays available. It is a modal inspector, not a persistent workspace; use SplitPane for simultaneous interaction.

SplitPane uses equal columns from 1024px, a 1px divider and optional panel headers. Below that it stacks. `independentScroll` limits each desktop body to 65dvh; mobile reverts to natural document flow.

## Status colors

StatusBadge variants: neutral, primary, success, warning, danger, info. Labels always accompany color. Live → primary; Testing → info; Legacy → neutral; Resolved/Positive → success; Unresolved → warning or neutral; Negative/Error → danger. Choose based on business meaning, not decoration. Badges are not live regions by default.

## Loading/error/empty states

LoadingState: page/table/panel use stable skeletons; inline uses a reduced-motion-aware spinner for actions. Each announces a text label once and hides skeletons from assistive technology. Suspense uses the page variant without changing lazy imports.

ErrorState: page for fatal load failure, section for local failure, field for validation. Retry remains caller-controlled; `retrying` prevents duplicate retries. Use safe user-facing messages, not raw error objects or credentials.

EmptyState: short title, contextual description, optional icon and useful action. No decorative containers. Configuration-required content demonstrates this pattern in App.

## Responsive behavior

Mobile below 640px: 16px shell padding, wrapping actions, full-width detail sheet. Sidebar retains its existing mobile sheet behavior. Tablet: tables scroll locally; comparisons stack. Desktop from 1024px: split panes and full metric column counts. Metric grids use two columns on smaller screens. Test 390, 768, 1280 and 1600px widths, long labels and keyboard navigation. Do not add entrance animations.

## Examples

Inside Layout (PageShell already supplied):

```tsx
<>
  <PageHeader title="Entries" actions={<Button>Add entry</Button>} />
  <DataTableShell
    label="Entries"
    toolbar={<FilterBar onReset={resetFilters}>{filters}</FilterBar>}
    loading={query.isPending}
    refreshing={query.isFetching && !query.isPending}
    empty={rows.length === 0}
    emptyState={<EmptyState title="No matching entries" action={<Button onClick={resetFilters}>Reset filters</Button>} />}
    pagination={<PaginationBar summary={summary} hasPrevious={hasPrevious} hasNext={hasNext} onPrevious={previous} onNext={next} />}
  >
    {table}
  </DataTableShell>
</>
```

```tsx
<PageTabs defaultValue="testing">
  <PageTabList aria-label="Prompt environment">
    <PageTab value="testing">Testing</PageTab>
    <PageTab value="live">Live</PageTab>
  </PageTabList>
  <PageTabPanel value="testing">{testingContent}</PageTabPanel>
  <PageTabPanel value="live">{liveContent}</PageTabPanel>
</PageTabs>
```

```tsx
<SplitPane
  leftHeader="Current"
  rightHeader="Candidate"
  left={<EditorSurface title="Current prompt">{currentEditor}</EditorSurface>}
  right={<EditorSurface title="Candidate prompt">{candidateEditor}</EditorSurface>}
/>
```

## Anti-patterns

No nested generic Cards, decorative metric circles, gradient panels, oversized headings, page fades, duplicated outer padding, light-only global overrides or !important patches. No new fetch effects inside presentation components. Do not replace usable cached data with full-page skeletons during refetches.

## Phase 3 migration debt

Legacy feature headers, full-page padding, hardcoded status colors, card/shadow compositions and local loading/error states remain in existing screens. Migrate them progressively using these foundations. Prompts and Model Testing need dedicated workspace migrations; analytics aggregation remains Phase 4. Existing lint baseline issues are outside Phase 2.
