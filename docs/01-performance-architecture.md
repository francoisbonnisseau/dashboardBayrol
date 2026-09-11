# PRD — Phase 1: Performance Architecture

## Objective

Improve initial loading speed, data-fetching responsiveness and request efficiency without materially redesigning the UI.

This phase creates the data and loading architecture that later UI work will rely on.

## Success criteria

After this phase:

- Main feature screens are lazy-loaded.
- The initial application bundle no longer eagerly includes all feature screens.
- TanStack Query is the standard server-state layer.
- Navigating away from and back to a previously loaded screen should usually reuse cached data.
- Duplicate in-flight requests for the same resource are avoided.
- Feature components no longer own low-level Botpress fetching logic where it can reasonably be extracted.
- Existing user workflows continue to work.
- No major visual redesign is introduced yet.

---

## Current issues

### 1. All views are statically imported

`src/App.tsx` imports all feature components synchronously.

Examples include:

- `SentimentAnalysis`
- `Analytics`
- `Feedbacks`
- `Analysis`
- `Learnings`
- `IntroTable`
- `CodeTextTable`
- `PromptManagement`
- `ModelTesting`
- `Settings`

This increases initial JS parsing/evaluation cost.

### 2. Server state is managed as component state

Many pages follow this pattern:

```ts
const [rows, setRows] = useState(...)
const [loading, setLoading] = useState(...)
const [error, setError] = useState(...)

useEffect(() => {
  fetchRows()
}, [...])
```

This causes:

- duplicated fetch implementations
- no shared cache
- repeated requests after remount/navigation
- inconsistent loading/error behavior
- difficult cache invalidation after mutations

### 3. Several pages request very large row sets

Examples currently include:

- Learnings: up to 1,000 rows
- Feedbacks: up to 1,000 rows
- Intro: up to 1,000 rows
- Code Text: up to 1,000 rows
- Analysis: up to 1,000 rows
- Sentiment: page size of 1,000

Large page sizes are acceptable for export/background operations, but should not be the default UI loading strategy unless there is a strong reason.

### 4. Analytics performs sequential bulk loading

`Analytics.tsx` loops through `findTableRows` using offsets until all matching rows are fetched.

The browser then:

- deduplicates by conversation ID
- calculates daily metrics
- counts messages from transcripts
- calculates sentiment distribution
- calculates resolution statistics

Do not fully redesign this in Phase 1; Phase 4 will replace the architecture.

Phase 1 should only make safe improvements around its query lifecycle and prevent unnecessary duplicate reloads.

---

## Scope

### In scope

- Add TanStack Query.
- Add a global `QueryClientProvider`.
- Lazy-load feature views.
- Introduce shared query-key conventions.
- Extract Botpress table-query functions.
- Introduce query hooks for the most important read operations.
- Migrate read fetching progressively.
- Introduce correct invalidation after mutations.
- Add query caching.
- Use placeholder/previous data when changing pages or filters when appropriate.
- Reduce list page sizes where it does not change product behavior.
- Preserve current secure Botpress configuration flow.

### Out of scope

- Full UI redesign.
- New navigation architecture.
- Analytics backend aggregation.
- Moving Botpress credentials to a different infrastructure.
- Changing Botpress table schemas.
- Rewriting Model Testing business logic.
- Replacing Recharts.
- Introducing a new router unless clearly required.

---

## Technical direction

## 1. Install TanStack Query

Add:

```bash
pnpm add @tanstack/react-query
```

Optional for development:

```bash
pnpm add -D @tanstack/react-query-devtools
```

Do not include devtools in production UI by default.

Create:

```text
src/lib/queryClient.ts
```

Recommended defaults:

- modest `staleTime`
- limited retries for API errors
- no unnecessary refetch on every component mount
- sensible garbage collection time

Example starting point:

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

Exact values may be adjusted per query.

---

## 2. Add QueryClientProvider

Update `src/main.tsx` or the root provider tree.

Target structure:

```tsx
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </AuthProvider>
</QueryClientProvider>
```

