# Sentiment Loading Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Sentiments loading cost with lightweight 1,000-row server pages and a two-day default range while preserving export behavior.

**Architecture:** Extract Botpress query construction into a pure helper so pagination, projection, filters, and ordering are testable. The React component owns the current page and `hasMore`, resets pagination when filters change, and renders Previous/Next controls.

**Tech Stack:** React 19, TypeScript, Botpress Client, Node test runner.

---

### Task 1: Query Builder

**Files:**
- Create: `src/lib/sentimentRows.ts`
- Create: `src/lib/sentimentRows.test.ts`

- [ ] Write failing tests proving the query uses a 1,000-row limit, projected list columns, page-derived offset, filters, and descending date order.
- [ ] Run `node --test --experimental-strip-types src/lib/sentimentRows.test.ts` and confirm failure because the helper does not exist.
- [ ] Implement `buildSentimentRowsQuery`.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Sentiments Pagination

**Files:**
- Modify: `src/components/SentimentAnalysis.tsx`

- [ ] Change the default start date and reset action to two days ago.
- [ ] Use `buildSentimentRowsQuery` for data requests.
- [ ] Track current page and `hasMore`.
- [ ] Reset to page zero when the bot or filters change.
- [ ] Add Previous/Next controls and disable them while loading.
- [ ] Preserve the existing export implementation and JSON format.

### Task 3: Verification

**Files:**
- Verify: `src/lib/sentimentRows.test.ts`
- Verify: `src/components/SentimentAnalysis.tsx`

- [ ] Run the focused Node test.
- [ ] Run `pnpm.cmd build`.
- [ ] Run `pnpm.cmd lint`.
- [ ] Inspect the final diff for unrelated changes.
