# Resilience Layer Examples

Practical examples of using all 9 Iris UI resilience primitives together.

## Basic Setup

```ts
import { createResilientFetcher, createOutbox, createDisposableScope } from '@iris-ui/core'
```

## 1. Resilient Data Fetching

Combine caching, circuit breaker, and rate limiting for a hardened API client:

```ts
const api = createResilientFetcher<User[]>({
  ttlMs: 30_000, // Cache for 30 seconds
  breaker: {
    // Trip after 5 failures
    failureThreshold: 5,
    resetMs: 60_000, // Try again after 1 minute
  },
  rateLimit: {
    // Max 10 requests per second
    capacity: 10,
    refillTokens: 10,
    intervalMs: 1000,
  },
})

// First call: fetches from network
const users = await api.fetch('users', () => fetch('/api/users').then((r) => r.json()))

// Second call within 30s: returns cached data instantly
const cached = await api.fetch('users', () => fetch('/api/users').then((r) => r.json()))

// After 5 failures: circuit breaker opens, calls throw immediately
```

## 2. Offline Mutation Queue

Queue mutations when offline, replay when connected:

```ts
const outbox = createOutbox<{ id: string; data: unknown }>({
  execute: async (payload) => {
    await fetch(`/api/items/${payload.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload.data),
    })
  },
  maxAttempts: 3,
})

// Queue a mutation (persisted immediately)
outbox.enqueue({ id: '123', data: { name: 'Updated' } })

// Flush the queue (retries failed items in order)
window.addEventListener('online', () => outbox.flush())
```

## 3. Real-time Connection with Auto-Reconnect

```ts
const source = createReconnectingSource<{ type: string; data: unknown }>(
  (sink) => {
    const ws = new WebSocket('wss://example.com/events')
    ws.onmessage = (e) => sink.message(JSON.parse(e.data))
    ws.onopen = () => sink.open()
    ws.onerror = (e) => sink.error(e)
    ws.onclose = () => sink.close()
    return () => ws.close()
  },
  {
    onMessage: (msg) => console.log('Received:', msg),
    onStatus: (status) => console.log('Connection:', status),
  },
  { backoffMs: 1000, maxBackoffMs: 30_000 },
)

source.open()
// On disconnect: auto-reconnects with 1s → 2s → 4s → … → 30s backoff
```

## 4. Lifecycle Management

```ts
const scope = createDisposableScope()

// Register cleanup for the scope
const source = scope.add(createReconnectingSource(...))
scope.addTimeout(setInterval(() => {}, 1000))
scope.add(() => console.log('Cleanup running'))

// Everything is cleaned up automatically
scope.destroy()  // Runs all registered teardowns in reverse order
```

## 5. Event Bus for Cross-Plugin Communication

```ts
const bus = createEventBus<{
  'user:login': { userId: string }
  'data:updated': { table: string }
}>()

bus.on('user:login', ({ userId }) => console.log('User logged in:', userId))
bus.emit('user:login', { userId: '123' })
```

## 6. Complete Example: React Component

```tsx
import { useEffect, useState } from 'react'
import { useResilientFetcher, useReconnectingSource, useDisposableScope } from '@iris-ui/react'

function Dashboard() {
  const scope = useDisposableScope()
  const api = useResilientFetcher<{ data: string[] }>({ ttlMs: 10_000 })
  const [data, setData] = useState<string[]>([])
  const [status, setStatus] = useState<string>('connecting')

  // Resilient data fetch
  useEffect(() => {
    api
      .fetch('dashboard-data', async () => {
        const res = await fetch('/api/dashboard')
        return res.json()
      })
      .then((result) => setData(result?.data ?? []))
  }, [])

  // Real-time connection
  const connectionStatus = useReconnectingSource<{ update: string }>(
    (sink) => {
      const ws = new WebSocket('wss://example.com/live')
      ws.onmessage = (e) => sink.message(JSON.parse(e.data))
      ws.onopen = () => sink.open()
      ws.onclose = () => sink.close()
      return () => ws.close()
    },
    {
      onMessage: (msg) => setData((prev) => [...prev, msg.update]),
      onStatus: (s) => setStatus(s),
    },
  )

  return (
    <div>
      <p>Status: {connectionStatus}</p>
      <ul>
        {data.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </div>
  )
}
```

## Primitive Reference

| Primitive                  | Purpose                   | Use Case                           |
| -------------------------- | ------------------------- | ---------------------------------- |
| `createDisposableScope`    | Lifecycle teardown        | Cleanup on unmount                 |
| `createEventBus`           | Typed pub/sub             | Cross-plugin messaging             |
| `createQueryCache`         | Dedup + TTL + SWR         | Cache API responses                |
| `createCircuitBreaker`     | Failure isolation         | Protect downstream services        |
| `createRateLimiter`        | Token bucket              | Throttle API calls                 |
| `createResilientFetcher`   | Cache + breaker + limiter | Hardened API client                |
| `createOutbox`             | Offline mutation queue    | Offline support                    |
| `createReconnectingSource` | Realtime + backoff        | Live data streams                  |
| `createDataSource`         | Unified data engine       | Table/list pagination + resilience |
