# Prompts Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `prompts` tab UI so it matches the approved mockup direction while preserving testing-draft editing, live read-only inspection, legacy browsing, and controlled live-vs-test comparison.

**Architecture:** Keep the existing Botpress CRUD and prompt versioning logic, but simplify the screen around a mockup-shaped tab model: `Test Prompt`, `Live Prompt`, and `Legacy Prompts`. Concentrate most of the change in `src/components/PromptManagement.tsx`, removing the current multi-mode studio layout and replacing it with a structured management surface plus secondary comparison and preview actions.

**Tech Stack:** React 19, TypeScript, Vite, shadcn/ui, Botpress client, sonner, react-markdown, Tailwind utility classes

---

## File Structure

- Modify: `src/components/PromptManagement.tsx`
  Responsibility: replace the current studio UI with the approved mockup-aligned layout, tabs, states, and secondary comparison/preview flows.
- Modify: `src/lib/promptVersions.ts` only if a small helper adjustment is needed while preserving current version semantics.
- Verify: `package.json`
  Responsibility: use the existing `build` script for verification. No new testing dependency should be added for this redesign.

## Execution Notes

- This repo currently has no frontend test runner or component test harness installed.
- Because of that, the implementation will use disciplined incremental edits plus `pnpm build` verification rather than inventing a new UI test stack inside this task.
- Do not touch sidebar or app-shell layout files as part of this redesign.

### Task 1: Simplify Prompt Screen State Around The New Tab Model

**Files:**
- Modify: `src/components/PromptManagement.tsx`

- [ ] **Step 1: Replace the old workspace-mode state with mockup-oriented state**

Update the screen state so it no longer centers around `markdown | rendered | diff`. Use a tab model and explicit booleans for secondary surfaces instead.

Target shape:

```ts
type PromptTab = 'testing' | 'live' | 'legacy';

const [activeTab, setActiveTab] = useState<PromptTab>('testing');
const [comparisonOpen, setComparisonOpen] = useState(false);
const [previewOpen, setPreviewOpen] = useState(false);
```

Also remove the now-obsolete `WorkspaceView` type and any state derived only from the old studio navigation.

- [ ] **Step 2: Make active tab selection follow the available prompt rows**

Keep the current prompt-row loading logic, but drive the visible tab from the actual available prompt versions so the UI lands on `testing`, otherwise `live`, otherwise `legacy`.

Target helper shape inside the component:

```ts
function getPreferredTab(prompts: ReturnType<typeof partitionPromptRows>): PromptTab {
  if (prompts.testing) return 'testing';
  if (prompts.live) return 'live';
  return 'legacy';
}
```

Then update the effect so prompt loading sets `activeTab` from this helper rather than from the removed workspace view.

- [ ] **Step 3: Remove variable extraction state that no longer belongs on the screen**

Delete the variable token types and extraction logic from the component:

```ts
type VariableToken = {
  name: string;
  kind: 'String' | 'Enum';
};

function inferVariableKind(variableName: string): VariableToken['kind'] { ... }
function extractPromptVariables(content: string): VariableToken[] { ... }
```

Also delete any derived state and JSX tied to the removed `Variables` block.

### Task 2: Rebuild The Top-Level Prompt Management Layout

**Files:**
- Modify: `src/components/PromptManagement.tsx`

- [ ] **Step 1: Replace the current toolbar-like header with the approved intro and selector layout**

Create a top section with:

- page title
- one-line description
- one large `Current Prompt` selector card

Target structure:

```tsx
<section className="space-y-5">
  <div className="space-y-2">
    <h1 className="text-3xl font-semibold tracking-[-0.03em]">Prompt Management</h1>
    <p className="text-sm text-muted-foreground">
      Create, edit, and manage versions of prompts.
    </p>
  </div>

  <div className="max-w-xl rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
    <Label className="text-xs font-medium text-muted-foreground">Current Prompt</Label>
    {/* select control */}
  </div>
</section>
```

- [ ] **Step 2: Rebuild the main card around `Test Prompt`, `Live Prompt`, and `Legacy Prompts` tabs**

Replace the old left-rail plus workspace arrangement with one main card that contains:

```tsx
<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PromptTab)}>
  <TabsList>
    <TabsTrigger value="testing">Test Prompt</TabsTrigger>
    <TabsTrigger value="live">Live Prompt</TabsTrigger>
    <TabsTrigger value="legacy">Legacy Prompts</TabsTrigger>
  </TabsList>
</Tabs>
```

The tabs should represent prompt categories, not preview/editor modes.

- [ ] **Step 3: Add the bottom read-only live reminder card**

After the main workspace card, add a compact card shaped like the reference:

```tsx
<section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background p-5 md:flex-row md:items-center md:justify-between">
  <div className="space-y-1">
    <h3 className="text-base font-medium">Live Prompt (Read-only)</h3>
    <p className="text-sm text-muted-foreground">
      This is the prompt currently in production. Edits can only be made in the Test Prompt and pushed live.
    </p>
  </div>
  <Button variant="outline">View Live Prompt</Button>
</section>
```

This button should switch the tab to `live`.

### Task 3: Implement The Test Prompt Tab As The Main Working Surface

**Files:**
- Modify: `src/components/PromptManagement.tsx`

- [ ] **Step 1: Build the two-column `Test Prompt` content matching the mockup**

