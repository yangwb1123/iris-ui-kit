import { useEffect, useRef, useState } from 'react'
import {
  createResilientFetcher,
  createOutbox,
  createReconnectingSource,
  createDisposableScope,
  type RealtimeStatus,
} from '@iris-ui/core'
import { IrisBadge, IrisButton } from '@iris-ui/react'

/* ── 1. Resilient Fetcher demo ─────────────────────────────────────────── */

function ResilientFetcherDemo() {
  const [results, setResults] = useState<string[]>([])
  const [breakerState, setBreakerState] = useState('closed')
  const log = (msg: string) => setResults((p) => [msg, ...p].slice(0, 20))

  useEffect(() => {
    // Create a resilient fetcher with 3s TTL, breaker (2 failures), rate limit
    const rf = createResilientFetcher<{ id: number; value: string }>({
      ttlMs: 3000,
      breaker: { failureThreshold: 2, resetMs: 5000 },
      rateLimit: { capacity: 3, refillTokens: 1, intervalMs: 2000 },
    })

    rf.breaker?.subscribe((state) => setBreakerState(state))

    let failMode = false

    const doFetch = async () => {
      const result = await rf.fetch('demo-key', async (_key) => {
        if (failMode) throw new Error('Simulated failure')
        return { id: 1, value: `ok-${Date.now()}` }
      })
      log(`Fetched: ${result?.value ?? 'cache-hit'}`)
    }

    // Fetch 5 times: some hit cache, some trigger rate limit
    const t1 = setInterval(() => {
      void doFetch()
    }, 500)

    // After 3s, toggle failure mode to trip the breaker
    const t2 = setTimeout(() => {
      failMode = true
      log('🔴 FAILURE MODE ON')
    }, 3000)

    // After 8s, reset failure mode to see circuit recover
    const t3 = setTimeout(() => {
      failMode = false
      log('🟢 FAILURE MODE OFF')
    }, 8000)

    return () => {
      clearInterval(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      rf.cache.clear()
    }
  }, [log])

  return (
    <div
      style={{
        padding: 16,
        background: 'var(--iris-surface)',
        borderRadius: 8,
        border: '1px solid var(--iris-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong>Resilient Fetcher</strong>
        <IrisBadge tone={breakerState === 'closed' ? 'success' : 'danger'} variant="subtle">
          breaker: {breakerState}
        </IrisBadge>
      </div>
      <div style={{ fontSize: 13, color: 'var(--iris-muted)', marginBottom: 8 }}>
        Cache (3s TTL) + Circuit breaker (2 failures → 5s reset) + Rate limiter (3 req / 2s)
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 12, maxHeight: 150, overflow: 'auto' }}>
        {results.map((r, i) => (
          <div key={i}>{r}</div>
        ))}
      </div>
    </div>
  )
}

/* ── 2. Outbox demo ────────────────────────────────────────────────────── */

function OutboxDemo() {
  const [items, setItems] = useState<{ id: string; status: string; payload: string }[]>([])
  const [online, setOnline] = useState(true)
  const onlineRef = useRef(online)
  onlineRef.current = online
  const outboxRef = useRef<ReturnType<typeof createOutbox<{ text: string }>> | null>(null)

  useEffect(() => {
    const outbox = createOutbox<{ text: string }>({
      execute: async (_payload) => {
        // Read latest online state via ref, not closure
        if (!onlineRef.current) throw new Error('Offline')
        await new Promise((r) => setTimeout(r, 300))
      },
      maxAttempts: 3,
    })
    outboxRef.current = outbox

    outbox.subscribe((snap) => {
      setItems(snap.map((i) => ({ id: i.id, status: i.status, payload: i.payload.text })))
    })

    return () => outbox.clear()
  }, []) // Empty deps: outbox created once, online read via ref

  const enqueue = () => {
    outboxRef.current?.enqueue({ text: `Mutation #${Date.now() % 1000}` })
    void outboxRef.current?.flush()
  }

  return (
    <div
      style={{
        padding: 16,
        background: 'var(--iris-surface)',
        borderRadius: 8,
        border: '1px solid var(--iris-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong>Offline Outbox</strong>
        <IrisBadge tone={online ? 'success' : 'warning'} variant="subtle">
          {online ? 'Online' : 'Offline'}
        </IrisBadge>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <IrisButton size="sm" onClick={enqueue}>
          Enqueue Mutation
        </IrisButton>
        <IrisButton size="sm" variant="outline" onClick={() => setOnline((o) => !o)}>
          Toggle {online ? 'Offline' : 'Online'}
        </IrisButton>
        <IrisButton
          size="sm"
          variant="ghost"
          onClick={() => {
            outboxRef.current?.clear()
            setItems([])
          }}
        >
          Clear
        </IrisButton>
      </div>
      <div style={{ fontSize: 13, color: 'var(--iris-muted)', marginBottom: 4 }}>
        Queue: {items.filter((i) => i.status === 'pending').length} pending,{' '}
        {items.filter((i) => i.status === 'failed').length} failed
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 12, maxHeight: 150, overflow: 'auto' }}>
        {items.map((i) => (
          <div key={i.id}>
            <span
              style={{ color: i.status === 'failed' ? 'var(--iris-danger)' : 'var(--iris-muted)' }}
            >
              [{i.status}]
            </span>{' '}
            {i.payload}
          </div>
        ))}
        {items.length === 0 && <span style={{ color: 'var(--iris-muted)' }}>No mutations yet</span>}
      </div>
    </div>
  )
}

/* ── 3. Realtime Source demo ────────────────────────────────────────────── */

function RealtimeSourceDemo() {
  const [messages, setMessages] = useState<string[]>([])
  const [status, setStatus] = useState<RealtimeStatus>('idle')

  useEffect(() => {
    const scope = createDisposableScope()

    const source = createReconnectingSource<string>(
      (sink) => {
        const interval = setInterval(() => {
          sink.message(`tick-${Date.now() % 10000}`)
        }, 1500)

        // Simulate connection delay then open
        const timer = setTimeout(() => sink.open(), 200)

        return () => {
          clearInterval(interval)
          clearTimeout(timer)
        }
      },
      {
        onMessage: (data) => setMessages((p) => [data, ...p].slice(0, 20)),
        onStatus: (s) => setStatus(s),
      },
      { backoffMs: 1000, maxBackoffMs: 5000 },
    )

    source.open()
    scope.add(() => source.close())
    return () => scope.destroy()
  }, [])

  return (
    <div
      style={{
        padding: 16,
        background: 'var(--iris-surface)',
        borderRadius: 8,
        border: '1px solid var(--iris-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong>Realtime Source</strong>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            display: 'inline-block',
            background:
              status === 'open'
                ? 'var(--iris-success)'
                : status === 'reconnecting'
                  ? 'var(--iris-warning)'
                  : 'var(--iris-muted)',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--iris-muted)' }}>{status}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--iris-muted)', marginBottom: 8 }}>
        Live event stream via createReconnectingSource (exponential backoff on disconnect)
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 12, maxHeight: 150, overflow: 'auto' }}>
        {messages.map((m, i) => (
          <div key={i}>{m}</div>
        ))}
        {messages.length === 0 && (
          <span style={{ color: 'var(--iris-muted)' }}>Waiting for events…</span>
        )}
      </div>
    </div>
  )
}

