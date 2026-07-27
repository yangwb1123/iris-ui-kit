<script setup lang="ts">
/**
 * A genuine Iris data grid (`IrisTable`) living inside a managed OS window —
 * sortable columns, a custom STATUS cell (an `IrisBadge`, via the table's
 * `cell.<key>` slot), and the table inherits the active desktop skin through
 * `var(--os-*)` tokens. The Vue twin of the React `DataApp`: same sample rows,
 * adapted to Vue's native slot-based cell API (rather than React's `render`).
 */
import { ref } from 'vue'
import {
  IrisTable,
  IrisBadge,
  type IrisTableColumn,
  type IrisTableSortState,
} from '@iris-ui-kit/vue'

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
  { key: 'windows', title: 'Windows', sortable: true, align: 'right' },
  { key: 'status', title: 'Status', sortable: true },
]

// Initial sort (Vue has no `defaultSort` prop — seed a `v-model:sort` ref).
const sort = ref<IrisTableSortState | null>({ key: 'windows', direction: 'desc' })
</script>

<template>
  <div class="data-pane">
    <p style="margin: 0; opacity: 0.7; font-size: 13px">
      A real <code>IrisTable</code> — click a column header to sort.
    </p>
    <IrisTable
      v-model:sort="sort"
      :columns="COLUMNS as IrisTableColumn[]"
      :data="ROWS"
      row-key="id"
      striped
      bordered
    >
      <template #cell.status="{ value }">
        <IrisBadge :tone="STATUS_TONE[value as Row['status']]" variant="subtle">
          {{ value }}
        </IrisBadge>
      </template>
    </IrisTable>
  </div>
</template>

<style scoped>
.data-pane {
  padding: 16px;
  display: grid;
  gap: 12px;
  color: var(--os-window-fg);
}
</style>
