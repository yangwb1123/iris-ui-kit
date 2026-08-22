<script lang="ts">
  import IrisTable from './IrisTable.svelte'
  import type {
    IrisTableColumn,
    IrisTableColumnWidths,
    IrisTablePersistConfig,
    IrisTableSortState,
  } from './types'

  let {
    persist,
    onSortChange,
    onFiltersChange,
    onColumnWidthsChange,
    onPageChange,
    query,
    pageSize = 10,
    remoteSort = false,
    remoteFilter = false,
    noWidths = false,
  }: {
    persist: IrisTablePersistConfig
    onSortChange?: (value: IrisTableSortState | null) => void
    onFiltersChange?: (next: Record<string, string>) => void
    onColumnWidthsChange?: (next: IrisTableColumnWidths) => void
    onPageChange?: (page: number, pageSize: number) => void
    query?: (
      params: unknown,
    ) => Promise<{ rows: Array<Record<string, unknown>>; total: number }>
    pageSize?: number
    remoteSort?: boolean
    remoteFilter?: boolean
    noWidths?: boolean
  } = $props()

  const columns: IrisTableColumn[] = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'age', title: 'Age', sortable: true, align: 'right' },
  ]
  const rows = [
    { id: 1, name: 'Charlie', age: 25 },
    { id: 2, name: 'Alice', age: 32 },
    { id: 3, name: 'Bob', age: 28 },
  ]

  // Fully CONTROLLED table: every piece is parent-owned through a callback
  // (the table itself holds zero persistence state — exactly what
  // persistState assumes).
  let sort = $state<IrisTableSortState | null>(null)
  let filters = $state<Record<string, string>>({})
  let widths = $state<IrisTableColumnWidths>({})

  // svelte-ignore state_referenced_locally — `query` is fixed per test render.
  const hasProxy = query !== undefined
</script>

<IrisTable
  columns={columns}
  data={hasProxy ? undefined : rows}
  rowKey="id"
  persistState={persist}
  sort={sort}
  onUpdateSort={(next) => {
    sort = next
    onSortChange?.(next)
  }}
  filters={filters}
  onFiltersChange={(next) => {
    filters = next
    onFiltersChange?.(next)
  }}
  columnWidths={noWidths ? undefined : widths}
  onColumnWidthsChange={noWidths
    ? undefined
    : (next) => {
        widths = next
        onColumnWidthsChange?.(next)
      }}
  proxyConfig={hasProxy
    ? {
        query: query!,
        pageSize,
        remoteSort,
        remoteFilter,
        onPageChange: (page, size) => {
          onPageChange?.(page, size)
        },
      }
    : undefined}
/>