import { useEffect, useState } from 'react'
import { createReconnectingSource, createDisposableScope } from '@iris-ui/core'
import { IrisTable, IrisBadge, type IrisTableColumn } from '@iris-ui/react'

interface Process extends Record<string, unknown> {
  id: number
  name: string
  role: string
  windows: number
  status: 'running' | 'idle' | 'stopped'
}

const INITIAL: Process[] = [
  { id: 1, name: 'Compositor', role: 'system', windows: 6, status: 'running' },
  { id: 2, name: 'Window Manager', role: 'system', windows: 6, status: 'running' },
  { id: 3, name: 'Taskbar', role: 'shell', windows: 1, status: 'running' },
  { id: 4, name: 'Notepad', role: 'app', windows: 2, status: 'idle' },
  { id: 5, name: 'Files', role: 'app', windows: 1, status: 'idle' },
  { id: 6, name: 'Iris Showcase', role: 'app', windows: 0, status: 'stopped' },
  { id: 7, name: 'Search Indexer', role: 'service', windows: 0, status: 'idle' },
  { id: 8, name: 'Updater', role: 'service', windows: 0, status: 'stopped' },
  { id: 9, name: 'Clock', role: 'shell', windows: 1, status: 'running' },
]

const STATUS_TONE: Record<Process['status'], 'success' | 'warning' | 'neutral'> = {
  running: 'success',
  idle: 'warning',
  stopped: 'neutral',
}

const COLUMNS: IrisTableColumn<Process>[] = [
  { key: 'name', title: 'Process', sortable: true },
  { key: 'role', title: 'Role', sortable: true },
  { key: 'windows', title: 'Windows', sortable: true, align: 'right' },
  {
    key: 'status',
    title: 'Status',
    sortable: true,
    render: (value) => {
      const status = value as Process['status']
      return (
        <IrisBadge tone={STATUS_TONE[status]} variant="subtle">
          {status}
        </IrisBadge>
      )
    },
  },
]

/**
 * Real-time process monitor with IrisTable, powered by createReconnectingSource
 * for live updates and createDisposableScope for clean teardown.
 */
export function DataApp() {
  const [processes, setProcesses] = useState<Process[]>(INITIAL)
  const [connectionStatus, setConnectionStatus] = useState('idle')

  useEffect(() => {
    const scope = createDisposableScope()

    // Simulate a real-time process update stream
    const source = createReconnectingSource<{ pid: number; delta: number }>(
      (sink) => {
        const timer = setTimeout(() => sink.open(), 200)

        // Simulate random process activity every 3-5 seconds
        const interval = setInterval(
          () => {
            const pid = Math.floor(Math.random() * 9) + 1
            const delta = Math.random() > 0.5 ? 1 : -1
            sink.message({ pid, delta })
          },
          3000 + Math.random() * 2000,
        )

        // Disconnect occasionally to demonstrate reconnection
        const disconnecter = setInterval(() => {
          sink.close()
        }, 45_000)

        return () => {
          clearTimeout(timer)
          clearInterval(interval)
          clearInterval(disconnecter)
        }
      },
      {
        onMessage: ({ pid, delta }) => {
          setProcesses((prev) =>
            prev.map((p) => {
              if (p.id !== pid) return p
              const windows = Math.max(0, (p.windows as number) + delta)
              const status: Process['status'] =
                windows > 0
                  ? 'running'
                  : windows === 0 && p.status === 'stopped'
                    ? 'stopped'
                    : 'idle'
              return { ...p, windows, status }
            }),
          )
        },
        onStatus: (s) => setConnectionStatus(s),
      },
      { backoffMs: 2000, maxBackoffMs: 15_000 },
    )

    source.open()
    // Register cleanup via the disposable scope
    scope.add(() => source.close())
    return () => scope.destroy()
  }, [])

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12, color: 'var(--os-window-fg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
          Process monitor — processes update in real-time via <code>createReconnectingSource</code>.
        </p>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            opacity: 0.6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              display: 'inline-block',
              background:
                connectionStatus === 'open'
                  ? 'var(--iris-success)'
                  : connectionStatus === 'reconnecting'
                    ? 'var(--iris-warning)'
                    : 'var(--iris-muted)',
            }}
          />
          {connectionStatus}
        </span>
      </div>
      <IrisTable<Process>
        columns={COLUMNS}
        data={processes}
        rowKey="id"
        striped
        bordered
        defaultSort={{ key: 'windows', direction: 'desc' }}
      />
    </div>
  )
}
