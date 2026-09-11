# Phase 1 implementation and verification

Implemented the performance architecture only. The existing shell, feature layouts,
secure configuration flow, Analytics calculations, and Model Testing business logic
remain in place.

## Server state

- The root QueryClientProvider uses 30-second freshness, five-minute cache retention,
  one read retry, no mutation retries, and no window-focus refetch.
- Keys are scoped by workspace, bot, resource, and effective request parameters.
- Sentiment and Feedbacks use 100-row UI pages with previous-page content while
  fetching. Their exports independently traverse all filtered pages.
- Learnings, Intro, and Code Text fetch complete datasets in sequential 100-row
  batches, preserving full table contents and Intro publication previews.
- Prompt Management and Model Testing share prompt reads. Editor drafts remain
  local; background reads preserve unsaved edits.
- Knowledge and prompt writes invalidate their original resource scope, including
  when the selected bot changes while a write is pending.
- Analytics retains its sequential bulk loader and browser calculations, cached by
  bot and date range. Default rolling date ranges retain their original timestamp
  semantics and remain stable across view remounts within the session.
- Logout and settings updates clear the query cache. Credentials are not included
  in query keys or cached results.

## Checks

- `pnpm install --frozen-lockfile`: passed.
- `pnpm build`: passed. Separate feature chunks include Analytics (~411 kB),
  Model Testing (~82 kB), and Prompt Management (~24 kB), uncompressed. These
  feature modules are dynamically imported instead of eagerly included by App.
- `pnpm lint`: 13 existing errors and 12 warnings, down from the baseline
  18 errors and 15 warnings; no new findings.
- `node --test --experimental-strip-types src/lib/*.test.ts src/queries/*.test.ts src/api/botpress/*.test.ts`:
  37 tests pass. Coverage includes in-flight deduplication, fresh cache reuse,
  scoped invalidation, clearing pending session data, pagination, complete exports,
  knowledge normalization, and Analytics calculation equivalence.
- Local browser smoke check: login page renders. Authenticated live Botpress
  filters, CRUD, promotion, and request-count checks were not performed because
  the browser session was not signed in. Cache request-count assertions use a
  controlled query function, and data-loader tests use mocked SDK responses.

No Design System V2 work or Analytics backend aggregation was started. Analysis
and conversation-detail imperative workflows remain candidates for later
progressive migration; no Model Testing inference logic was rewritten.
