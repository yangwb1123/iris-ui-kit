import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import { compareValues } from '@iris-ui-kit/core'
import { getCellValue } from './table-helpers'
import type { IrisTableColumn, IrisTableSortState } from './types'

export interface UseTableSortOptions<Row> {
  leafColumns: MaybeRefOrGetter<IrisTableColumn<Row>[]>
  sort?: MaybeRefOrGetter<IrisTableSortState | null | undefined>
  defaultSort?: IrisTableSortState | null
  onSortChange?: (next: IrisTableSortState | null) => void
  /** Multi-column sort mode (vxe sort-config.multiple parity). When on, header
   * cycling appends/removes columns (see {@link cycleMultiSort}) and the sorted
   * data uses the chained multi comparator. Default false. */
  multiSort?: MaybeRefOrGetter<boolean | undefined>
  /** Controlled multi-column sort state (multiSort mode). */
  multiSortState?: MaybeRefOrGetter<IrisTableSortState[] | undefined>
  /** Default multi-column sort (multiSort mode, uncontrolled). */
  defaultMultiSort?: IrisTableSortState[] | undefined
  /** Called when the multi-column sort changes. */
  onMultiSortChange?: (next: IrisTableSortState[]) => void
}

export interface UseTableSortResult<Row> {
  sortState: ComputedRef<IrisTableSortState | null>
  cycleSort: (col: IrisTableColumn<Row>) => void
  setSort: (next: IrisTableSortState | null) => void
  sortComparator: ComputedRef<((a: Row, b: Row) => number) | null>
  sortedData: ComputedRef<Row[]>
  /** Current multi-column sort state (controlled if a `multiSortState` option was provided, else internal). */
  multiSortState: ComputedRef<IrisTableSortState[]>
  /** Cycle a column in multi mode: append asc → asc→desc → remove from the list. */
  cycleMultiSort: (col: IrisTableColumn<Row>) => void
  /** Directly set the multi-column sort list. */
  setMultiSort: (next: IrisTableSortState[]) => void
  /** Multi-column comparator (multiSort mode): per-column comparators chained
   * in click order, first non-zero wins; null when the list is empty. */
  multiSortComparator: ComputedRef<((a: Row, b: Row) => number) | null>
}

/** Per-column comparator: `col.sorter` or a value-based default. Shared by the
 * single and multi sort paths. */
function buildSorter<Row extends Record<string, unknown>>(
  col: IrisTableColumn<Row>,
): (a: Row, b: Row) => number {
  if (col.sorter) return col.sorter
  return (a: Row, b: Row) => compareValues(getCellValue(a, col), getCellValue(b, col))
}

/**
 * Pure multi-column comparator: the per-column comparators chained in click
 * order (most-significant first), first non-zero comparison wins — stable, so
 * ties fall through to the next column, then keep the original order. Returns
 * null when the list is empty or no column resolves.
 */
export function buildMultiSortComparator<Row extends Record<string, unknown>>(
  leafColumns: IrisTableColumn<Row>[],
  state: IrisTableSortState[],
): ((a: Row, b: Row) => number) | null {
  if (state.length === 0) return null
  const colMap = new Map(leafColumns.map((c) => [c.key, c]))
  const chain: Array<{ dir: number; sorter: (a: Row, b: Row) => number }> = []
  for (const s of state) {
    const col = colMap.get(s.key)
    if (!col) continue
    chain.push({ dir: s.direction === 'asc' ? 1 : -1, sorter: buildSorter(col) })
  }
  if (chain.length === 0) return null
  return (a, b) => {
    for (const step of chain) {
      const cmp = step.sorter(a, b)
      if (cmp !== 0) return cmp * step.dir
    }
    return 0
  }
}

/**
 * Vue composable for table sort state management.
 * Handles controlled/uncontrolled sort, comparator generation, and sorted data.
 * In multiSort mode header cycling appends/removes columns (vxe
 * sort-config.multiple parity) and the sorted data uses the chained comparator.
 */
