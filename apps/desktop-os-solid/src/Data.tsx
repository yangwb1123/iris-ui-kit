import { createSignal, onCleanup, type JSX } from 'solid-js'
import { createReconnectingSource, createDisposableScope } from '@iris-ui-kit/core'
import {
  IrisTable,
  IrisBadge,
  type IrisTableColumn,
  type IrisTableSortState,
} from '@iris-ui-kit/solid'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  role: string
  windows: number
  status: 'running' | 'idle' | 'stopped'
}

const INITIAL: Row[] = [
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

const STATUS_TONE: Record<Row['status'], 'success' | 'warning' | 'neutral'> = {
  running: 'success',
  idle: 'warning',
  stopped: 'neutral',
}

const COLUMNS: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Process', sortable: true },
  { key: 'role', title: 'Role', sortable: true },
  { key: 'windows', title: 'Windows', sortable: true, align: 'right' },
  {
    key: 'status',
    title: 'Status',
    sortable: true,
    renderCell: (row) => (
      <IrisBadge tone={STATUS_TONE[row.status]} variant="subtle">
        {row.status}
      </IrisBadge>
    ),
  },
]

/**
 * Real-time process monitor with IrisTable, powered by createReconnectingSource
 * for live updates. Solid twin of the React DataApp.
 */
export function DataApp(): JSX.Element {
  const [processes, setProcesses] = createSignal<Row[]>(INITIAL)
  const [connectionStatus, setConnectionStatus] = createSignal('idle')
  const [sort, setSort] = createSignal<IrisTableSortState | null>({
    key: 'windows',
    direction: 'desc',
  })

  // Set up real-time source with disposable scope for cleanup
  const scope = createDisposableScope()
  const source = createReconnectingSource<{ pid: number; delta: number }>(
    (sink) => {
      const timer = setTimeout(() => sink.open(), 200)
      const interval = setInterval(
        () => {
          const pid = Math.floor(Math.random() * 9) + 1
          const delta = Math.random() > 0.5 ? 1 : -1
          sink.message({ pid, delta })
        },
        3000 + Math.random() * 2000,
      )
      const disconnecter = setInterval(() => sink.close(), 45_000)
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
            const status: Row['status'] =
              windows > 0 ? 'running' : windows === 0 && p.status === 'stopped' ? 'stopped' : 'idle'
            return { ...p, windows, status }
          }),
        )
      },
      onStatus: (s) => setConnectionStatus(s),
    },
    { backoffMs: 2000, maxBackoffMs: 15000 },
  )

  source.open()
  scope.add(() => source.close())
  onCleanup(() => scope.destroy())

  return (
    <div style={{ padding: '16px', display: 'grid', gap: '12px', color: 'var(--os-window-fg)' }}>
      <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
        <p style={{ margin: 0, opacity: 0.7, 'font-size': '13px' }}>
          Process monitor — updates in real-time via <code>createReconnectingSource</code>.
        </p>
        <span
          style={{
            display: 'inline-flex',
            'align-items': 'center',
            gap: '4px',
            'font-size': '11px',
            opacity: 0.6,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              'border-radius': '50%',
              display: 'inline-block',
              background:
                connectionStatus() === 'open'
                  ? 'var(--iris-success)'
                  : connectionStatus() === 'reconnecting'
                    ? 'var(--iris-warning)'
                    : 'var(--iris-muted)',
            }}
          />
          {connectionStatus()}
        </span>
      </div>
      <IrisTable<Row>
        columns={COLUMNS}
        data={processes()}
        rowKey="id"
        striped
        bordered
        sort={sort()}
        onSortChange={setSort}
      />
    </div>
  )
}
