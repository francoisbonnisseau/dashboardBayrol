# Sentiment Loading Optimization

## Scope

Optimize loading in the Sentiments view without changing the Botpress table schema or the Analytics view.

## Data Loading

- Keep a page size of 1,000 rows so each page requires one Botpress request.
- Use `findTableRows.select` to request only the fields needed by the list:
  - `date`
  - `topics`
  - `resolved`
  - `sentiment`
  - `conversationId`
- Keep the existing server-side sentiment, resolution, and date filters.
- Keep descending date ordering.
- Change the default date range from the last 7 days to the last 2 days.

## Pagination

- Track the current zero-based page in the Sentiments component.
- Convert the page to the Botpress offset with `page * 1000`.
- Show Previous and Next controls below the table.
- Disable Previous on the first page.
- Enable Next from the Botpress `hasMore` response.
- Reset to the first page whenever the bot or any filter changes.

## Export

Preserve the current export behavior: export the filtered conversations currently loaded in the view, then fetch each conversation's messages and generate the same JSON structure and filename.

## Error And Loading Behavior

- Keep the current error formatting and loading indicator.
- Prevent page navigation while a request is running.
- Do not clear already displayed rows while loading another page.

## Verification

- Add focused tests for pagination request construction and page-reset behavior through extracted pure helpers.
- Run the test suite, TypeScript build, and lint checks.
