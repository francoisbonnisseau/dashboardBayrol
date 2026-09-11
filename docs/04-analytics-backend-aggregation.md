# PRD — Phase 4: Analytics Backend Aggregation

## Objective

Remove the largest remaining analytics performance bottleneck by moving expensive analytics aggregation out of the browser.

The frontend should not need to download every matching `conversationsAnalysisTable` row and process transcripts just to render dashboard metrics.

---

## Current behavior

The current Analytics screen:

1. Queries Botpress analytics.
2. Queries `conversationsAnalysisTable` in batches.
3. Sequentially fetches additional offsets while `hasMore` is true.
4. Concatenates all rows in browser memory.
5. Deduplicates rows by `conversationId`.
6. Parses transcripts.
7. Calculates daily message counts.
8. Calculates conversation counts.
9. Calculates sentiment distribution.
10. Calculates resolution statistics.
11. Combines this with Botpress AI-cost analytics.
12. Renders the dashboard only after the required data has been processed.

This architecture becomes slower as data volume and selected date range increase.

---

## Target architecture

```text
Dashboard
    ↓
Supabase Edge Function
    ↓
cache lookup
    ↓
Botpress APIs / tables
    ↓
aggregation
    ↓
normalized analytics response
    ↓
Dashboard
```

The frontend should receive a compact analytics payload.

---

## Target endpoint

Create an authenticated Supabase Edge Function.

Suggested name:

```text
dashboard-analytics
```

Request:

```http
POST /dashboard-analytics
```

Body:

```json
{
  "botId": "...",
  "startDate": "2026-08-01T00:00:00.000Z",
  "endDate": "2026-08-31T23:59:59.999Z"
}
```

Use the existing custom dashboard session token for authorization.

Do not expose the Botpress token to any new frontend surface.

---

## Response contract

Recommended:

```ts
interface DashboardAnalyticsResponse {
  range: {
    startDate: string
    endDate: string
  }

  generatedAt: string

  summary: {
    totalUsers: number
    totalUserMessages: number
    totalBotMessages: number
    totalConversations: number
    avgUserMessagesPerConversation: number
    avgBotMessagesPerConversation: number
    totalAiCostUsd: number | null
    avgAiCostPerConversationUsd: number | null
    resolutionRate: number
  }

  daily: Array<{
    date: string
    uniqueUsers: number
    userMessages: number
    botMessages: number
    conversations: number
    aiCostUsd: number | null
  }>

  sentiment: Array<{
    name: string
    value: number
  }>

  resolution: {
    resolved: number
    unresolved: number
    resolutionRate: number
  }

  meta?: {
    rowsProcessed?: number
    cacheStatus?: 'hit' | 'miss' | 'stale'
  }
}
```

Keep the frontend contract stable and independent of raw Botpress response shapes.

---

## Authentication

Follow the existing secure Edge Function model used by:

- dashboard login
- secure Botpress config
- conversation-starter publishing

The request must validate the dashboard session token.

Do not:

- trust a bot ID blindly
- allow arbitrary Botpress workspace access
- send Botpress credentials to the client

Validate requested `botId` against the configured allowed bots.

---

## Aggregation behavior

The backend should preserve current analytics semantics unless intentionally corrected and documented.

Important existing logic:

### Conversation deduplication

Multiple rows may exist for the same conversation.

Current behavior keeps the most recent entry based on `createdAt`.

Reproduce this behavior unless a better authoritative rule is confirmed.

### Unique users

Current implementation effectively uses `conversationId` as the user identifier.

Do not silently change this metric to a true user ID without confirming the intended product definition.

If this is not actually "unique users", consider renaming the frontend label in a separate product change.

### Message counts

Current implementation counts messages from the stored transcript:

- `sender === 'user'`
- `sender === 'bot'`

Preserve unless the Botpress analytics API provides a more authoritative equivalent and output parity is validated.

### Sentiment

Support:

- very positive
- positive
- neutral
- negative
- very negative

Unknown/missing values currently fall back to neutral.

### Resolution

Calculate:

```text
resolved
unresolved
resolutionRate
```

### AI cost

Preserve current Botpress `getBotAnalytics` logic and date grouping.

---

## Cache strategy

Introduce short-lived caching.

Recommended first version:

```text
TTL: 1–5 minutes
```

Cache key:

```text
analytics:{botId}:{startDate}:{endDate}
```

Normalize date range values before constructing the key.

Possible storage options:

### Option A — Supabase database cache table

Recommended if easy to implement and inspect.

Example:

```text
dashboard_analytics_cache
- cache_key
- bot_id
- start_date
- end_date
- payload jsonb
- created_at
- expires_at
```

### Option B — another existing fast cache facility

Use only if already available in the project infrastructure.

Do not add external infrastructure solely for this phase unless necessary.

---

## Stale behavior

A good UX target:

- return valid cached payload immediately
- recompute after expiration on the next request

A more advanced stale-while-revalidate design is optional.

Do not over-engineer the first version.

---

## Botpress data retrieval

The Edge Function can fetch Botpress data using the secure token already available server-side.

Use:

- server-side filters
- only required columns when possible
- maximum safe page size
- pagination until the requested range is complete

