# Prompt Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `Test` dashboard area with a `Prompts` entry that lets admins manage Botpress prompts per bot, preview Markdown, edit the testing draft, and promote testing to live while archiving the previous live prompt.

**Architecture:** Extend the existing single-view dashboard navigation with a new `test` view that renders a dedicated prompt studio component. Keep Botpress table CRUD inside the component, but extract the versioning rules and prompt normalization into a pure helper module so the business logic stays isolated from the UI.

**Tech Stack:** React 19, TypeScript, Vite, shadcn/ui components, Botpress JS client, sonner toasts, react-markdown.

---

### Task 1: Wire The New Dashboard View

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Navigation.tsx`

- [ ] **Step 1: Extend the view unions with `test`**

Add `test` to the `activeView` unions in the app shell files so the new screen can be selected everywhere the existing views are typed.

- [ ] **Step 2: Add the new sidebar/nav entry**

Add a new `Test` entry in the dashboard navigation and keep it near configuration/admin-style screens rather than mixing it into analytics or knowledge lists.

- [ ] **Step 3: Update the page title mapping**

Map `test` to the label `Test` in the layout header so the page title stays readable and consistent with the other sections.

### Task 2: Extract Prompt Versioning Rules

**Files:**
- Create: `src/lib/promptVersions.ts`

- [ ] **Step 1: Define prompt row types and version labels**

Create a small module with the prompt row interface, explicit version union (`live | testing | legacy`), and helper functions for sorting and selecting rows.

- [ ] **Step 2: Implement pure helpers for promotion and draft creation**

Add pure functions that:
- normalize raw Botpress rows into prompt rows
- return the current `live`, `testing`, and `legacy` slices
- build the update payload for promoting testing to live
- build the payload for creating or refreshing a testing draft from live

- [ ] **Step 3: Keep deploy date semantics explicit**

Ensure the promotion helper sets the new live `deployDate` to “now”, clears deploy dates for non-live rows, and preserves row ids where updates are expected.

### Task 3: Build The Prompt Management Screen

**Files:**
- Create: `src/components/PromptManagement.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the screen shell**

Build the new screen with:
- a bot selector reusing the existing `settings.bots` pattern
- a left rail listing `Live`, `Testing`, and `Legacy`
- an editor/metadata panel
- a Markdown preview panel with a `Preview / Markdown` toggle

- [ ] **Step 2: Load prompts from `promptsTable` for the selected bot**

Use the existing `useBotpressClient` hook and fetch table rows with `findTableRows`, then normalize them with the helper module.

- [ ] **Step 3: Support testing draft edits**

Allow editing only on the testing prompt, including:
- `label`
- prompt markdown
- save/create actions
- “create testing from live” if no testing prompt exists

- [ ] **Step 4: Support live promotion**

Add a guarded promotion action that:
- confirms the intent
- moves current live to legacy
- promotes testing to live
- updates `deployDate`
- refreshes the list after success

- [ ] **Step 5: Keep the screen resilient**

Handle empty states, missing bot configuration, loading states, and Botpress failures with existing card/toast patterns from the repo.

### Task 4: Verify And Clean Up

**Files:**
- Modify: `package.json` only if verification requires it

- [ ] **Step 1: Run type/build verification**

Run the project build and fix any TypeScript or lint-level issues introduced by the new feature.

- [ ] **Step 2: Sanity-check the versioning flow**

Manually validate the helper logic against these cases:
- no prompt rows
- live only
- live + testing
- multiple legacy rows

- [ ] **Step 3: Summarize residual risks**

Call out any remaining concurrency limitations, especially the fact that promotion is enforced in the UI layer rather than by a server-side transaction.