Do not break the existing auth/settings initialization flow.

---

## 3. Lazy-load feature screens

Replace static feature imports in `src/App.tsx` with `React.lazy`.

Example:

```tsx
const SentimentAnalysis = lazy(() => import('./components/SentimentAnalysis'))
const Analytics = lazy(() => import('./components/Analytics'))
const Feedbacks = lazy(() => import('./components/Feedbacks'))
const PromptManagement = lazy(() => import('./components/PromptManagement'))
const ModelTesting = lazy(() => import('./components/ModelTesting'))
```

Keep shell-critical components eager:

- auth
- layout
- sidebar/navigation
- basic loading primitives

Wrap view rendering in a single shared `Suspense`.

Create a lightweight route/view loading fallback.

Do not show a full-page blocking spinner if the shell can remain visible.

---

## 4. Introduce shared Botpress query modules

Create a clear separation between:

```text
Botpress SDK
    ↓
data access functions
    ↓
React Query hooks
    ↓
feature components
```

Suggested structure:

```text
src/api/
  botpress/
    conversations.ts
    tables.ts
    analytics.ts
    feedbacks.ts
    learnings.ts

src/queries/
  queryKeys.ts
  useSentimentRows.ts
  useFeedbackRows.ts
  useLearnings.ts
  useIntroRows.ts
  useCodeTextRows.ts
  useAnalytics.ts
```

Do not force every query into a separate file if it produces unnecessary boilerplate; the important requirement is consistent separation.

---

## 5. Define query keys centrally

Create `src/queries/queryKeys.ts`.

Example:

```ts
export const queryKeys = {
  sentiment: (botId, filters) => ['sentiment', botId, filters] as const,
  feedbacks: (botId, filters) => ['feedbacks', botId, filters] as const,
  learnings: (botId) => ['learnings', botId] as const,
  intro: (botId) => ['intro', botId] as const,
  codeText: (botId) => ['codeText', botId] as const,
  analytics: (botId, range) => ['analytics', botId, range] as const,
  prompts: (botId) => ['prompts', botId] as const,
}
```

Query keys must include every parameter that changes the returned dataset.

---

## 6. Sentiment query migration

`SentimentAnalysis` already has:

- server-side filters
- server-side ordering
- `select`
- pagination helper
- `hasMore`

Preserve this behavior.

Refactor `fetchRows` into a React Query hook.

Recommended changes:

- reduce default UI page size from 1,000 to approximately 50–100 if Botpress performance and product behavior allow it
- use `placeholderData` / keep previous page content visible while loading next page
- expose `isFetching` separately from initial `isPending`
- keep export behavior separate from list pagination

Important:

The export operation may still need broader data loading. Do not make UI list size determine export correctness.

---

## 7. Feedbacks migration

Move the read query out of `Feedbacks.tsx`.

Improve:

- select only columns used by the list if supported
- use server-side reaction/date filters
- remove redundant client-side filtering when it exactly duplicates server-side filtering
- add pagination rather than always requesting 1,000 rows

Recommended UI page size:

```text
50–100 rows
```

---

## 8. Knowledge tables migration

Apply the same pattern to:

- `Learnings.tsx`
- `IntroTable.tsx`
- `CodeTextTable.tsx`

For CRUD operations:

Use React Query mutations.

Example pattern:

```ts
const mutation = useMutation({
  mutationFn: updateLearning,
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.learnings(botId),
    })
  },
})
```

Avoid:

```ts
await mutation()
await loadEverythingAgain()
```

when targeted cache invalidation or optimistic/local cache updates are appropriate.

Do not introduce optimistic updates for destructive operations unless rollback is correctly implemented.

---

## 9. Prompt data query

Move prompt table loading into a shared query.

The existing Prompt Management state for local editable drafts should remain local component state.

Separate:

```text
server state
- live prompt
- testing prompt
- legacy versions

client/editor state
- draft label
- draft prompt
- current tab
- preview state
- comparison state
```

After create/update/promote operations, invalidate only the relevant prompt query.