Because this is server-side, bulk loading no longer blocks browser main-thread computation, but request count still matters.

Avoid fetching columns not used by aggregation.

Required columns likely include:

```text
conversationId
createdAt
resolved
sentiment
transcript
```

Potentially `date` depending on the aggregation implementation.

---

## Optional optimization: pre-aggregated daily data

Do not make this mandatory for the first Phase 4 implementation.

Future architecture could maintain a daily aggregate table such as:

```text
dashboard_analytics_daily
- bot_id
- date
- conversations
- user_messages
- bot_messages
- resolution counts
- sentiment counts
- ai_cost
```

Then a 90-day dashboard query would fetch roughly 90 aggregate rows instead of raw conversations.

This is a future optimization if the Edge Function aggregation remains too expensive.

---

## Frontend changes

Create/modify:

```text
src/lib/edgeFunctions.ts
src/queries/useAnalytics.ts
src/features/analytics/*
```

The frontend query should call `dashboard-analytics`.

Remove the raw bulk `findTableRows` loop from the Analytics feature.

Remove browser-side aggregation logic that has moved to the backend.

Keep lightweight presentation transformations only.

Example:

```ts
const analyticsQuery = useQuery({
  queryKey: queryKeys.analytics(botId, range),
  queryFn: () => getDashboardAnalytics(sessionToken, {
    botId,
    startDate,
    endDate,
  }),
})
```

---

## Edge Function structure

Suggested:

```text
supabase/functions/dashboard-analytics/
  index.ts
```

Extract pure aggregation helpers where practical:

```text
supabase/functions/_shared/analytics/
  aggregate.ts
  types.ts
```

or keep helpers colocated if shared infrastructure would be excessive.

Pure aggregation functions should be unit-testable.

---

## Error handling

Return structured errors.

Examples:

```json
{
  "error": {
    "code": "INVALID_DATE_RANGE",
    "message": "..."
  }
}
```

Possible codes:

```text
UNAUTHORIZED
INVALID_BOT
INVALID_DATE_RANGE
BOTPRESS_ERROR
ANALYTICS_ERROR
```

Do not leak:

- Botpress token
- Supabase service credentials
- raw upstream sensitive payloads

---

## Request constraints

Validate:

- start date
- end date
- start <= end
- maximum range if necessary

If an upper bound is introduced, it must be product-justified.

Do not add an arbitrary short range solely to hide poor backend performance.

---

## Observability

Add server-side timing logs.

Measure:

```text
cache lookup time
Botpress table fetch time
Botpress analytics fetch time
aggregation time
total request time
rows processed
```

Avoid logging transcripts or message contents.

The goal is operational timing, not user-content logging.

---

## Verification methodology

Use representative ranges:

```text
2 days
7 days
30 days
90 days
```

For each:

1. record current frontend implementation output
2. call new endpoint
3. compare:
   - total conversations
   - message totals
   - resolution rate
   - sentiment counts
   - daily series
   - AI cost
4. investigate any discrepancy

Do not switch the production frontend until output parity is acceptable.

---

## Performance acceptance criteria

### Cold cache

A cold request may still need to query Botpress, but:

- browser should make one analytics endpoint request
- browser should not download thousands of raw analysis rows
- browser should not perform large transcript aggregation

### Warm cache

Repeated identical request should return significantly faster.

Target:

- cache hit should be near-immediate relative to Botpress bulk retrieval

Do not set an unrealistic fixed millisecond threshold without measuring deployment/network conditions.

### Payload

Response size should be proportional to:

- number of days
- number of aggregate categories

not number of raw conversations.

---

## Migration strategy

### Step 1

Build pure backend aggregator using representative fixture data.

### Step 2

Create authenticated Edge Function.

### Step 3

Implement Botpress data retrieval.

### Step 4

Compare output against current frontend calculations.

### Step 5

Add cache.

### Step 6

Create frontend API/query call.

### Step 7

Switch Analytics screen to new endpoint.

### Step 8

Delete obsolete browser-side bulk aggregation code.

### Step 9

Measure performance.

---

## Acceptance criteria

### Functional parity

For the same bot and date range, new metrics are equal to the old implementation or documented differences are explicitly approved.

### Security

- Botpress token remains server-side.
- Session validation is required.
- Bot ID is validated.
- Errors do not leak secrets.

### Frontend

Analytics no longer calls `findTableRows` directly to load the entire conversation-analysis period.

### Cache

Repeated identical queries can use cached aggregated results.

### Build

Frontend:

```bash
pnpm build
pnpm lint
```

Supabase Edge Function should also pass the project's existing validation/deployment checks.

---

## Guardrails

Do not:

- change analytics definitions silently
- expose raw transcripts from the analytics endpoint
- add a second authentication system
- send Botpress token to the browser
- modify Botpress table schemas unless separately approved
- make Phase 4 dependent on a complete analytics database redesign
- over-engineer real-time analytics if minute-level freshness is sufficient

---

## Definition of done

Phase 4 is complete when Analytics loads from a secure aggregated backend response, repeated queries can use a short-lived cache, and the browser no longer downloads and processes the full raw Botpress dataset for ordinary analytics viewing.
