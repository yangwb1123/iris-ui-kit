import { createSignal, type JSX } from 'solid-js'
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

const ROWS: Row[] = [
  { id: 1, name: 'Compositor', role: 'system', windows: 6, status: 'running' },
  { id: 2, name: 'Window Manager', role: 'system', windows: 6, status: 'running' },
  { id: 3, name: 'Taskbar', role: 'shell', windows: 1, status: 'running' },
  { id: 4, name: 'Notepad', role: 'app', windows: 2, status: 'idle' },
  { id: 5, name: 'Files', role: 'app', windows: 1, status: 'idle' },
  { id: 6, name: 'Iris Showcase', role: 'app', windows: 0, status: 'stopped' },
  { id: 7, name: 'Indexer', role: 'service', windows: 0, status: 'idle' },
  { id: 8, name: 'Updater', role: 'service', windows: 0, status: 'stopped' },
]

const STATUS_TONE: Record<Row['status'], 'success' | 'warning' | 'neutral'> = {
  running: 'success',
  idle: 'warning',
  stopped: 'neutral',
}

const COLUMNS: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Process', sortable: true },
  { key: 'role', title: 'Role', sortable: true },
  {
    key: 'windows',
    title: 'Windows',
    sortable: true,
    align: 'right',
  },
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
 * A genuine Iris data grid (`IrisTable`) living inside a managed OS window —
 * sortable columns, a custom `renderCell` cell (status `IrisBadge`), and the
 * table inherits the active desktop skin via `var(--os-*)` tokens. The Solid
 * IrisTable is sort-controlled, so we seed a default sort (windows desc) in a
 * local signal and let the table drive it from there.
 */
export function DataApp(): JSX.Element {
  const [sort, setSort] = createSignal<IrisTableSortState | null>({
    key: 'windows',
    direction: 'desc',
  })
  return (
    <div style={{ padding: '16px', display: 'grid', gap: '12px', color: 'var(--os-window-fg)' }}>
      <p style={{ margin: 0, opacity: 0.7, 'font-size': '13px' }}>
        A real <code>IrisTable</code> — click a column header to sort.
      </p>
      <IrisTable<Row>
        columns={COLUMNS}
        data={ROWS}
        rowKey="id"
        striped
        bordered
        sort={sort()}
        onSortChange={setSort}
      />
    </div>
  )
}