/* ── 4. All-in-one DataSource demo ──────────────────────────────────────── */

function DataSourceDemo() {
  const [state, setState] = useState<string>('idle')
  const [data, setData] = useState<string[]>([])
  const scopeRef = useRef<ReturnType<typeof createDisposableScope> | null>(null)

  useEffect(() => {
    const scope = createDisposableScope()
    scopeRef.current = scope

    // This simulates what createDataSource does internally:
    // resilient fetcher + outbox composed together
    const rf = createResilientFetcher<{ data: string[] }>({
      ttlMs: 5000,
      breaker: { failureThreshold: 3, resetMs: 10000 },
    })
    const outbox = createOutbox<{ text: string }>({
      execute: async (m) => {
        console.log('Delivered:', m.text)
      },
      maxAttempts: 3,
    })

    const loadData = async () => {
      setState('loading')
      const result = await rf.fetch('data-source-key', async () => {
        await new Promise((r) => setTimeout(r, 500))
        return { data: [`Item-${Date.now() % 1000}`, `Item-${Date.now() % 2000}`] }
      })
      setData(result?.data ?? [])
      setState('loaded')
    }

    scope.add(() => {
      rf.cache.clear()
      outbox.clear()
    })
    void loadData()

    return () => scope.destroy()
  }, [])

  return (
    <div
      style={{
        padding: 16,
        background: 'var(--iris-surface)',
        borderRadius: 8,
        border: '1px solid var(--iris-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong>Composed Data Source</strong>
        <IrisBadge tone={state === 'loading' ? 'warning' : 'success'} variant="subtle">
          {state}
        </IrisBadge>
      </div>
      <div style={{ fontSize: 13, color: 'var(--iris-muted)', marginBottom: 8 }}>
        ResilientFetcher + Outbox + DisposableScope — what createDataSource uses internally
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
        {data.map((d, i) => (
          <div key={i}>📦 {d}</div>
        ))}
      </div>
    </div>
  )
}

/* ── Main showcase page ─────────────────────────────────────────────────── */

export function DataResilienceShowcase() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section className="section">
        <h2 className="section-title">Data &amp; Resilience Primitives</h2>
        <p style={{ color: 'var(--iris-muted)', fontSize: 14, margin: '0 0 16px' }}>
          All 9 resilience primitives from <code>@iris-ui/core</code> — now wired into real
          consumers. Each demo below runs live in this page.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: 16,
          }}
        >
          <ResilientFetcherDemo />
          <OutboxDemo />
          <RealtimeSourceDemo />
          <DataSourceDemo />
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Primitive Dependency Graph</h2>
        <pre
          style={{
            fontSize: 12,
            fontFamily: 'var(--iris-font-mono, monospace)',
            padding: 16,
            background: 'var(--iris-surface)',
            borderRadius: 8,
            border: '1px solid var(--iris-border)',
            lineHeight: 1.8,
          }}
        >
          {`createDisposableScope  ─── createAsyncResource.destroy()
createEventBus         ─── plugin.ts PluginRegistry
createQueryCache       ─┐
createCircuitBreaker   ─┤── createResilientFetcher ─── createDataSource
createRateLimiter      ─┘
createOutbox           ─────────────────────────────── createDataSource
createReconnectingSource ── CMS RealtimePage demo`}
        </pre>
      </section>
    </div>
  )
}
