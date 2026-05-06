# Prompts Tab Redesign Design

Date: 2026-05-06
Status: Approved in conversation, pending written spec review

## Goal

Rebuild the `prompts` tab UI so it matches the attached reference much more closely than the current prompt studio, while preserving the core prompt-management workflow:

- edit only the testing prompt
- inspect the live prompt in read-only mode
- browse legacy prompts
- compare testing against live in a controlled secondary view
- promote testing to live through an explicit confirmation step

## Scope

In scope:

- redesign the content area of the `prompts` tab
- simplify the current prompt workspace to a more product-like operational screen
- keep support for testing, live, and legacy prompt versions
- retain save and promote actions
- retain a live-vs-test comparison flow, but move it out of the main navigation model

Out of scope:

- sidebar or app-shell redesign
- changing the underlying prompt versioning rules
- adding new prompt-management features
- changing Botpress storage semantics

## Design Intent

The target experience is close to the provided mockup:

- calm, operational, card-based layout
- one obvious editing surface
- clear separation between editable draft and production prompt
- legacy history visible but secondary
- comparison available when needed, without turning the screen into a studio or IDE

This redesign intentionally removes parts of the current interface that create too much workspace complexity for the desired visual direction.

## Information Architecture

The redesigned screen is composed of five stacked areas.

### 1. Page Intro

Top section with:

- page title
- one-sentence subtitle

This area is static and does not compete with the editor.

### 2. Current Prompt Selector

A single product-style selector directly under the intro:

- label such as `Current Prompt`
- selected bot / prompt context shown in a large, simple control

This replaces the current toolbar-like treatment and makes the screen feel closer to the reference.

### 3. Main Prompt Management Card

The main card becomes the core surface of the tab. It contains:

- horizontal tabs: `Test Prompt`, `Live Prompt`, `Legacy Prompts`
- a large content area below the tabs

The tabs express content categories, not editor modes.

### 4. Bottom Live Prompt Reminder

A compact read-only card below the main workspace:

- label `Live Prompt (Read-only)`
- short supporting description
- button to open or inspect the live prompt

This mirrors the screenshot and keeps production state visible even when editing the testing draft.

### 5. Modal Confirmation

Promotion from testing to live continues to require a confirmation dialog.

## Tab Model

### Test Prompt

`Test Prompt` is the primary working tab and the default destination whenever a testing draft exists.

It contains:

- an info banner explaining that only the test prompt is editable
- the prompt editor in the main left column
- the legacy prompt panel in the right column
- footer actions for `Save Draft` and `Push to Live`

This tab is the only place where label and markdown content can be edited.

### Live Prompt

`Live Prompt` is a read-only inspection tab.

It uses the same overall frame, but:

- no editing controls
- no save action
- no push action
- content presented as stable production state

The goal is consultation, not iteration.

### Legacy Prompts

`Legacy Prompts` is a browsing tab for previous prompt versions.

It should:

- show a straightforward list or table of archived versions
- expose version/date/action clearly
- allow opening a selected legacy version in read-only mode

Legacy browsing should stay simple and administrative.

## Main Layout Within Test Prompt

The `Test Prompt` content area follows the reference composition.

### Left Column

Primary working area:

- info banner
- section label for the markdown prompt
- compact utility controls aligned near the editor header
- large markdown editor surface
- footer action row

The editor should visually resemble a document workspace more than a developer tool.

### Right Column

Dedicated legacy panel:

- card title `Legacy Prompts`
- short description
- compact version list with `View` actions
- optional link to see the full historical list if needed

This keeps history visible without pulling focus away from editing.

## Comparison Design

Live-vs-test comparison remains available, but it is no longer a top-level mode alongside markdown or preview.

### Trigger

Comparison is opened from within `Test Prompt` through a secondary action such as:

- `Compare with live`

This action is only available when a live prompt exists.

### Behavior

When opened, comparison appears inside the main working area as a temporary alternate state of the editor region:

- `Live` on the left
- `Test` on the right
- line numbers
- restrained highlighting for added, removed, and changed lines
- clear exit back to the normal editing state

### Constraints

Comparison must remain subordinate to the editing workflow:

- not a main page tab
- not a permanent split screen by default
- not a separate studio view system

The user should enter comparison to validate a draft, then return to editing or publish.

## Preview Strategy

The current `Rendered / Markdown / Diff` navigation model is removed.

Replacement:

- markdown editing remains the default primary view in `Test Prompt`
- rendered preview stays available as a secondary inspection action
- comparison stays available as a different secondary action

This keeps the screen visually close to the reference while preserving the necessary validation tools.

## Removed Or Reduced Elements

The redesign intentionally removes or demotes the following:

- remove the `Variables` block entirely
- remove `Rendered / Markdown / Diff` as first-class workspace tabs
- remove the current studio-like "multi-mode" feeling
- reduce metadata noise in the main header area

These changes are required to reach the requested fidelity to the mockup.

## States

### No Testing Prompt

If no testing draft exists:

- the `Test Prompt` tab stays present
- the main area explains that no editable draft exists yet
- a clear call to action creates a testing draft from the best available source

### No Live Prompt

If no live prompt exists:

- the `Live Prompt` tab remains readable but shows a calm empty state
- comparison action is hidden or disabled
- the bottom live reminder card explains that no production prompt is available yet

### No Legacy Prompts

The right-side legacy panel and the dedicated legacy tab should show a clean empty state without placeholders that resemble errors.

### Loading And Saving

Async states remain supported, but visually restrained:

- disabled controls during write operations
- spinners only where actions are running
- toasts for operation feedback

### Read-Only States

Anything outside the testing draft remains explicitly read-only in wording and control behavior.

## Component Reuse

The redesign should still rely on the existing component system where possible:

- `Card`
- `Button`
- `Select`
- `Tabs`
- `Dialog`
- `Badge`
- `Alert`
- `ScrollArea`
- `Textarea`
- existing icon set

The visual change should come primarily from layout, spacing, hierarchy, and control composition rather than introducing a new design system.

## Responsive Behavior

Desktop behavior should stay closest to the mockup:

- left editing area
- right legacy panel

On narrower widths:

- right panel stacks below the editor
- footer actions remain obvious and accessible
- comparison may collapse vertically if required for readability

The screen should still read as one coherent prompt-management surface rather than multiple disconnected cards.

## Implementation Notes

The current business logic for prompt loading, saving, and promotion should be preserved where possible. The redesign is primarily a UI restructuring effort.

Preferred implementation direction:

- keep existing Botpress CRUD flows
- keep existing promotion dialog behavior
- reorganize stateful UI around the new tab model
- remove code paths that only exist for the old multi-mode workspace where they are no longer needed

## Acceptance Criteria

The redesign is complete when:

1. the `prompts` tab visually reads as a close adaptation of the provided mockup
2. only the testing prompt can be edited
3. the live prompt has a clean read-only presentation
4. legacy prompts are visible in a dedicated secondary panel and browsable in a dedicated tab
5. live-vs-test comparison is available, but only as a controlled secondary view
6. the variables block is gone
7. the old `Rendered / Markdown / Diff` workspace navigation is gone
8. save and promote flows still work with existing Botpress behavior

## Risks And Tradeoffs

- A tighter mockup match requires removing some power-user affordances from the main screen.
- Comparison and preview remain available, but are less central than before by design.
- The redesign depends on the current prompt data model continuing to distinguish `testing`, `live`, and `legacy` cleanly.
- Promotion remains guarded in the UI layer rather than through a transactional backend workflow.