Inside the `testing` tab content, create:

- left column for editing
- right column for legacy prompt list

Target layout:

```tsx
<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
  <div className="space-y-4">{/* banner, editor, footer */}</div>
  <aside>{/* legacy card */}</aside>
</div>
```

- [ ] **Step 2: Add the editable test prompt banner, label field, and markdown editor**

The left column should contain:

- an informational banner when editing testing
- a label input
- a large markdown textarea
- a small header row with secondary actions such as preview and compare

Target behavior:

```tsx
const canEditTesting = activeTab === 'testing' && Boolean(prompts.testing);
```

Only enable the input and textarea when `canEditTesting` is true. Otherwise render read-only content or the draft-creation empty state.

- [ ] **Step 3: Keep the bottom action row constrained to `Save Draft` and `Push to Live`**

Use a right-aligned footer row:

```tsx
<div className="flex flex-wrap justify-end gap-3 border-t px-4 py-4">
  <Button variant="outline" onClick={handleSaveTestingDraft}>Save Draft</Button>
  <Button onClick={() => setPromotionDialogOpen(true)}>Push to Live</Button>
</div>
```

If no testing draft exists, replace the editor action row with a single clear CTA that calls `handleCreateTestingDraft`.

### Task 4: Implement Controlled Secondary Views For Preview And Comparison

**Files:**
- Modify: `src/components/PromptManagement.tsx`

- [ ] **Step 1: Replace the old first-class preview/diff tabs with secondary controls**

In the test prompt editor header, expose small secondary actions:

```tsx
<Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
  <Eye className="size-4" />
  Preview
</Button>
<Button
  variant="outline"
  size="sm"
  onClick={() => setComparisonOpen(true)}
  disabled={!prompts.live || !prompts.testing}
>
  <GitCompareArrows className="size-4" />
  Compare with live
</Button>
```

Remove the old `TabsTrigger` values for `markdown`, `rendered`, and `diff`.

- [ ] **Step 2: Render preview as a modal or large secondary panel instead of a main workspace mode**

Use the existing `Dialog` primitives to show rendered markdown:

```tsx
<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
  <DialogContent className="max-w-4xl">
    <DialogHeader>
      <DialogTitle>Prompt Preview</DialogTitle>
    </DialogHeader>
    <ScrollArea className="max-h-[70vh] pr-4">
      <PromptPreview markdown={selectedPromptContent} />
    </ScrollArea>
  </DialogContent>
</Dialog>
```

This keeps preview available without dominating the base layout.

- [ ] **Step 3: Render comparison as a controlled two-column alternate surface**

Use a second `Dialog` or equivalent controlled surface for comparison, preserving the existing `buildDiffRows` logic:

```tsx
<Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
  <DialogContent className="max-w-6xl">
    <DialogHeader>
      <DialogTitle>Compare Live vs Test</DialogTitle>
    </DialogHeader>
    <div className="grid min-h-[520px] gap-0 md:grid-cols-2 md:divide-x">
      {/* live column */}
      {/* testing column */}
    </div>
  </DialogContent>
</Dialog>
```

Keep line numbers and restrained difference highlighting, but make this a temporary validation view rather than the main navigation model.

### Task 5: Rebuild The Live And Legacy Read-Only Tabs

**Files:**
- Modify: `src/components/PromptManagement.tsx`

- [ ] **Step 1: Build a calm read-only `Live Prompt` tab**

Render the live prompt tab as a read-only card with:

- version badge / deploy metadata
- label display
- prompt content shown in a document-style scroll area

Target empty state:

```tsx
<Alert>
  <AlertTriangle className="size-4" />
  <AlertTitle>No live prompt</AlertTitle>
  <AlertDescription>No production prompt has been deployed yet.</AlertDescription>
</Alert>
```

- [ ] **Step 2: Build a dedicated `Legacy Prompts` tab separate from the right-side summary list**

Use a larger list or table presentation with:

- version or fallback label
- date
- `View` action

When `View` is clicked, switch the read-only content area to that legacy prompt or open it in a lightweight read-only dialog, but do not create editable affordances.

- [ ] **Step 3: Keep the right-side legacy card as a compact summary while the full tab stays more complete**

The compact right column inside `Test Prompt` should show the most recent legacy items only, while the full `Legacy Prompts` tab can list all of them. This keeps the screen aligned with the mockup while preserving archive access.

### Task 6: Verify And Clean Up

**Files:**
- Modify: `src/components/PromptManagement.tsx` if verification reveals issues

- [ ] **Step 1: Remove dead code from the old studio layout**

Delete imports and JSX that are no longer used, especially:

- `Code2`
- `Languages` if the selector no longer needs the icon
- `RefreshCw` if not reused
- any remaining workspace-view helper code

Run a careful pass so the component reflects the new architecture rather than containing both old and new patterns.

- [ ] **Step 2: Run build verification**

Run:

```bash
pnpm build
```

Expected:

- TypeScript build passes
- Vite build passes
- no new lint-like type failures from the redesign

- [ ] **Step 3: Summarize any residual UX or data risks**

If verification passes, note remaining caveats such as:

- legacy restoration still being read-only browsing rather than full restore workflow
- comparison depending on the existing line-by-line diff strategy
- promotion still enforced in the UI layer
