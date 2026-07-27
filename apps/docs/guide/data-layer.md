# Data & Resilience Layer

Iris UI provides a comprehensive data layer with built-in resilience primitives — all framework-agnostic in `@iris-ui-kit/core`.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                      │
│  useResourceController  │  IrisProTable  │  IrisTable    │
├─────────────────────────────────────────────────────────┤
│                    Data Source (createDataSource)         │
│  fetcher  │  pagination  │  selection  │  mutate         │
├─────────────────────────────────────────────────────────┤
│                    Resilience Layer                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  createResilientFetcher                         │    │
│  │  ├── createQueryCache      (dedup + TTL + SWR) │    │
│  │  ├── createCircuitBreaker  (failure isolation)  │    │
│  │  └── createRateLimiter     (token bucket)       │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  createOutbox              (offline mutation Q) │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  createReconnectingSource  (realtime + backoff) │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│                    Lifecycle                              │
│  createDisposableScope  │  createEventBus                │
└─────────────────────────────────────────────────────────┘
```

## Query Cache (createQueryCache)

Deduplicates concurrent requests, caches results with TTL, and serves stale data while revalidating (SWR):

```ts
const cache = createQueryCache<User[]>({ ttlMs: 30_000 })

// First call: fetches
const users = await cache.fetch('all-users', fetchUsers)

// Second call within 30s: returns cached data instantly
const cached = await cache.fetch('all-users', fetchUsers)
```

## Circuit Breaker (createCircuitBreaker)

Isolates failing endpoints to prevent cascading failures:

```ts
const breaker = createCircuitBreaker({
  failureThreshold: 3, // Trip after 3 failures
  resetMs: 30_000, // Try again after 30s
})

// Wraps any async operation
const result = await breaker.run(() => fetch('/api/data'))
```

## Rate Limiter (createRateLimiter)

Token-bucket rate limiting to protect downstream services:

```ts
const limiter = createRateLimiter({
  capacity: 10, // Burst up to 10 requests
  refillTokens: 5, // Refill 5 tokens per interval
  intervalMs: 1000, // Every second
})

if (limiter.tryRemove()) {
  await fetch('/api/data') // Allowed
} else {
  // Rate limited — wait `limiter.timeUntil()` ms
}
```

## Resilient Fetcher (createResilientFetcher)

Composes all three primitives into one hardened fetcher:

```ts
const rf = createResilientFetcher<User[]>({
  ttlMs: 10_000,
  breaker: { failureThreshold: 3, resetMs: 30_000 },
  rateLimit: { capacity: 5, refillTokens: 2, intervalMs: 1000 },
})

// Single call: cache + breaker + limiter all active
const users = await rf.fetch('all-users', fetchUsers)
```

## Offline Outbox (createOutbox)

Guarantees at-least-once, in-order delivery of mutations:

```ts
const outbox = createOutbox<{ id: string; data: unknown }>({
  execute: async (payload) => {
    await api.update(payload.id, payload.data)
  },
  maxAttempts: 5,
})

// Queue a mutation (persisted immediately)
outbox.enqueue({ id: '123', data: { name: 'New Name' } })

// Flush the queue (retries failed items)
await outbox.flush()

// Observe queue state
outbox.subscribe((items) => console.log(items))
```

## Realtime Source (createReconnectingSource)

Exponential-backoff reconnection for any push transport:

```ts
const source = createReconnectingSource<StockTick>(
  (sink) => {
    const ws = new WebSocket('wss://example.com/stocks')
    ws.onmessage = (e) => sink.message(JSON.parse(e.data))
    ws.onopen = () => sink.open()
    ws.onerror = (e) => sink.error(e)
    ws.onclose = () => sink.close()
    return () => ws.close()
  },
  {
    onMessage: (tick) => updatePrice(tick),
    onStatus: (status) => setConnectionState(status),
  },
  { backoffMs: 1000, maxBackoffMs: 30_000 },
)

source.open()
// On disconnect: auto-reconnects with 1s → 2s → 4s → … → 30s backoff
```

## Data Source (createDataSource)

The unified data engine that powers IrisTable, IrisProTable, and `useResourceController`. It composes all the above:

```ts
const ds = createDataSource<User>({
  fetcher: (query) => api.fetchUsers(query),
  pageSize: 20,
  // Enable resilience
  resilient: { ttlMs: 10_000, breaker: { failureThreshold: 3, resetMs: 30_000 } },
  // Enable offline mutations
  outbox: { maxAttempts: 3 },
})
```

## Lifecycle (createDisposableScope)

Every resilience primitive integrates with Iris's disposable lifecycle:

```ts
const scope = createDisposableScope()
const source = createReconnectingSource(...)
rf.cache.clear = scope.add(() => rf.cache.clear())

// On destroy: everything is cleaned up
scope.destroy()
```

The `createAsyncResource` controller already extends `Disposable`:

```ts
const resource = createAsyncResource(fetchData)
// ... use it ...
resource.destroy() // Cancels in-flight request, cleans up
```
