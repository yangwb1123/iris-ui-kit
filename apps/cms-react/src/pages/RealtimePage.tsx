import { useEffect, useRef, useState } from 'react'
import { createReconnectingSource, type RealtimeSource, type RealtimeStatus } from '@iris-ui/core'
import { IrisBadge } from '@iris-ui/react'

interface StockTick {
  symbol: string
  price: number
  change: number
  time: string
}

const STOCKS: StockTick[] = [
  { symbol: 'IRIS', price: 42.5, change: 0, time: '' },
  { symbol: 'REACT', price: 156.2, change: 0, time: '' },
  { symbol: 'VUE', price: 89.75, change: 0, time: '' },
  { symbol: 'SOLID', price: 28.3, change: 0, time: '' },
  { symbol: 'SVELTE', price: 67.9, change: 0, time: '' },
]

// Simulated WebSocket transport: pushes a random stock tick every 2 seconds.
function createSimulatedTransport(sink: {
  message: (data: StockTick) => void
  open: () => void
  close: () => void
  error: (err: unknown) => void
}): () => void {
  // Simulate initial connection delay
  const openTimer = setTimeout(() => sink.open(), 300)

  // Push a random tick every 2s
  const interval = setInterval(() => {
    const stock = STOCKS[Math.floor(Math.random() * STOCKS.length)]
    const delta = (Math.random() - 0.5) * 4
    sink.message({
      symbol: stock.symbol,
      price: +(stock.price + delta).toFixed(2),
      change: +delta.toFixed(2),
      time: new Date().toLocaleTimeString(),
    })
  }, 2000)

  // Simulate a random disconnect every ~30s to test reconnection
  const disconnectTimer = setInterval(
    () => {
      sink.close()
    },
    30_000 + Math.random() * 15_000,
  )

  return () => {
    clearTimeout(openTimer)
    clearInterval(interval)
    clearInterval(disconnectTimer)
  }
}

function StatusBadge({ status }: { status: RealtimeStatus }) {
  const colorMap: Record<RealtimeStatus, string> = {
    idle: 'var(--iris-muted)',
    connecting: 'var(--iris-warning)',
    open: 'var(--iris-success)',
    reconnecting: 'var(--iris-warning)',
    closed: 'var(--iris-danger)',
  }
  const labelMap: Record<RealtimeStatus, string> = {
    idle: 'Idle',
    connecting: 'Connecting…',
    open: 'Connected',
    reconnecting: 'Reconnecting…',
    closed: 'Closed',
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: colorMap[status],
          display: 'inline-block',
        }}
      />
      {labelMap[status]}
    </span>
  )
}

export function RealtimePage() {
  const [ticks, setTicks] = useState<StockTick[]>([])
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [attempts, setAttempts] = useState(0)
  const sourceRef = useRef<RealtimeSource | null>(null)

  useEffect(() => {
    const source = createReconnectingSource<StockTick>(
      (sink) => createSimulatedTransport(sink),
      {
        onMessage: (tick) => {
          setTicks((prev) => [tick, ...prev].slice(0, 50))
        },
        onStatus: (s) => {
          setStatus(s)
          setAttempts(source.attempts)
        },
        onError: (err) => console.error('[realtime]', err),
      },
      { backoffMs: 1000, maxBackoffMs: 10_000, maxRetries: 10 },
    )

    sourceRef.current = source
    source.open()

    return () => source.close()
  }, [])

  const latest: Record<string, StockTick> = {}
  for (const t of ticks) {
    if (!latest[t.symbol]) latest[t.symbol] = t
  }

  return (
    <div data-page="realtime" style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Realtime Data</h2>
        <StatusBadge status={status} />
        {status === 'reconnecting' && (
          <span style={{ fontSize: 12, color: 'var(--iris-muted)' }}>attempt {attempts}</span>
        )}
      </div>
      <p style={{ margin: '0 0 20px', color: 'var(--iris-muted)', fontSize: 14 }}>
        Live stock ticker powered by <code>createReconnectingSource</code> with exponential backoff
        reconnection. A simulated transport pushes a random tick every 2s and disconnects
        periodically to demonstrate automatic reconnect.
      </p>

      {/* Live stock prices */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {STOCKS.map((s) => {
          const live = latest[s.symbol]
          const price = live?.price ?? s.price
          const change = live?.change ?? 0
          const isUp = change >= 0
          return (
            <div
              key={s.symbol}
              style={{
                padding: 16,
                background: 'var(--iris-surface)',
                borderRadius: 'var(--iris-radius-md, 6px)',
                border: '1px solid var(--iris-border)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{s.symbol}</div>
              <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                ${price.toFixed(2)}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: isUp ? 'var(--iris-success)' : 'var(--iris-danger)',
                  fontWeight: 500,
                }}
              >
                {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Event log */}
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
        Event Log{' '}
        <IrisBadge tone="neutral" variant="subtle">
          {ticks.length} ticks
        </IrisBadge>
      </div>
      <div
        style={{
          maxHeight: 300,
          overflow: 'auto',
          fontSize: 13,
          fontFamily: 'var(--iris-font-mono, monospace)',
          background: 'var(--iris-surface)',
          borderRadius: 'var(--iris-radius-md, 6px)',
          border: '1px solid var(--iris-border)',
          padding: 8,
        }}
      >
        {ticks.length === 0 ? (
          <div style={{ color: 'var(--iris-muted)', padding: 16, textAlign: 'center' }}>
            Waiting for data…
          </div>
        ) : (
          ticks.map((t, i) => (
            <div key={i} style={{ padding: '2px 4px', display: 'flex', gap: 12 }}>
              <span style={{ color: 'var(--iris-muted)', minWidth: 70 }}>{t.time}</span>
              <span style={{ fontWeight: 600, minWidth: 60 }}>{t.symbol}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 70 }}>
                ${t.price.toFixed(2)}
              </span>
              <span style={{ color: t.change >= 0 ? 'var(--iris-success)' : 'var(--iris-danger)' }}>
                {t.change >= 0 ? '+' : ''}
                {t.change.toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