export function useTableSort<Row extends Record<string, unknown>>(
  data: Ref<Row[]>,
  options: UseTableSortOptions<Row>,
): UseTableSortResult<Row> {
  const sortProp = computed(() => (options.sort === undefined ? undefined : toValue(options.sort)))
  const internalSortValue = ref<IrisTableSortState | null>(options.defaultSort ?? null)

  const sortState = computed<IrisTableSortState | null>({
    get: () => (sortProp.value === undefined ? internalSortValue.value : (sortProp.value ?? null)),
    set: (val) => {
      if (sortProp.value === undefined) internalSortValue.value = val
      options.onSortChange?.(val)
    },
  })

  // -------- Multi-column mode (vxe sort-config.multiple parity) --------
  // Array order = click order (most-significant first). Controlled or internal
  // exactly like the single-column state above.
  const multiEnabled = computed(() => toValue(options.multiSort) === true)
  const multiSortProp = computed(() =>
    options.multiSortState === undefined ? undefined : toValue(options.multiSortState),
  )
  const internalMultiSort = ref<IrisTableSortState[]>(options.defaultMultiSort ?? [])

  const multiSortState = computed<IrisTableSortState[]>({
    get: () => (multiSortProp.value === undefined ? internalMultiSort.value : multiSortProp.value),
    set: (val) => {
      if (multiSortProp.value === undefined) internalMultiSort.value = val
      options.onMultiSortChange?.(val)
    },
  })

  const sortComparator = computed<((a: Row, b: Row) => number) | null>(() => {
    const s = sortState.value
    if (!s) return null
    const col = toValue(options.leafColumns).find((c) => c.key === s.key)
    if (!col) return null
    const dir = s.direction === 'asc' ? 1 : -1
    return (a, b) => buildSorter(col)(a, b) * dir
  })

  const multiSortComparator = computed<((a: Row, b: Row) => number) | null>(() =>
    buildMultiSortComparator(toValue(options.leafColumns), multiSortState.value),
  )

  const sortedData = computed<Row[]>(() => {
    // Multi mode uses the chained multi comparator exclusively (an empty list
    // means unsorted); single mode keeps its own comparator — byte-compatible.
    const comparator = multiEnabled.value ? multiSortComparator.value : sortComparator.value
    if (!comparator) return data.value
    return [...data.value].sort(comparator)
  })

  function setSort(next: IrisTableSortState | null): void {
    if (sortProp.value === undefined) internalSortValue.value = next
    options.onSortChange?.(next)
  }

  function cycleSort(col: IrisTableColumn<Row>): void {
    if (!col.sortable) return
    const s = sortState.value
    if (!s || s.key !== col.key) {
      setSort({ key: col.key, direction: 'asc' })
      return
    }
    if (s.direction === 'asc') {
      setSort({ key: col.key, direction: 'desc' })
      return
    }
    setSort(null)
  }

  function setMultiSort(next: IrisTableSortState[]): void {
    if (multiSortProp.value === undefined) internalMultiSort.value = next
    options.onMultiSortChange?.(next)
  }

  // Multi cycle: a column not in the list APPENDS asc; an existing column
  // cycles asc → desc → REMOVE (vxe sort-config.multiple + chronological).
  function cycleMultiSort(col: IrisTableColumn<Row>): void {
    if (!col.sortable) return
    const idx = multiSortState.value.findIndex((s) => s.key === col.key)
    if (idx < 0) {
      setMultiSort([...multiSortState.value, { key: col.key, direction: 'asc' }])
      return
    }
    const next = [...multiSortState.value]
    if (next[idx]!.direction === 'asc') {
      next[idx] = { key: col.key, direction: 'desc' }
      setMultiSort(next)
      return
    }
    next.splice(idx, 1)
    setMultiSort(next)
  }

  return {
    sortState,
    cycleSort,
    setSort,
    sortComparator,
    sortedData,
    multiSortState,
    cycleMultiSort,
    setMultiSort,
    multiSortComparator,
  }
}