---

## 10. Analytics Phase 1 changes

Do not perform the Phase 4 backend rewrite yet.

For now:

- put the analytics request behind a React Query query
- cache results by bot and date range
- avoid automatically downloading the same full period every time the user revisits the screen
- preserve the existing Botpress analytics call
- preserve existing calculations
- keep existing results visible during background refetch where possible

Do not parallelize offset pages blindly if Botpress rate limits or ordering guarantees are unclear.

---

## 11. Client creation

Keep `useBotpressClient` memoized.

If useful, introduce a client factory/helper, but do not expose credentials outside the existing secure configuration model.

Do not instantiate new clients inside render loops or query functions when the memoized client can be reused.

---

## 12. Loading behavior

Distinguish:

### Initial loading

No cached data exists.

Use a skeleton or compact loading surface.

### Background refetch

Cached data exists.

Keep the current content visible and show a subtle refresh indicator.

### Pagination

Keep previous page content until new page content is ready.

### Mutation

Disable only controls affected by the mutation where possible.

Avoid blocking the entire page for local CRUD actions.

---

## 13. Prefetching

After the query architecture is stable, optionally prefetch common neighboring views.

Examples:

- hover/focus on sidebar Analytics → prefetch analytics for current bot/range only if parameters are already known
- hover/focus on Feedbacks → prefetch first page

Do not prefetch expensive analytics ranges by default.

Prefetching is a final optimization, not the foundation of Phase 1.

---

## Suggested file changes

Likely new files:

```text
src/lib/queryClient.ts
src/queries/queryKeys.ts
src/queries/useSentimentRows.ts
src/queries/useFeedbackRows.ts
src/queries/useLearnings.ts
src/queries/usePromptRows.ts
src/api/botpress/*
```

Likely modified files:

```text
src/main.tsx
src/App.tsx
src/components/SentimentAnalysis.tsx
src/components/Feedbacks.tsx
src/components/Learnings.tsx
src/components/IntroTable.tsx
src/components/CodeTextTable.tsx
src/components/PromptManagement.tsx
src/components/Analytics.tsx
```

Do not create unnecessary abstraction layers for one-off calls.

---

## Implementation order

1. Add TanStack Query provider.
2. Add lazy-loaded views.
3. Establish query-key convention.
4. Migrate Sentiment.
5. Migrate Feedbacks.
6. Migrate Learnings / Intro / Code Text.
7. Migrate Prompt table reads.
8. Wrap Analytics existing loader in React Query.
9. Add targeted invalidations for mutations.
10. Verify request counts and build output.
11. Add selective prefetch only if clearly beneficial.

---

## Acceptance criteria

### Build

```bash
pnpm build
```

must pass.

### Lint

```bash
pnpm lint
```

must pass, or no new lint errors may be introduced if the repository already contains known baseline issues.

### Functional

- Login still works.
- Secure config still loads.
- Bot selection still works.
- Sentiment filters and pagination work.
- Feedback filters work.
- Learnings CRUD works.
- Intro CRUD works.
- Code Text CRUD works.
- Prompts load/save/promote behavior is unchanged.
- Analytics output remains functionally equivalent.

### Performance

Verify production build output.

Expected:

- separate chunks for large feature views
- Model Testing not in the initial eager app chunk
- Analytics not in the initial eager app chunk

Verify navigation:

- revisiting the same bot/filter/date query should reuse cached data when still fresh
- background refresh should not unnecessarily blank the page
- repeated identical requests should be reduced

---

## Non-goals / guardrails

Do not:

- redesign every page
- replace shadcn
- change table schemas
- move analytics aggregation backend yet
- rewrite working model-test logic
- introduce a new state-management library for local UI state
- cache authentication credentials in React Query
- store sensitive Botpress tokens outside the existing settings/auth flow

---

## Definition of done

Phase 1 is complete when the application has a shared server-state architecture, lazy-loaded feature views and measurably fewer unnecessary loads, while remaining visually and functionally close to the pre-refactor application.
