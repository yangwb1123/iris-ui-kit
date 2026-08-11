import {
  createEffect,
  createMemo,
  createSignal,
  For,
  mergeProps,
  on,
  onCleanup,
  onMount,
  Show,
  type Accessor,
  type JSX,
} from 'solid-js'
import { Portal } from 'solid-js/web'
import {
  aggregate,
  buildFormValues,
  buildHeaderMatrix,
  compareValues,
  computeVirtualRange,
  createCellRange,
  createExpansion,
  createRemoteTableSource,
  createSelectionModel,
  createSortable,
  flattenLeafColumns,
  flattenTree,
  mergeFormFilters,
  withSortedChildren,
  nextGridCell,
  seedFormValues,
  type ExpansionModel,
  type GridNavKey,
  type HeaderCell,
  type RemoteTableSource,
  type RemoteTableSourceState,
  type SortableRect,
  type TreeRow,
  validateEditRulesAsync,
} from '@iris-ui-kit/core'
import { useStore } from '../../useStore'
import { useI18n } from '../../i18n'
import { useDrag } from '../drag/useDrag'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { IrisVirtualScroll } from '../virtual-scroll/IrisVirtualScroll'
import { IrisPagination } from '../pagination'
import { IrisButton } from '../button'
import { IrisFormField } from '../form-field'
import { IrisInput } from '../input'
import { IrisSelect } from '../select'
import type { IrisTableProps } from './props'
import type {
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableContextMenuItem,
  IrisTableContextMenuParams,
  IrisTableFilterOption,
  IrisTableSortState,
} from './types'
import { useTableSort } from './useTableSort'

export type { IrisTableProps } from './props'

const DEFAULT_COL_WIDTH = 140
const DEFAULT_MIN_WIDTH = 60
const RESIZE_STEP = 16
const DRAG_COL_WIDTH = 40

/**
 * Fold the checked filter sets into the query filter map as comma-joined
 * strings (vxe filter-multiple remote serialization parity). Keys with an
 * empty checked set are left untouched.
 */
function mergeFilterValues(
  filters: Record<string, string>,
  filterValues: Record<string, string[]>,
): Record<string, string> {
  const next = { ...filters }
  for (const [key, values] of Object.entries(filterValues)) {
    if (values.length > 0) next[key] = values.join(',')
  }
  return next
}

/** One open row-edit session (vxe editConfig.mode='row' parity): its own
 * draft/error pair, resolved at commit time against the current row. */
interface RowCellSession<Row extends Record<string, unknown>> {
  col: IrisTableColumn<Row>
  rowIndex: number
  draft: Accessor<string>
  error: Accessor<string | null>
  setDraft: (value: string) => void
  setError: (value: string | null) => void
  /** Monotonic session epoch (core `sessionGen` parity, batch AB fix): bumped
   * on cancel/commit so an in-flight async (editRules) commit can detect it
   * was cancelled or superseded while its validation promise was pending. */
  gen: number
}

/**
 * Floating right-click menu for `IrisTable` (vxe-grid contextMenu parity).
 * Self-drawn with the same building blocks `IrisMenuContent` uses —
 * `useFloating` + `useDismiss` — because the anchor is a VIRTUAL element at
 * the cursor (zero-size rect), so the menu's top-left lands exactly on the
 * cursor (flip/shift disabled deliberately). Dismissal: Escape, outside
 * pointer-down, and any scroll (capture-phase document listener — nested
 * scrollers count too). Portaled to `document.body` so the table's `overflow`
 * clipping never cuts it.
 */
function TableContextMenu<Row extends Record<string, unknown>>(props: {
  open: boolean
  /** Virtual anchor accessor: a fake element whose getBoundingClientRect
   * returns the zero-size cursor rect (fresh identity per open). */
  anchor: Accessor<HTMLElement | null>
  items: IrisTableContextMenuItem[]
  params: IrisTableContextMenuParams<Row>
  onSelect: (key: string, params: IrisTableContextMenuParams<Row>) => void
  onClose: () => void
}): JSX.Element {
  const [menuEl, setMenuEl] = createSignal<HTMLDivElement | null>(null)

  const { floatingStyles } = useFloating({
    anchor: props.anchor,
    floating: menuEl,
    open: () => props.open,
    placement: 'bottom-start',
    flip: false,
    shift: false,
  })

  useDismiss({
    enabled: () => props.open,
    exclude: [menuEl],
    onDismiss: props.onClose,
  })

  // Scroll anywhere closes the menu. Capture phase so scrolling inside any
  // nested scroll container (or the table itself) also counts.
  createEffect(() => {
    if (!props.open || typeof document === 'undefined') return
    const onScroll = (): void => props.onClose()
    document.addEventListener('scroll', onScroll, true)
    onCleanup(() => document.removeEventListener('scroll', onScroll, true))
  })

  return (
    <Show when={props.open}>
      <Portal>
        <div
          ref={setMenuEl}
          role="menu"
          data-iris-table-context-menu=""
          style={{
            ...floatingStyles(),
            'z-index': 'var(--iris-z-popover, 1000)',
            background: 'var(--iris-surface-floating, var(--iris-surface))',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            'box-shadow': 'var(--iris-shadow-lg)',
            padding: 'var(--iris-padding-sm, 4px)',
            'min-width': '160px',
            display: 'flex',
            'flex-direction': 'column',
          }}
        >
          <For each={props.items}>
            {(item) => (
              <button
                type="button"
                role="menuitem"
                data-iris-table-context-menu-item={item.key}
                disabled={item.disabled}
                aria-disabled={item.disabled ? 'true' : undefined}
                onClick={() => {
                  props.onSelect(item.key, props.params)
                  props.onClose()
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: item.disabled ? 'default' : 'pointer',
                  color: item.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                  font: 'inherit',
                  'text-align': 'start',
                  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                }}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>
      </Portal>
    </Show>
  )
}

/**
 * Header filter panel for `IrisTable` (vxe-grid filterConfig parity).
 * Anchored to the real trigger button (`placement: bottom-start`), dismissed
 * via Escape / outside pointer-down / any scroll, portaled to body. Draft
 * semantics: checking options edits a local draft; 确认 (confirm) writes it
 * through `onApply`, 清除 (clear) writes an empty set immediately, and any
 * dismissal discards the draft. The parent renders this inside a KEYED Show
 * per open, so `initialChecked` always re-seeds from the applied `filterValues`.
 */
function TableFilterPanel(props: {
  open: boolean
  anchor: Accessor<HTMLButtonElement | null>
  columnKey: string
  options: IrisTableFilterOption[]
  /** Checked values when the panel opened (seeded once; draft semantics). */
  initialChecked: string[]
  /** Confirm writes the draft (and closes). */
  onApply: (columnKey: string, values: string[]) => void
  /** Clear applies an empty set immediately (and closes). */
  onClear: (columnKey: string) => void
  onClose: () => void
  t: (key: string) => string
}): JSX.Element {
  const [panelEl, setPanelEl] = createSignal<HTMLDivElement | null>(null)
  const [checked, setChecked] = createSignal<string[]>(props.initialChecked)

  const { floatingStyles } = useFloating({
    anchor: props.anchor,
    floating: panelEl,
    open: () => props.open,
    placement: 'bottom-start',
  })

  useDismiss({
    enabled: () => props.open,
    exclude: [panelEl, props.anchor],
    onDismiss: props.onClose,
  })

  // Scroll anywhere closes the panel (capture phase — nested scrollers too).
  createEffect(() => {
    if (!props.open || typeof document === 'undefined') return
    const onScroll = (): void => props.onClose()
    document.addEventListener('scroll', onScroll, true)
    onCleanup(() => document.removeEventListener('scroll', onScroll, true))
  })

  const toggle = (value: string): void => {
    setChecked((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  return (
    <Show when={props.open}>
      <Portal>
        <div
          ref={setPanelEl}
          role="dialog"
          aria-label={props.t('table.filter')}
          data-iris-table-filter-panel=""
          data-iris-table-filter-column={props.columnKey}
          style={{
            ...floatingStyles(),
            'z-index': 'var(--iris-z-popover, 1000)',
            background: 'var(--iris-surface-floating, var(--iris-surface))',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            'box-shadow': 'var(--iris-shadow-lg)',
            padding: 'var(--iris-space-sm, 12px)',
            'min-width': '180px',
            display: 'flex',
            'flex-direction': 'column',
            gap: 'var(--iris-space-xxs, 4px)',
          }}
        >
          <For each={props.options}>
            {(opt) => (
              <div
                data-iris-filter-option={opt.value}
                style={{ display: 'flex', 'align-items': 'center' }}
              >
                <label
                  style={{
                    display: 'inline-flex',
                    'align-items': 'center',
                    gap: 'var(--iris-space-xxs, 4px)',
                    cursor: 'pointer',
                    'font-size': 'var(--iris-font-size-sm, 13px)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked().includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                  />
                  {opt.label}
                </label>
              </div>
            )}
          </For>
          <div
            style={{
              display: 'flex',
              'justify-content': 'flex-end',
              gap: 'var(--iris-space-xs, 8px)',
              'margin-top': 'var(--iris-space-xs, 8px)',
            }}
          >
            <button
              type="button"
              data-iris-filter-clear=""
              onClick={() => {
                props.onClear(props.columnKey)
                props.onClose()
              }}
              style={{
                border: '1px solid var(--iris-border)',
                background: 'transparent',
                color: 'var(--iris-foreground)',
                cursor: 'pointer',
                font: 'inherit',
                'font-size': 'var(--iris-font-size-sm, 13px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                'border-radius': 'var(--iris-radius-sm, 4px)',
              }}
            >
              {props.t('table.filterClear')}
            </button>
            <button
              type="button"
              data-iris-filter-confirm=""
              onClick={() => {
                props.onApply(props.columnKey, checked())
                props.onClose()
              }}
              style={{
                border: '1px solid var(--iris-primary)',
                background: 'var(--iris-primary)',
                color: 'var(--iris-primary-foreground, #fff)',
                cursor: 'pointer',
                font: 'inherit',
                'font-size': 'var(--iris-font-size-sm, 13px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                'border-radius': 'var(--iris-radius-sm, 4px)',
              }}
            >
              {props.t('table.filterConfirm')}
            </button>
          </div>
        </div>
      </Portal>
    </Show>
  )
}

/** Null-proxy snapshot (a STABLE reference is required for the signal seed). */
const EMPTY_PROXY_STATE: RemoteTableSourceState<never> = {
  data: [],
  total: 0,
  loading: false,
  error: null,
  params: { page: 1, pageSize: 10, sort: null, filters: {} },
}

function resolveInitialWidth(col: IrisTableColumn<Record<string, unknown>>): number {
  if (typeof col.width === 'number') return col.width
  if (typeof col.width === 'string') {
    const m = col.width.match(/^(\d+(?:\.\d+)?)px$/)
    if (m) return Number(m[1])
  }
  return DEFAULT_COL_WIDTH
}

function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

/**
 * Focusable resize grip at a column header's trailing edge. Pointer drag (via
 * `useDrag`) or Arrow-Left/Right adjusts the column's pixel width, min/max
 * clamped. `role="separator"` + `aria-orientation` follow the WAI-ARIA
 * window-splitter pattern. Solid mirror of the React `ColumnResizeHandle`.
 */
function ColumnResizeHandle(props: {
  colKey: string
  label: string
  /** Reads the column's current resolved width at drag/keypress time. */
  width: () => number
  minWidth: number
  maxWidth: number
  onResize: (key: string, width: number) => void
}): JSX.Element {
  const [handle, setHandle] = createSignal<HTMLElement | null>(null)
  let startWidth = 0
  const clamp = (w: number): number =>
    Math.max(props.minWidth, Math.min(props.maxWidth, Math.round(w)))

  useDrag({
    handle,
    onStart: () => {
      startWidth = props.width()
    },
    onDrag: ({ dx }) => props.onResize(props.colKey, clamp(startWidth + dx)),
  })

  return (
    <span
      ref={setHandle}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${props.label}`}
      tabindex={0}
      data-iris-table-resize-handle=""
      data-column-key={props.colKey}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          props.onResize(props.colKey, clamp(props.width() - RESIZE_STEP))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          props.onResize(props.colKey, clamp(props.width() + RESIZE_STEP))
        }
      }}
      style={{
        position: 'absolute',
        top: '0',
        right: '0',
        bottom: '0',
        width: '8px',
        cursor: 'col-resize',
        'touch-action': 'none',
        'user-select': 'none',
      }}
    />
  )
}

/**
 * Data table. Renders as a CSS-grid layout. Supports sorting, row selection,
 * and inline editing. Opt-in virtual scrolling windows the body (flat AND tree
 * rows, which are uniform height) unless `renderDetail` is also set (detail
 * panels are variable-height). Solid port of the Vue IrisTable.
 */
export function IrisTable<Row extends Record<string, unknown> = Record<string, unknown>>(
  props: IrisTableProps<Row>,
): JSX.Element {
  const merged = mergeProps(
    {
      rowKey: 'id',
      selectable: 'none' as 'none' | 'single' | 'multi',
      striped: false,
      bordered: true,
      loading: false,
      error: false,
      resizableColumns: false,
      keyboardNavigation: false,
      cellRange: false,
      editConfig: undefined as import('./types').IrisTableEditConfig | undefined,
      columnVirtualization: false,
      multiSort: false,
      seq: false,
    },
    props,
  )

  const { t } = useI18n()

  // ---- Column visibility (vxe columnConfig.visible parity) ----------------
  // Filter hidden columns out of every render path (header, body, summary).
  // Reference-preserving: without the prop the result IS `columns`, so the
  // flat path is byte-identical with the pre-visibility render path.
  const displayColumns = createMemo<IrisTableColumn<Row>[]>(() => {
    const vis = props.columnVisibility
    if (vis === undefined) return merged.columns
    return merged.columns.filter((c) => vis[c.key] !== false)
  })

  // ---- Multi-level (grouped) headers ----
  // A column with `children` forms a header GROUP spanning its leaf descendants;
  // the leaves drive the body. When nothing is grouped, `leafColumns` is the
  // original `displayColumns` (same reference → flat path is byte-identical) and
  // `headerMatrix` is null (the single-row header renders unchanged).
  const grouped = createMemo(() =>
    displayColumns().some((c) => c.children && c.children.length > 0),
  )
  const leafColumns = createMemo<IrisTableColumn<Row>[]>(() =>
    grouped() ? flattenLeafColumns(displayColumns()) : displayColumns(),
  )
  const headerMatrix = createMemo<HeaderCell<IrisTableColumn<Row>>[][] | null>(() =>
    grouped() ? buildHeaderMatrix(displayColumns()) : null,
  )

  // ---- Column widths (opt-in resizing) ----
  // Uncontrolled widths live in `internalWidths`, seeded from each LEAF column's
  // resolved width (a header-group column carries no body width; only its leaves
  // do) plus any `defaultColumnWidths` override. Controlled tables render from
  // the `columnWidths` prop. `effectiveWidths()` is the map the grid template +
  // column virtualization read; in the off/unset case it still resolves to each
  // column's natural width, so the rendered grid is unchanged from before.
  const [internalWidths, setInternalWidths] = createSignal<IrisTableColumnWidths>({
    ...(props.defaultColumnWidths ?? {}),
  })
  // Seed any not-yet-seen leaf column on column change (keeps existing entries,
  // including user-resized + defaultColumnWidths values).
  createEffect(() => {
    const cols = leafColumns()
    setInternalWidths((prev) => {
      let changed = false
      const seeded = { ...prev }
      for (const col of cols) {
        if (seeded[col.key] === undefined) {
          seeded[col.key] = resolveInitialWidth(col as IrisTableColumn<Record<string, unknown>>)
          changed = true
        }
      }
      return changed ? seeded : prev
    })
  })
  const widthsControlled = (): boolean => props.columnWidths !== undefined
  const effectiveWidths = (): IrisTableColumnWidths =>
    widthsControlled() ? props.columnWidths! : internalWidths()
  const widthOf = (col: IrisTableColumn<Row>): number =>
    effectiveWidths()[col.key] ??
    resolveInitialWidth(col as IrisTableColumn<Record<string, unknown>>)
  const setColumnWidths = (next: IrisTableColumnWidths): void => {
    if (!widthsControlled()) setInternalWidths(next)
    merged.onColumnWidthsChange?.(next)
  }

  // ---- Server-side proxy (vxe-grid proxyConfig parity, query slice) -------
  // The controller lives in a plain closure variable created ONCE per proxy
  // PRESENCE — an inline proxyConfig object with a fresh identity each render
  // never destroys/recreates it — and is torn down when the proxy disappears
  // or the component unmounts, so a late response never writes back to a dead
  // instance. State flows controller → signal via store subscribe (the same
  // bridge pattern as selection / expansion / cell-range). Effects never run
  // during renderToString, so the first fetch is SSR-safe by construction.
  const hasProxy = (): boolean => props.proxyConfig !== undefined
  const remoteSort = (): boolean => props.proxyConfig?.remoteSort === true
  const remoteFilter = (): boolean => props.proxyConfig?.remoteFilter === true
  const proxyPresence = createMemo(() => hasProxy())
  let proxy: RemoteTableSource<Row> | null = null
  let proxyUnsub: (() => void) | null = null
  const [proxyState, setProxyState] = createSignal<RemoteTableSourceState<Row>>(
    EMPTY_PROXY_STATE as RemoteTableSourceState<Row>,
  )
  createEffect(
    on(proxyPresence, (present) => {
      if (!present) {
        proxyUnsub?.()
        proxyUnsub = null
        proxy?.destroy()
        proxy = null
        setProxyState(EMPTY_PROXY_STATE as RemoteTableSourceState<Row>)
        return
      }
      if (proxy) return
      proxy = createRemoteTableSource<Row>({
        // The latest query closure is read at request time, so a parent that
        // swaps the query never leaves a stale closure behind.
        query: (params) => props.proxyConfig!.query(params),
        // Kicked below — never fire a fetch during render.
        autoLoad: false,
        initialParams: {
          page: props.proxyConfig?.defaultPage ?? 1,
          pageSize: props.proxyConfig?.pageSize ?? 10,
          sort: remoteSort()
            ? ((props.sort !== undefined ? props.sort : props.defaultSort) ?? null)
            : null,
          sorts:
            remoteSort() && merged.multiSort
              ? (props.multiSortState ?? props.defaultMultiSort ?? [])
              : undefined,
          filters: remoteFilter()
            ? mergeFilterValues(mergeFormFilters(props.filters ?? {}, {}), props.filterValues ?? {})
            : {},
        },
      })
      setProxyState(proxy.getState())
      proxyUnsub = proxy.subscribe((s) => setProxyState(s))
      onCleanup(() => {
        proxyUnsub?.()
        proxyUnsub = null
        proxy?.destroy()
        proxy = null
      })
      if (props.proxyConfig?.autoLoad !== false) void proxy.request()
    }),
  )
  // Proxy rows feed the table as the data source; a new page/refetch
  // reference replaces them wholesale. Local edit write-backs (below) stick
  // until then (React liveData parity).
  const [proxyRows, setProxyRows] = createSignal<Row[]>([])
  createEffect(() => {
    setProxyRows(proxyState().data)
  })
  // ---- Local row-list override (rowDrag reorder / loadData) ---------------
  // A local signal holding rows the table renders INSTEAD of the prop/proxy
  // source. A controlled `data` re-feed (NEW reference) clears the override so
  // the prop wins again (vue batch-Y parity); the same-reference case keeps
  // the local rows. In proxy mode the override also clears on reloadData so a
  // refetch replaces the page wholesale.
  const [localRows, setLocalRows] = createSignal<Row[] | null>(null)
  createEffect(
    on(
      () => props.data,
      () => {
        // Runs only when the parent re-feeds `data` with a NEW reference — the
        // callback's localRows() read must NOT re-trigger this effect (it lives
        // inside the `on` source-scoped callback), or loadData would clear its
        // own override.
        if (localRows() !== null) setLocalRows(null)
      },
    ),
  )
  // A NEW proxy query result reference replaces the page wholesale — drop any
  // local override (loadData / rowDrag reorder) so the table renders the fresh
  // page (vue proxy liveData parity; batch AB fix): a pager page change must
  // never leave stale rows on screen while the pager shows the new page. The
  // engine only swaps `data` on a landed fetch, so loading flips never clear.
  let lastProxyDataRef: Row[] | undefined
  createEffect(() => {
    const data = proxyState().data
    if (data !== lastProxyDataRef) {
      lastProxyDataRef = data
      if (localRows() !== null) setLocalRows(null)
    }
  })
  const baseData = createMemo<Row[]>(() => {
    if (localRows() !== null) return localRows()!
    if (hasProxy()) return proxyRows()
    return props.data ?? []
  })
  // Proxy mode drives the table's loading/error UI from the controller state
  // (reusing the existing loading/error props rendering below).
  const tableLoading = createMemo<boolean>(() => {
    const s = proxyState()
    return hasProxy() ? s.loading : merged.loading
  })
  const tableError = createMemo<boolean>(() => {
    const s = proxyState()
    return hasProxy() ? s.error !== null : merged.error
  })

  // ---- Multi-column sort (vxe sort-config.multiple parity) ----------------
  // Array order = click order (most-significant first). React parity: a
  // column not in the list APPENDS asc; an existing column cycles
  // asc → desc → REMOVE.
  const multiControlled = (): boolean => props.multiSortState !== undefined
  const [multiInternal, setMultiInternal] = createSignal<IrisTableSortState[]>(
    props.defaultMultiSort ?? [],
  )
  const multiSortState = createMemo<IrisTableSortState[]>(() =>
    multiControlled() ? (props.multiSortState ?? []) : multiInternal(),
  )
  const setMultiSort = (next: IrisTableSortState[]): void => {
    if (!multiControlled()) setMultiInternal(next)
    merged.onMultiSortChange?.(next)
    // remoteSort parity (multi mode): the FULL sort list re-queries the
    // server; the single `sort` param stays the single-column channel.
    if (remoteSort()) proxy?.setParams({ sorts: next })
  }
  const multiSortComparator = createMemo<((a: Row, b: Row) => number) | null>(() => {
    const list = multiSortState()
    if (list.length === 0) return null
    const colMap = new Map(leafColumns().map((c) => [c.key, c]))
    const chain: Array<{ dir: number; sorter: (a: Row, b: Row) => number }> = []
    for (const s of list) {
      const col = colMap.get(s.key)
      if (!col) continue
      chain.push({
        dir: s.direction === 'asc' ? 1 : -1,
        sorter:
          col.sorter ??
          ((a: Row, b: Row) => compareValues(getCellValue(a, col), getCellValue(b, col))),
      })
    }
    if (chain.length === 0) return null
    return (a, b) => {
      for (const step of chain) {
        const cmp = step.sorter(a, b)
        if (cmp !== 0) return cmp * step.dir
      }
      return 0
    }
  })
  const cycleMultiSort = (col: IrisTableColumn<Row>): void => {
    if (!col.sortable) return
    const idx = multiSortState().findIndex((s) => s.key === col.key)
    if (idx < 0) {
      setMultiSort([...multiSortState(), { key: col.key, direction: 'asc' }])
      return
    }
    const next = [...multiSortState()]
    if (next[idx]!.direction === 'asc') {
      next[idx] = { key: col.key, direction: 'desc' }
      setMultiSort(next)
      return
    }
    next.splice(idx, 1)
    setMultiSort(next)
  }

  // ---- Sort (useTableSort) ----
  const {
    sortState: effectiveSort,
    cycleSort,
    setSort,
    sortComparator,
    sortedData: singleSorted,
  } = useTableSort<Row>(baseData, {
    leafColumns,
    sort: () => props.sort,
    defaultSort: props.defaultSort,
    onSortChange: (next) => {
      merged.onSortChange?.(next)
      // remoteSort parity: sort changes re-query the server (page resets to 1
      // in the core controller, vxe behavior).
      if (remoteSort()) proxy?.setParams({ sort: next })
    },
  })
  // remoteSort parity: the server owns the ordering — never re-sort locally.
  // Multi mode uses the chained multi comparator exclusively (an empty list
  // means unsorted); single mode keeps the single comparator.
  const sortedRows = createMemo<Row[]>(() => {
    if (remoteSort()) return baseData()
    if (merged.multiSort) {
      const compare = multiSortComparator()
      if (!compare) return baseData()
      return [...baseData()].sort(compare)
    }
    return singleSorted()
  })
  // Sortable header click: multi mode appends/cycles the list, single mode
  // keeps the asc → desc → none cycle — both routed through one entry point.
  const cycleHeaderSort = (col: IrisTableColumn<Row>): void => {
    if (merged.multiSort) cycleMultiSort(col)
    else cycleSort(col)
  }
  const handleHeaderClick = (column: IrisTableColumn<Row>): void => {
    cycleHeaderSort(column)
  }
  // remoteSort parity: hand the active sort state to the server. Core
  // setParams dedupes unchanged params, so the click path (pushed via the
  // onSortChange / onMultiSortChange wrappers above) does not double-request.
  createEffect(() => {
    const present = proxyPresence()
    const single = effectiveSort()
    const multi = multiSortState()
    if (!present || !remoteSort()) return
    if (merged.multiSort) proxy?.setParams({ sorts: multi })
    else proxy?.setParams({ sort: single ?? null })
  })

  // ---- Search form (vxe-grid formConfig parity) ---------------------------
  // Draft/applied two-state: keystrokes only touch the DRAFT (never trigger a
  // query); submit/reset promote the built values into the APPLIED filters.
  // The draft is seeded from field defaultValue and re-seeded only when the
  // field set (or a default) actually changes, so an inline formConfig object
  // with a fresh identity each render never wipes user input.
  const [formDraft, setFormDraft] = createSignal<Record<string, string>>(
    seedFormValues(props.formConfig?.fields),
  )
  const [formApplied, setFormApplied] = createSignal<Record<string, string>>({})
  const formFieldSignature = createMemo(() =>
    (props.formConfig?.fields ?? []).map((f) => `${f.key}=${f.defaultValue ?? ''}`).join('\u0000'),
  )
  createEffect(() => {
    // Re-seed only when the field signature actually changes.
    formFieldSignature()
    setFormDraft(seedFormValues(props.formConfig?.fields))
    setFormApplied({})
  })
  const setFormValue = (key: string, value: string): void => {
    setFormDraft((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }
  const mergedProxyFilters = (form: Record<string, string>): Record<string, string> =>
    mergeFormFilters(props.filters ?? {}, form)
  const handleFormSubmit = (e: Event): void => {
    e.preventDefault()
    const values = buildFormValues(props.formConfig?.fields, formDraft())
    props.formConfig?.onSearch?.(values)
    setFormApplied(values)
    // Proxy mode: the server owns filtering — merge the form values into the
    // controller filters (page resets to 1 in core applyParams, vxe behavior).
    if (proxy) {
      void proxy.setParams({
        filters: mergeFilterValues(mergedProxyFilters(values), props.filterValues ?? {}),
        page: 1,
      })
    }
  }
  const handleFormReset = (e: Event): void => {
    e.preventDefault()
    const defaults = seedFormValues(props.formConfig?.fields)
    setFormDraft(defaults)
    const values = buildFormValues(props.formConfig?.fields, defaults)
    setFormApplied(values)
    props.formConfig?.onReset?.(values)
    if (proxy) {
      // setParams returns false when the merged params are unchanged (e.g.
      // filters already cleared) — a reset must still re-query, so force a
      // refetch only in that no-op case (no double request when it changed).
      if (
        proxy.setParams({
          filters: mergeFilterValues(mergedProxyFilters(values), props.filterValues ?? {}),
          page: 1,
        }) === false
      ) {
        void proxy.refetch()
      }
    }
  }
  // remoteFilter parity: hand the filter map to the server and never hide
  // rows client-side (vxe proxyConfig.filter). Form values are merged in so a
  // later `filters` prop change from the parent does not silently drop the
  // applied search. (Core setParams dedupes unchanged params.)
  createEffect(() => {
    const present = proxyPresence()
    const f = props.filters
    const applied = formApplied()
    if (!present || !remoteFilter()) return
    proxy?.setParams({
      filters: mergeFilterValues(mergeFormFilters(f ?? {}, applied), props.filterValues ?? {}),
    })
  })

  const rowId = (row: Row, index: number): string | number => {
    const v = row[merged.rowKey]
    if (typeof v === 'string' || typeof v === 'number') return v
    return index
  }

  // ---- Expandable detail rows ----
  // A leading toggle column + a full-width detail panel, driven by the
  // framework-agnostic createExpansion (multiple-open). Keys are strings. The
  // same expansion model is reused by tree mode (below) — they're mutually
  // exclusive (renderDetail vs getSubRows).
  const hasDetail = (): boolean => props.renderDetail !== undefined
  const expansion: ExpansionModel = createExpansion({
    mode: 'multiple',
    defaultExpanded: (props.defaultExpandedRowKeys ?? []).map(String),
    onChange: (keys) => props.onExpandedRowsChange?.(keys),
  })
  const expandedKeys = useStore(expansion.store)
  const isRowExpandable = (row: Row, idx: number): boolean =>
    hasDetail() && (props.rowExpandable ? props.rowExpandable(row, idx) : true)

  // ---- Tree rows ----
  // Opt-in via getSubRows: flatten the (root) data into the visible flat list,
  // honoring the (shared) expansion model. `bodyRows` is what the body, the
  // select-all set, and the summary aggregate over; in flat mode it is identical
  // to sortedRows() (each row carries no tree meta).
  // ---- Client-side filters (vxe filterConfig parity, local mode) ---------
  // Core substring semantics applied to the sorted data before tree flattening
  // (flat mode). With remoteFilter the server owns filtering — rows are never
  // hidden locally. The search form's applied values merge over the `filters`
  // prop (form wins, neither input is mutated); in proxy mode the server owns
  // form filtering, so only the prop map filters the loaded page. The result
  // is reference-preserving when no filter is active.
  const filteredData = createMemo<Row[]>(() => {
    if (remoteFilter()) return sortedRows()
    const mergedF = hasProxy()
      ? (props.filters ?? {})
      : mergeFormFilters(props.filters ?? {}, formApplied())
    const active = Object.entries(mergedF).filter(([, v]) => v != null && v !== '')
    // Batch AB: per-column checked sets OR-match the raw String(value); a set
    // applies only when non-empty. AND-ed with the text channel below.
    const checkedEntries = Object.entries(props.filterValues ?? {}).filter(
      ([, values]) => values.length > 0,
    )
    if (active.length === 0 && checkedEntries.length === 0) return sortedRows()
    return sortedRows().filter((row) => {
      const textOk = active.every(([key, value]) => {
        const col = displayColumns().find((c) => c.key === key)
        if (!col) return true
        const raw = getCellValue(row, col)
        if (col.filterMethod) return col.filterMethod(raw, row, value)
        return String(raw ?? '')
          .toLowerCase()
          .includes(value.toLowerCase())
      })
      const setsOk = checkedEntries.every(([key, values]) => {
        const col = displayColumns().find((c) => c.key === key)
        if (!col) return true
        return values.includes(String(getCellValue(row, col) ?? ''))
      })
      return textOk && setsOk
    })
  })
  // Tree children sort by the same comparator as the roots: multi mode chains
  // the multi comparator, single mode keeps the single one.
  const treeComparator = createMemo(() =>
    merged.multiSort ? multiSortComparator() : sortComparator(),
  )
  const flatTree = createMemo<Array<TreeRow<Row>> | null>(() => {
    if (props.getSubRows === undefined) return null
    const keys = expandedKeys()
    const compare = treeComparator()
    return flattenTree<Row>(filteredData(), {
      getKey: (r) => String(rowId(r, 0)),
      // With an active sort, sort each level's children by the same comparator
      // so the whole tree reorders hierarchically.
      getChildren: compare
        ? withSortedChildren((r: Row) => props.getSubRows!(r), compare)
        : (r) => props.getSubRows!(r),
      isExpanded: (k) => keys.includes(k),
    })
  })
  // Body rows paired with their tree meta (meta is null in flat mode).
  const bodyEntries = createMemo<Array<{ row: Row; meta: TreeRow<Row> | null }>>(() => {
    const ft = flatTree()
    if (ft) return ft.map((t) => ({ row: t.row, meta: t }))
    return filteredData().map((row) => ({ row, meta: null }))
  })
  const bodyRows = createMemo<Row[]>(() => bodyEntries().map((e) => e.row))

  // ---- Selection ----
  // Row-selection logic (single/multi toggle, dedup, select-all) is single-sourced
  // in the core model; the table keeps only its row-id mapping + rendering. Keyed
  // by string|number because row ids may be either.
  const selectionMode = merged.selectable === 'single' ? 'single' : 'multiple'
  const selectionModel = createSelectionModel<string | number>({
    mode: selectionMode,
    defaultSelected: props.selection ?? props.defaultSelection ?? [],
    onChange: (keys) => merged.onSelectionChange?.(keys),
  })
  const selection = useStore(selectionModel.store)

  // Controlled: mirror the prop into the model without re-emitting onChange.
  const selControlled = (): boolean => props.selection !== undefined
  createEffect(() => {
    if (selControlled()) selectionModel.sync(props.selection!)
  })

  // Controlled tables RENDER from the prop (true controlled semantics): a local
  // toggle emits onSelectionChange, but the displayed selection only changes when
  // the parent writes `selection` back — so a parent that validates/rejects a
  // change no longer sees the row flip optimistically. Uncontrolled renders from
  // the model store as before.
  const displaySelection = (): Array<string | number> => {
    // Subscribe to the model store even when controlled so a render read re-runs
    // after a (possibly-rejected) optimistic toggle — that re-asserts the prop's
    // value onto the native checkbox's `checked`, which the click mutated. The
    // returned value is always the prop in controlled mode.
    const store = selection()
    return selControlled() ? props.selection! : store
  }
  // Re-base the model on the controlled prop before a toggle so the emitted next
  // value is computed against what the parent actually holds (not a prior,
  // possibly-rejected, optimistic value).
  const rebaseToProp = (): void => {
    if (selControlled()) selectionModel.sync(props.selection!)
  }

  const isSelected = (id: string | number): boolean => displaySelection().includes(id)

  const allRowIds = createMemo(() => bodyRows().map((r, i) => rowId(r, i)))
  const allSelected = createMemo(() => {
    const sel = displaySelection()
    const ids = allRowIds()
    return selControlled()
      ? ids.length > 0 && ids.every((id) => sel.includes(id))
      : selectionModel.isAllSelected(ids)
  })
  const someSelected = createMemo(() => {
    const sel = displaySelection()
    return !allSelected() && allRowIds().some((id) => sel.includes(id))
  })

  const toggleRow = (id: string | number): void => {
    if (merged.selectable === 'none') return
    rebaseToProp()
    selectionModel.toggle(id)
  }

  const toggleAll = (): void => {
    rebaseToProp()
    selectionModel.toggleAll(allRowIds())
  }

  // ---- Inline Editing ----
  const [editingCellId, setEditingCellId] = createSignal<string | null>(null)
  const [editingDraft, setEditingDraft] = createSignal('')
  const [editError, setEditError] = createSignal<string | null>(null)
  // Monotonic cell-edit epoch (core `sessionGen` parity, batch AB fix): bumped
  // on start/cancel/commit so an in-flight async (editRules) commit can detect
  // it was cancelled or superseded while its validation promise was pending —
  // Escape during an async-pending commit must NOT write the value back.
  let cellEditGen = 0

  const beginEdit = (row: Row, column: IrisTableColumn<Row>, rowIdent: string | number): void => {
    if (!column.editable) return
    cellEditGen++ // a new session supersedes any pending async commit
    setEditingCellId(`${rowIdent}::${column.key}`)
    const current = getCellValue(row, column)
    setEditingDraft(current == null ? '' : String(current))
    setEditError(null)
  }

  const commitEdit = (row: Row, column: IrisTableColumn<Row>, rowIndex: number): void => {
    if (editingCellId() === null) return
    const oldValue = getCellValue(row, column)
    const draft = editingDraft()
    const newValue =
      column.editor === 'number'
        ? draft === '' || Number.isNaN(Number(draft))
          ? oldValue
          : Number(draft)
        : draft
    // Declarative editRules run async (may contain async validators).
    if (column.editRules && column.editRules.length > 0) {
      const gen = ++cellEditGen
      void validateEditRulesAsync(column.editRules, draft, row).then((r) => {
        if (gen !== cellEditGen) return // cancelled / superseded while pending
        if (!r.valid) {
          setEditError(r.messages[0] ?? null)
          return
        }
        finishCommit(row, column, rowIndex, oldValue, newValue)
      })
      return
    }
    // A column validator can reject the draft: keep the editor open, surface the
    // message, and skip the commit until the value is valid (or the user cancels).
    if (column.validate) {
      const error = column.validate(newValue, row)
      if (error) {
        setEditError(error)
        return
      }
    }
    finishCommit(row, column, rowIndex, oldValue, newValue)
  }

  const finishCommit = (
    row: Row,
    column: IrisTableColumn<Row>,
    rowIndex: number,
    oldValue: unknown,
    newValue: unknown,
  ): void => {
    cellEditGen++ // a landed commit supersedes any pending async commit
    setEditError(null)
    setEditingCellId(null)
    if (newValue !== oldValue) {
      merged.onCellEdit?.({ row, column, oldValue, newValue, rowIndex })
      // Proxy mode: write the committed value into the local page copy so the
      // edit survives without a refetch (React liveData parity); the next
      // page/refetch replaces the copy wholesale.
      if (proxy) {
        const ident = rowId(row, rowIndex)
        setProxyRows((prev) => {
          const at = prev.findIndex((r, i) => rowId(r, i) === ident)
          if (at < 0) return prev
          const next = prev.slice()
          next[at] = { ...next[at]!, [column.key]: newValue }
          return next
        })
      }
    }
  }

  const cancelEdit = (): void => {
    cellEditGen++ // drop any in-flight async commit (Escape cancels all)
    setEditError(null)
    setEditingCellId(null)
  }

  // ---- Row edit mode (vxe editConfig.mode='row' parity) -------------------
  // One session per editable column of the clicked row, each with its own
  // draft/error pair through the same bespoke machinery cell mode uses. The
  // session Map is a signal so the cell render reacts; sessions live in plain
  // closures (their own signals) and are dropped wholesale on cancel.
  const rowMode = (): boolean => merged.editConfig?.mode === 'row'
  const [rowEditing, setRowEditing] = createSignal<{ k: string | number; idx: number } | null>(null)
  const [rowSessions, setRowSessions] = createSignal<Map<string, RowCellSession<Row>>>(new Map())
  const rowEditorRefs = new Map<string, HTMLInputElement>()

  const createRowSession = (
    row: Row,
    col: IrisTableColumn<Row>,
    rowIndex: number,
  ): RowCellSession<Row> => {
    const current = getCellValue(row, col)
    const [draft, setDraft] = createSignal<string>(current == null ? '' : String(current))
    const [error, setError] = createSignal<string | null>(null)
    return { col, rowIndex, draft, error, setDraft, setError, gen: 0 }
  }

  // Commit ONE column's session: validate (editRules async → in-flight),
  // write back, then close just that editor (per-cell commit — the rest of
  // the row stays open). Returns false only on a SYNC validation failure
  // (keeps the row open with the error visible).
  const commitRowSession = (
    session: RowCellSession<Row>,
    row: Row,
    rowIdent: string | number,
  ): boolean => {
    const col = session.col
    const rowIndex = session.rowIndex
    const oldValue = getCellValue(row, col)
    const draftValue = session.draft()
    const newValue =
      col.editor === 'number'
        ? draftValue === '' || Number.isNaN(Number(draftValue))
          ? oldValue
          : Number(draftValue)
        : draftValue
    const id = `${rowIdent}::${col.key}`
    const close = (): void => {
      setRowSessions((prev) => {
        if (!prev.has(id)) return prev
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }
    const finish = (): void => {
      session.setError(null)
      close()
      if (newValue !== oldValue) {
        merged.onCellEdit?.({ row, column: col, oldValue, newValue, rowIndex })
        // Proxy mode: write the committed value into the local page copy so the
        // edit survives without a refetch; the next page/refetch replaces it.
        if (proxy) {
          setProxyRows((prev) => {
            const at = prev.findIndex((r, i) => rowId(r, i) === rowIdent)
            if (at < 0) return prev
            const next = prev.slice()
            next[at] = { ...next[at]!, [col.key]: newValue }
            return next
          })
        }
      }
    }
    if (col.editRules && col.editRules.length > 0) {
      const gen = ++session.gen
      void validateEditRulesAsync(col.editRules, draftValue, row).then((r) => {
        if (gen !== session.gen) return // cancelled / superseded while pending
        if (!r.valid) {
          session.setError(r.messages[0] ?? null)
          return
        }
        finish()
      })
      return true
    }
    if (col.validate) {
      const error = col.validate(newValue, row)
      if (error) {
        session.setError(error)
        return false
      }
    }
    session.gen++ // a landed commit supersedes any pending async commit
    finish()
    return true
  }

  const focusRowEditor = (colKey: string): void => {
    queueMicrotask(() => rowEditorRefs.get(colKey)?.focus())
  }

  const beginRowEdit = (row: Row, rowIndex: number, focusColKey?: string): void => {
    const k = rowId(row, rowIndex)
    const editableCols = leafColumns().filter((c) => c.editable)
    if (editableCols.length === 0) return
    const sessions = new Map<string, RowCellSession<Row>>()
    for (const col of editableCols) {
      sessions.set(`${k}::${col.key}`, createRowSession(row, col, rowIndex))
    }
    setRowSessions(sessions)
    setRowEditing({ k, idx: rowIndex })
    // Focus the clicked column's editor when it exists, else the first
    // editable column (the editors mount on the next render).
    const focusKey =
      focusColKey && editableCols.some((c) => c.key === focusColKey)
        ? focusColKey
        : editableCols[0]!.key
    focusRowEditor(focusKey)
  }

  /** Escape: cancel EVERY open session of the row (the whole row, vxe parity). */
  const cancelRowEdit = (): void => {
    // Drop any in-flight async commit: Escape cancels the WHOLE row, and a
    // pending validation must NOT write back (core `sessionGen` parity).
    for (const s of rowSessions().values()) s.gen++
    setRowSessions(new Map())
    setRowEditing(null)
  }

  /** Clicking another row (or starting a new row): commit each open session;
   *  a SYNC validation failure keeps the row open with the error visible.
   *  Async-validating sessions commit in the background and land whenever
   *  they resolve (per-cell commit, vxe row mode parity). */
  const switchRowEdit = (row: Row, rowIndex: number, focusColKey?: string): void => {
    const cur = rowEditing()
    if (cur !== null) {
      for (const session of rowSessions().values()) {
        const currentRow = bodyRows().find((r, i) => rowId(r, i) === cur.k) ?? row
        if (!commitRowSession(session, currentRow, cur.k)) return
      }
    }
    beginRowEdit(row, rowIndex, focusColKey)
  }

  // All open sessions committed → the row leaves edit mode (click re-opens).
  createEffect(() => {
    const cur = rowEditing()
    if (cur !== null && rowSessions().size === 0) setRowEditing(null)
  })

  /** A row-mode cell click: same row reopens a committed column; a different
   *  row commits the current row's open editors first (vxe
   *  click-elsewhere-commits parity). */
  const handleRowCellClick = (
    row: Row,
    col: IrisTableColumn<Row>,
    rowIndex: number,
    k: string | number,
  ): void => {
    if (rowEditing()?.k === k) {
      const id = `${k}::${col.key}`
      if (col.editable && !rowSessions().has(id)) {
        const session = createRowSession(row, col, rowIndex)
        setRowSessions((prev) => {
          const next = new Map(prev)
          next.set(id, session)
          return next
        })
        focusRowEditor(col.key)
      }
    } else {
      switchRowEdit(row, rowIndex, col.key)
    }
  }

  /** Tab between the row's editors: commit THAT column, focus the next
   *  editable one. Sync failure stays on the editor with the error. */
  const handleRowTab = (
    row: Row,
    col: IrisTableColumn<Row>,
    session: RowCellSession<Row>,
    rowIdent: string | number,
    dir: 1 | -1,
  ): void => {
    if (!commitRowSession(session, row, rowIdent)) return
    const cols = leafColumns()
    const start = cols.indexOf(col)
    for (let i = start + dir; i >= 0 && i < cols.length; i += dir) {
      const nextCol = cols[i]!
      if (!nextCol.editable) continue
      focusRowEditor(nextCol.key)
      return
    }
  }

  // ---- Row drag-sort (composed over core createSortable) ------------------
  // One controller + container-level pointer handling; each row renders a
  // drag handle that seeds the press. Drop targets are collected on first
  // movement past the threshold (rects are captured once, then reused).
  const rowDragCtrl = createSortable()
  const rowDragState = useStore(rowDragCtrl)
  const rowDragActive = (): string | null => rowDragState().activeId
  const rowDragOver = (): string | null => rowDragState().overId
  const rowRects: SortableRect[] = []

  const handleRowDragPointerDown = (e: PointerEvent, rowIdent: string): void => {
    if (!merged.rowDrag || e.button !== 0) return
    e.preventDefault()
    rowDragCtrl.press(rowIdent, e.clientX, e.clientY)
  }

  const handleRowDragPointerMove = (e: PointerEvent): void => {
    if (!merged.rowDrag) return
    if (rowDragCtrl.isPending()) {
      const started = rowDragCtrl.tryStart(e.clientX, e.clientY)
      if (started) {
        const rects: SortableRect[] = []
        rootRef?.querySelectorAll('[data-iris-row-drag-handle]').forEach((el) => {
          const r = (el as HTMLElement).getBoundingClientRect()
          const id = (el as HTMLElement).getAttribute('data-iris-row-drag-handle')
          if (id) rects.push({ id, left: r.left, top: r.top, width: r.width, height: r.height })
        })
        rowRects.length = 0
        rowRects.push(...rects)
      }
    }
    if (rowDragCtrl.getState().activeId !== null) {
      rowDragCtrl.moveOver({ x: e.clientX, y: e.clientY }, rowRects)
    }
  }

  const handleRowDragPointerUp = (): void => {
    if (!merged.rowDrag) return
    if (rowDragCtrl.isPending()) {
      rowDragCtrl.cancel()
      return
    }
    const { activeId, overId } = rowDragCtrl.end()
    if (activeId !== null && overId !== null && activeId !== overId) {
      const rows = [...bodyRows()] as Row[]
      const from = rows.findIndex((r, i) => String(rowId(r, i)) === activeId)
      const to = rows.findIndex((r, i) => String(rowId(r, i)) === overId)
      if (from >= 0 && to >= 0 && from !== to) {
        const [moved] = rows.splice(from, 1)
        rows.splice(to, 0, moved)
        // Local rows write-back: the reordered list feeds the table directly;
        // the parent is notified through BOTH channels (vue batch-Y parity).
        setLocalRows(rows)
        merged.onDataChange?.(rows)
        merged.rowDrag!.onReorder(rows)
      }
    }
    rowRects.length = 0
  }

  const handleRowDragPointerLeave = (): void => {
    if (merged.rowDrag && rowDragCtrl.getState().activeId !== null) {
      rowDragCtrl.cancel()
    }
  }

  // ---- Column drag-sort (composed over core createSortable) ---------------
  const colDragCtrl = createSortable()
  const colDragState = useStore(colDragCtrl)
  const colDragActive = (): string | null => colDragState().activeId
  const colDragOver = (): string | null => colDragState().overId
  const colRects: SortableRect[] = []

  const handleColDragPointerDown = (e: PointerEvent, colKey: string): void => {
    if (!merged.columnDrag || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    colDragCtrl.press(colKey, e.clientX, e.clientY)
  }

  const handleColDragPointerMove = (e: PointerEvent): void => {
    if (!merged.columnDrag) return
    if (colDragCtrl.isPending()) {
      const started = colDragCtrl.tryStart(e.clientX, e.clientY)
      if (started) {
        const rects: SortableRect[] = []
        rootRef?.querySelectorAll('[data-iris-table-header]').forEach((el) => {
          const r = (el as HTMLElement).getBoundingClientRect()
          const id = (el as HTMLElement).getAttribute('data-iris-table-header')
          if (id) rects.push({ id, left: r.left, top: r.top, width: r.width, height: r.height })
        })
        colRects.length = 0
        colRects.push(...rects)
      }
    }
    if (colDragCtrl.getState().activeId !== null) {
      colDragCtrl.moveOver({ x: e.clientX, y: e.clientY }, colRects)
    }
  }

  const handleColDragPointerUp = (): void => {
    if (!merged.columnDrag) return
    if (colDragCtrl.isPending()) {
      colDragCtrl.cancel()
      return
    }
    const { activeId, overId } = colDragCtrl.end()
    if (activeId !== null && overId !== null && activeId !== overId) {
      const next = [...leafColumns()]
      const from = next.findIndex((c) => c.key === activeId)
      const to = next.findIndex((c) => c.key === overId)
      if (from >= 0 && to >= 0 && from !== to) {
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        merged.columnDrag!.onReorder(next as IrisTableColumn<Row>[])
      }
    }
    colRects.length = 0
  }

  // ---- Right-click context menu (vxe contextMenu parity) ------------------
  // Transient state: items + params are computed ONCE per open from the
  // callback; the cursor coordinates live in a virtual floating anchor (a
  // fake element whose getBoundingClientRect returns the zero-size cursor
  // rect). Each open builds a FRESH anchor object, so the positioning effect
  // re-runs on the new identity (no remount token needed).
  const [contextMenuState, setContextMenuState] = createSignal<{
    open: boolean
    items: IrisTableContextMenuItem[]
    params: IrisTableContextMenuParams<Row>
  } | null>(null)
  const [contextAnchor, setContextAnchor] = createSignal<HTMLElement | null>(null)
  const closeContextMenu = (): void => {
    setContextMenuState((prev) => (prev ? { ...prev, open: false } : prev))
  }

  // ---- Header filter panel (vxe filterConfig parity) ----------------------
  // One panel at a time, keyed by the column whose trigger was clicked. The
  // anchor is the trigger BUTTON itself (a real DOM node), captured at click
  // time. The panel renders inside a keyed Show on the state object identity,
  // so each open remounts it and the draft checkbox state re-seeds from the
  // applied `filterValues`.
  const [filterPanelState, setFilterPanelState] = createSignal<{
    open: boolean
    colKey: string
  } | null>(null)
  const [filterAnchor, setFilterAnchor] = createSignal<HTMLButtonElement | null>(null)
  const closeFilterPanel = (): void => {
    setFilterPanelState((prev) => (prev ? { ...prev, open: false } : prev))
  }
  const openFilterPanel = (e: MouseEvent, colKey: string): void => {
    // Never let the trigger click reach the header cell (which would sort).
    e.stopPropagation()
    setFilterAnchor(e.currentTarget as HTMLButtonElement)
    setFilterPanelState({ open: true, colKey })
  }
  const applyFilterValues = (colKey: string, values: string[]): void => {
    merged.onFilterValuesChange?.({ ...(props.filterValues ?? {}), [colKey]: values })
  }
  const clearFilterValues = (colKey: string): void => {
    const next = { ...(props.filterValues ?? {}) }
    delete next[colKey]
    merged.onFilterValuesChange?.(next)
  }

  const handleContextMenu = (
    e: MouseEvent,
    row: Row,
    col: IrisTableColumn<Row>,
    idx: number,
    ci: number,
  ): void => {
    if (!merged.contextMenu) return
    e.preventDefault()
    // Virtual anchor: zero-size rect at the cursor. The object is rebuilt per
    // open (capturing this event's coordinates) so the panel always lands at
    // the cursor.
    const virtualAnchor = {
      getBoundingClientRect: () => ({
        left: e.clientX,
        top: e.clientY,
        right: e.clientX,
        bottom: e.clientY,
        width: 0,
        height: 0,
        x: e.clientX,
        y: e.clientY,
        toJSON() {},
      }),
    } as unknown as HTMLElement
    setContextAnchor(virtualAnchor)
    const params: IrisTableContextMenuParams<Row> = {
      row,
      column: col,
      rowIndex: idx,
      columnIndex: ci,
    }
    setContextMenuState({ open: true, items: merged.contextMenu!.items(params), params })
  }

  // ---- Header filter trigger (vxe filterConfig parity) --------------------
  // A small icon button at the end of the title; active (--iris-primary) when
  // the column has a non-empty checked set. stopPropagation keeps it from
  // sorting. Leaf headers only.
  const renderFilterTrigger = (col: IrisTableColumn<Row>, leaf: boolean): JSX.Element => {
    if (!leaf || !col.filterable) return <></>
    const active = (props.filterValues?.[col.key]?.length ?? 0) > 0
    return (
      <button
        type="button"
        data-iris-filter-trigger={col.key}
        aria-label={t('table.filter')}
        aria-haspopup="true"
        aria-expanded={
          filterPanelState()?.open === true && filterPanelState()?.colKey === col.key
            ? 'true'
            : undefined
        }
        data-iris-filter-active={active ? 'true' : undefined}
        onClick={(e) => openFilterPanel(e, col.key)}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: '0',
          'margin-inline-start': 'var(--iris-space-xxs, 4px)',
          'font-size': 'var(--iris-font-size-xs, 12px)',
          'line-height': '1',
          color: active ? 'var(--iris-primary)' : 'var(--iris-muted)',
        }}
      >
        ⏷
      </button>
    )
  }

  // ---- Imperative handle (vxe loadData/reloadData/commitProxy/
  // getProxyInfo/clearSort/clearFilter parity) -------------------------------
  // Solid props are getters and the proxy controller is captured by
  // reference, so the mount-time handle always reads the LATEST state.
  const tableHandle = {
    loadData: (rows: Row[]): void => {
      setLocalRows(rows)
      merged.onDataChange?.(rows)
    },
    reloadData: (): void => {
      if (proxy) {
        setLocalRows(null)
        void proxy.refetch()
      }
    },
    commitProxy: (overrides: Partial<import('./types').IrisTableProxyQueryParams>): void => {
      proxy?.setParams(overrides)
    },
    getProxyInfo: (): { page: number; pageSize: number; total: number } | null => {
      const s = proxy?.getState()
      return s ? { page: s.params.page, pageSize: s.params.pageSize, total: s.total } : null
    },
    clearSort: (): void => {
      if (merged.multiSort) setMultiSort([])
      else setSort(null)
    },
    clearFilter: (): void => {
      merged.onFiltersChange?.({})
      merged.onFilterValuesChange?.({})
    },
  }
  onMount(() => {
    if (props.tableRef) props.tableRef.current = tableHandle
  })

  // ---- Grid keyboard navigation (opt-in) ----
  // Roving cell focus over the data cells, driven by the framework-agnostic
  // `nextGridCell`. Off by default; additive (no effect on mouse / Tab).
  let rootRef: HTMLDivElement | undefined
  const [focusedCell, setFocusedCell] = createSignal<{ row: number; col: number } | null>(null)
  const GRID_NAV_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ])
  const handleGridKey = (e: KeyboardEvent): void => {
    if (!merged.keyboardNavigation || !GRID_NAV_KEYS.has(e.key)) return
    // Only navigate from a grid cell — never hijack arrows inside an editing
    // cell's <input> (which carries no data-grid-row).
    const target = e.target as HTMLElement
    if (target.dataset.gridRow === undefined) return
    e.preventDefault()
    const current = focusedCell() ?? { row: 0, col: 0 }
    const next = nextGridCell(current, e.key as GridNavKey, {
      rowCount: bodyRows().length,
      colCount: leafColumns().length,
      pageSize: 10,
    })
    setFocusedCell(next)
    const cell = rootRef?.querySelector<HTMLElement>(
      `[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`,
    )
    cell?.focus()
  }

  // ---- Cell-range selection (opt-in via `cellRange`) ----
  // Controller lives outside reactive tracking; bridged into Solid via a signal
  // subscribed to the core store.
  const cellRangeCtrl = createCellRange()
  const [cellRangeState, setCellRangeState] = createSignal(cellRangeCtrl.getState())
  onCleanup(cellRangeCtrl.subscribe((s) => setCellRangeState(s)))

  const isInRange = (row: number, col: number): boolean => {
    const { anchor, active } = cellRangeState()
    if (!anchor || !active) return false
    const minRow = Math.min(anchor.row, active.row)
    const maxRow = Math.max(anchor.row, active.row)
    const minCol = Math.min(anchor.col, active.col)
    const maxCol = Math.max(anchor.col, active.col)
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
  }

  const handleCellRangeKey = (e: KeyboardEvent): void => {
    if (!merged.cellRange) return
    if (e.key === 'Escape') {
      cellRangeCtrl.clearRange()
      return
    }
    const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    if (!e.shiftKey || !ARROW_KEYS.has(e.key)) return
    const target = e.target as HTMLElement
    const rowAttr = target.dataset.irisCellRow
    const colAttr = target.dataset.irisCellCol
    if (rowAttr === undefined || colAttr === undefined) return
    e.preventDefault()
    const anchor = cellRangeCtrl.getState().anchor
    const active = anchor
      ? (cellRangeCtrl.getState().active ?? { row: Number(rowAttr), col: Number(colAttr) })
      : { row: Number(rowAttr), col: Number(colAttr) }
    let nextRow = active.row
    let nextCol = active.col
    if (e.key === 'ArrowUp') nextRow = Math.max(0, nextRow - 1)
    else if (e.key === 'ArrowDown') nextRow = Math.min(bodyRows().length - 1, nextRow + 1)
    else if (e.key === 'ArrowLeft') nextCol = Math.max(0, nextCol - 1)
    else nextCol = Math.min(leafColumns().length - 1, nextCol + 1)
    cellRangeCtrl.extendRange(nextRow, nextCol)
  }

  // ---- Grid template ----
  const SELECTION_COL_WIDTH = 40
  const EXPAND_COL_WIDTH = 40
  const SEQ_COL_WIDTH = 60
  const gridTemplate = createMemo(() => {
    const parts: string[] = []
    if (merged.rowDrag) parts.push(`${DRAG_COL_WIDTH}px`)
    if (merged.seq) parts.push(`${SEQ_COL_WIDTH}px`)
    if (hasDetail()) parts.push(`${EXPAND_COL_WIDTH}px`)
    if (merged.selectable !== 'none') parts.push(`${SELECTION_COL_WIDTH}px`)
    for (const col of leafColumns()) {
      parts.push(`${widthOf(col)}px`)
    }
    return parts.join(' ')
  })

  // ---- Column virtualization (opt-in via `columnVirtualization`) ----
  // Render only the horizontally-visible columns (+ pinned + overscan) for very
  // wide tables. The root becomes a horizontal scroll container; off-screen grid
  // tracks stay sized via `gridTemplateColumns`, and each rendered cell is placed
  // on its 1-based grid track (`colTrack`) so it lands correctly even when
  // earlier cells are skipped. Off by default → `visibleColSet()` is null and
  // every column renders unchanged.
  const [scrollLeft, setScrollLeft] = createSignal(0)
  const [viewportWidth, setViewportWidth] = createSignal(0)

  // 1-based grid track for a column index, after the optional drag + seq +
  // detail + selection tracks, so a windowed cell lands in the right place.
  const colTrack = (i: number): number =>
    (merged.rowDrag ? 1 : 0) +
    (merged.seq ? 1 : 0) +
    (hasDetail() ? 1 : 0) +
    (merged.selectable !== 'none' ? 1 : 0) +
    1 +
    i

  onMount(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('iris-table-row-styles')) return
    const style = document.createElement('style')
    style.id = 'iris-table-row-styles'
    style.textContent = `
[data-iris-table] [role="row"]:hover {
  --iris-row-bg: var(--iris-surface-hover);
}
[data-iris-table-row-selected="true"] {
  --iris-row-bg: var(--iris-surface-selected);
}
/* Row edit mode (vxe editConfig.mode parity): the row whose editors are
   open gets the same token-driven highlight as the selected row. */
[data-iris-table-row][data-iris-row-editing="true"] {
  --iris-row-bg: var(--iris-surface-selected);
}
[data-iris-table-context-menu] [role="menuitem"]:hover:not(:disabled) {
  background: var(--iris-surface-hover);
}
`
    document.head.appendChild(style)
  })
  onMount(() => {
    if (!merged.columnVirtualization || !rootRef) return
    const el = rootRef
    const measure = (): void => {
      setViewportWidth(el.clientWidth)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  // Set of column indices to render: the visible window + overscan, always
  // unioned with pinned columns. `null` ⇒ render every column (feature off).
  const visibleColSet = createMemo<Set<number> | null>(() => {
    if (!merged.columnVirtualization) return null
    const cols = leafColumns()
    const w = computeVirtualRange({
      itemCount: cols.length,
      scrollTop: scrollLeft(),
      viewportSize: viewportWidth(),
      itemSize: (i) => widthOf(cols[i]),
      buffer: 2,
    })
    const set = new Set<number>()
    for (let i = w.startIndex; i <= w.endIndex; i += 1) set.add(i)
    cols.forEach((col, i) => {
      if (col.pinned) set.add(i)
    })
    return set
  })

  // Active sort info for a column: multi mode reads the click-order list,
  // single mode the single-column state.
  const sortInfo = (
    col: IrisTableColumn<Row>,
  ): { isActive: boolean; dir: 'asc' | 'desc' | null } => {
    const multiIdx = merged.multiSort ? multiSortState().findIndex((s) => s.key === col.key) : -1
    const isActive = merged.multiSort ? multiIdx >= 0 : effectiveSort()?.key === col.key
    const dir = isActive
      ? merged.multiSort
        ? multiSortState()[multiIdx]!.direction
        : effectiveSort()!.direction
      : null
    return { isActive, dir }
  }
  const sortAria = (col: IrisTableColumn<Row>): 'none' | 'ascending' | 'descending' | undefined => {
    const { isActive, dir } = sortInfo(col)
    if (!isActive) return col.sortable ? 'none' : undefined
    return dir === 'asc' ? 'ascending' : 'descending'
  }
  const sortIndicator = (col: IrisTableColumn<Row>): JSX.Element => {
    if (!col.sortable) return <></>
    const { isActive, dir } = sortInfo(col)
    const multiIdx = merged.multiSort ? multiSortState().findIndex((s) => s.key === col.key) : -1
    return (
      <>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            'flex-direction': 'column',
            'margin-inline-start': '4px',
            'line-height': '0.6',
            'font-size': 'var(--iris-font-size-xs, 12px)',
            color: isActive ? 'var(--iris-primary)' : 'var(--iris-muted)',
          }}
        >
          <span style={{ opacity: dir === 'asc' ? '1' : '0.45' }}>▲</span>
          <span style={{ opacity: dir === 'desc' ? '1' : '0.45' }}>▼</span>
        </span>
        {/* Multi mode: non-primary sort columns show their click-order
            sequence number (vxe sort-config sequence parity). */}
        <Show when={merged.multiSort && multiIdx > 0}>
          <span
            data-iris-sort-seq=""
            style={{
              'margin-inline-start': 'var(--iris-space-xxs, 4px)',
              'font-size': 'var(--iris-font-size-xs, 12px)',
              color: 'var(--iris-muted)',
            }}
          >
            {multiIdx + 1}
          </span>
        </Show>
      </>
    )
  }

  const seqStartIndex = props.seqStartIndex ?? 1
  const seqValue = (index: number): string | number => {
    if (props.seqMethod) return props.seqMethod({ rowIndex: index, columnIndex: 0 })
    if (proxy && props.proxyConfig?.seq && merged.seq) {
      return (proxyState().params.page - 1) * proxyState().params.pageSize + index + 1
    }
    return index + seqStartIndex
  }
  // Span bookkeeping (vxe spanMethod parity): a per-pass occupied set rebuilt
  // whenever bodyEntries gets a fresh reference (a new render pass), so Solid's
  // <For> — which re-runs callbacks only for new entry identities — never
  // accumulates stale coverage across passes. The rebuild is also keyed on the
  // spanMethod identity: swapping the callback to a different function without
  // a data change (same bodyEntries reference) must drop coverage left by the
  // previous function, or cells it covered stay blank under the new one.
  const spanOccupy = new Set<string>()
  let spanRowsRef: Array<{ row: Row; meta: TreeRow<Row> | null }> | undefined
  let spanMethodRef: NonNullable<IrisTableProps<Row>['spanMethod']> | undefined
  const spanPass = (): void => {
    if (props.spanMethod === undefined) return
    const entries = bodyEntries()
    if (spanRowsRef !== entries || spanMethodRef !== props.spanMethod) {
      spanOccupy.clear()
      spanRowsRef = entries
      spanMethodRef = props.spanMethod
    }
  }

  const stateRowStyle: JSX.CSSProperties = {
    padding: '32px 12px',
    'text-align': 'center',
    color: 'var(--iris-muted)',
  }

  // Tree mode is opt-in via getSubRows. The virtual-scroll path windows flat AND
  // tree rows (uniform height) — only variable-height detail panels bar it, hence
  // the `!hasDetail()` guard below.
  const treeMode = (): boolean => props.getSubRows !== undefined

  // Single source of truth for a body row's main `<div>`. The non-virtual body
  // wraps it with a detail panel; the virtual scroller renders it directly,
  // passing the per-row tree meta (`flatTree()[idx]`) at the scroller's absolute
  // index so indent + toggle render for windowed tree rows too.
  const renderRow = (row: Row, index: number, treeMeta: TreeRow<Row> | null): JSX.Element => {
    const id = rowId(row, index)
    spanPass()
    const selected = (): boolean => isSelected(id)
    const expanded = (): boolean => expandedKeys().includes(String(id))
    const expandable = (): boolean => isRowExpandable(row, index)
    return (
      <div
        role="row"
        // Announce selection to assistive tech (parity with the React adapter);
        // `data-state` below stays as the styling hook.
        aria-selected={merged.selectable !== 'none' ? selected() : undefined}
        data-iris-table-row=""
        data-iris-row-editing={rowMode() && rowEditing()?.k === id ? 'true' : undefined}
        data-state={selected() ? 'selected' : undefined}
        // Tree depth/position for screen readers (1-based); the toggle button
        // carries aria-expanded for the control itself.
        aria-level={treeMeta ? treeMeta.depth + 1 : undefined}
        aria-setsize={treeMeta ? treeMeta.setSize : undefined}
        aria-posinset={treeMeta ? treeMeta.posInset : undefined}
        onClick={() => merged.onRowClick?.(row, index)}
        style={{
          display: 'grid',
          'grid-template-columns': gridTemplate(),
          background: selected()
            ? 'var(--iris-surface-selected)'
            : merged.striped && index % 2 === 1
              ? 'var(--iris-surface)'
              : 'var(--iris-row-bg, transparent)',
          transition: 'background-color 120ms ease',
          cursor: 'default',
        }}
      >
        {/* Row drag handle (vxe rowDragConfig parity): seeds the press; the
          drag id rides on THIS cell (the empty `data-iris-table-row` attr
          stays untouched) so rect collection can key by row id. */}
        <Show when={merged.rowDrag}>
          <div
            role="cell"
            data-iris-table-cell="__drag"
            data-iris-row-drag-handle={String(id)}
            data-iris-row-drag-active={rowDragActive() === String(id) ? 'true' : undefined}
            data-iris-row-drag-over={rowDragOver() === String(id) ? 'true' : undefined}
            onPointerDown={(e: PointerEvent) => handleRowDragPointerDown(e, String(id))}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
              cursor: 'grab',
              color: 'var(--iris-muted)',
              background:
                rowDragActive() === String(id)
                  ? 'var(--iris-surface-hover)'
                  : rowDragOver() === String(id)
                    ? 'var(--iris-surface-selected)'
                    : 'transparent',
            }}
          >
            <span aria-hidden="true" style={{ 'font-size': 'var(--iris-font-size-sm, 13px)' }}>
              ⠿
            </span>
          </div>
        </Show>
        <Show when={merged.seq}>
          <div
            role="cell"
            data-iris-table-cell="__seq"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
              color: 'var(--iris-muted)',
              'user-select': 'none',
            }}
          >
            {seqValue(index)}
          </div>
        </Show>
        <Show when={hasDetail()}>
          <div
            role="cell"
            data-iris-table-cell="__expand"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          >
            <Show when={expandable()}>
              <button
                type="button"
                data-iris-table-expand-toggle=""
                aria-expanded={expanded()}
                aria-label={t(expanded() ? 'treeSelect.collapse' : 'treeSelect.expand')}
                onClick={(e) => {
                  e.stopPropagation()
                  expansion.toggle(String(id))
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '0',
                  font: 'inherit',
                  color: 'var(--iris-foreground)',
                  transform: expanded() ? 'rotate(90deg)' : 'none',
                  transition: 'transform 150ms',
                }}
              >
                ▶
              </button>
            </Show>
          </div>
        </Show>
        <Show when={merged.selectable !== 'none'}>
          <div
            role="cell"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          >
            <input
              type="checkbox"
              checked={selected()}
              onChange={() => toggleRow(id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={t('table.selectRow', { key: index + 1 })}
            />
          </div>
        </Show>
        <For each={leafColumns()}>
          {(col, colIndexAccessor) => {
            const cid = `${id}::${col.key}`
            const rowSession = (): RowCellSession<Row> | undefined =>
              rowMode() ? rowSessions().get(cid) : undefined
            const isEditing = (): boolean =>
              rowMode() ? rowSession() !== undefined : editingCellId() === cid
            const isFirstCol = colIndexAccessor() === 0
            const colIndex = colIndexAccessor()
            const isFocused = (): boolean => {
              const fc = focusedCell()
              return fc ? fc.row === index && fc.col === colIndex : index === 0 && colIndex === 0
            }
            // Column virtualization: skip cells outside the visible window (+
            // pinned). When windowing, place the rendered cell on its grid track.
            const inWindow = (): boolean => {
              const set = visibleColSet()
              return !set || set.has(colIndex)
            }
            // Cell merge (vxe spanMethod parity): the occupied set carries
            // cells covered by an earlier rowspan/colspan origin — those cells
            // render nothing. Origin cells with colspan > 1 extend their grid
            // track; rowspan coverage only removes the covered cells (each row
            // is its own grid container, so a row cannot span another row).
            let colspan = 1
            if (props.spanMethod && inWindow()) {
              const spanKey = `${index}:${colIndex}`
              if (spanOccupy.has(spanKey)) return <></>
              const span = props.spanMethod({ rowIndex: index, columnIndex: colIndex })
              const rowspan = span?.rowspan ?? 1
              colspan = span?.colspan ?? 1
              if (rowspan > 1) {
                for (let r = 1; r < rowspan; r += 1) spanOccupy.add(`${index + r}:${colIndex}`)
              }
              if (colspan > 1) {
                for (let c = 1; c < colspan; c += 1) spanOccupy.add(`${index}:${colIndex + c}`)
              }
            }
            return (
              <Show when={inWindow()}>
                <div
                  role="cell"
                  data-iris-table-cell={col.key}
                  data-iris-table-pinned={col.pinned}
                  data-editable={col.editable ? '' : undefined}
                  data-editing={isEditing() ? '' : undefined}
                  data-grid-row={merged.keyboardNavigation ? index : undefined}
                  data-grid-col={merged.keyboardNavigation ? colIndex : undefined}
                  data-iris-cell-row={merged.cellRange ? index : undefined}
                  data-iris-cell-col={merged.cellRange ? colIndex : undefined}
                  data-iris-cell-selected={
                    merged.cellRange && isInRange(index, colIndex) ? 'true' : undefined
                  }
                  tabindex={merged.keyboardNavigation ? (isFocused() ? 0 : -1) : undefined}
                  onFocus={
                    merged.keyboardNavigation
                      ? () => setFocusedCell({ row: index, col: colIndex })
                      : undefined
                  }
                  onClick={
                    rowMode()
                      ? () => handleRowCellClick(row, col, index, id)
                      : merged.cellRange
                        ? (e: MouseEvent) => {
                            if (e.shiftKey) {
                              cellRangeCtrl.extendRange(index, colIndex)
                            } else {
                              cellRangeCtrl.startRange(index, colIndex)
                            }
                          }
                        : col.editable && merged.editConfig?.trigger === 'click'
                          ? () => beginEdit(row, col, id)
                          : undefined
                  }
                  onDblClick={
                    rowMode()
                      ? () => switchRowEdit(row, index, col.key)
                      : col.editable
                        ? () => beginEdit(row, col, id)
                        : undefined
                  }
                  onContextMenu={
                    merged.contextMenu
                      ? (e: MouseEvent) => handleContextMenu(e, row, col, index, colIndex)
                      : undefined
                  }
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content':
                      (col.align ??
                        (typeof getCellValue(row, col) === 'number' ? 'right' : 'left')) === 'right'
                        ? 'flex-end'
                        : col.align === 'center'
                          ? 'center'
                          : 'flex-start',
                    padding: isEditing() ? '4px' : '8px var(--iris-padding-md)',
                    'border-bottom': '1px solid var(--iris-border)',
                    'font-size': 'var(--iris-font-size-md, 14px)',
                    'white-space': 'nowrap',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                    cursor: col.editable ? 'cell' : 'default',
                    background:
                      merged.cellRange && isInRange(index, colIndex)
                        ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
                        : undefined,
                    ...(visibleColSet() ? { 'grid-column-start': String(colTrack(colIndex)) } : {}),
                    ...(colspan > 1 ? { 'grid-column-end': `span ${colspan}` } : {}),
                  }}
                >
                  <Show when={treeMeta && isFirstCol}>
                    <span
                      data-iris-table-tree-indent=""
                      style={{
                        display: 'inline-flex',
                        'align-items': 'center',
                        flex: 'none',
                        'padding-left': `${treeMeta!.depth * 16}px`,
                      }}
                    >
                      <Show
                        when={treeMeta!.hasChildren}
                        fallback={
                          <span
                            aria-hidden="true"
                            style={{ display: 'inline-block', width: '16px' }}
                          />
                        }
                      >
                        <button
                          type="button"
                          data-iris-table-tree-toggle=""
                          aria-expanded={expandedKeys().includes(treeMeta!.key)}
                          aria-label={t(
                            expandedKeys().includes(treeMeta!.key)
                              ? 'treeSelect.collapse'
                              : 'treeSelect.expand',
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            expansion.toggle(treeMeta!.key)
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: '0',
                            'margin-right': '4px',
                            font: 'inherit',
                            color: 'var(--iris-foreground)',
                            transform: expandedKeys().includes(treeMeta!.key)
                              ? 'rotate(90deg)'
                              : 'none',
                            transition: 'transform 150ms',
                          }}
                        >
                          ▶
                        </button>
                      </Show>
                    </span>
                  </Show>
                  <Show
                    when={isEditing()}
                    fallback={
                      <Show when={col.renderCell} fallback={String(getCellValue(row, col) ?? '')}>
                        {col.renderCell!(row, index)}
                      </Show>
                    }
                  >
                    <Show
                      when={rowSession()}
                      // The singleton cell-mode editor is INLINE (NOT a hoisted
                      // fragment): a `const cellEditor = (<>…</>)` compiles to an
                      // eagerly-instantiated template in the DOM build — its
                      // `<input>` hydration node has no server counterpart, so
                      // SSR→hydrate mismatches. Inline JSX stays inside the
                      // fallback getter (created only when this branch renders).
                      fallback={
                        <>
                          <input
                            type={col.editor === 'number' ? 'number' : 'text'}
                            value={editingDraft()}
                            data-iris-table-editor=""
                            aria-invalid={editError() ? 'true' : undefined}
                            aria-describedby={editError() ? `${cid}-error` : undefined}
                            onInput={(e) => setEditingDraft((e.target as HTMLInputElement).value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                commitEdit(row, col, index)
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                cancelEdit()
                              }
                            }}
                            onBlur={() => commitEdit(row, col, index)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              border: `1px solid ${
                                editError() ? 'var(--iris-danger)' : 'var(--iris-primary)'
                              }`,
                              'border-radius': 'var(--iris-radius-sm)',
                              padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
                              font: 'inherit',
                              background: 'var(--iris-background)',
                              color: 'var(--iris-foreground)',
                              outline: 'none',
                            }}
                          />
                          <Show when={editError()}>
                            <div
                              id={`${cid}-error`}
                              role="alert"
                              data-iris-table-editor-error=""
                              style={{
                                'margin-top': '2px',
                                'font-size': 'var(--iris-font-size-xs, 12px)',
                                color: 'var(--iris-danger)',
                              }}
                            >
                              {editError()}
                            </div>
                          </Show>
                        </>
                      }
                    >
                      {(session) => (
                        <>
                          <input
                            ref={(el) => {
                              if (el) rowEditorRefs.set(col.key, el)
                              else rowEditorRefs.delete(col.key)
                            }}
                            type={col.editor === 'number' ? 'number' : 'text'}
                            value={session().draft()}
                            data-iris-table-editor=""
                            aria-invalid={session().error() ? 'true' : undefined}
                            aria-describedby={session().error() ? `${cid}-error` : undefined}
                            onInput={(e) =>
                              session().setDraft((e.currentTarget as HTMLInputElement).value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                commitRowSession(session(), row, id)
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                cancelRowEdit()
                              } else if (e.key === 'Tab') {
                                e.preventDefault()
                                handleRowTab(row, col, session(), id, e.shiftKey ? -1 : 1)
                              }
                            }}
                            onBlur={() => commitRowSession(session(), row, id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              border: `1px solid ${
                                session().error() ? 'var(--iris-danger)' : 'var(--iris-primary)'
                              }`,
                              'border-radius': 'var(--iris-radius-sm)',
                              padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
                              font: 'inherit',
                              background: 'var(--iris-background)',
                              color: 'var(--iris-foreground)',
                              outline: 'none',
                            }}
                          />
                          <Show when={session().error()}>
                            <div
                              id={`${cid}-error`}
                              role="alert"
                              data-iris-table-editor-error=""
                              style={{
                                'margin-top': '2px',
                                'font-size': 'var(--iris-font-size-xs, 12px)',
                                color: 'var(--iris-danger)',
                              }}
                            >
                              {session().error()}
                            </div>
                          </Show>
                        </>
                      )}
                    </Show>
                  </Show>
                </div>
              </Show>
            )
          }}
        </For>
      </div>
    )
  }

  return (
    <>
      {/* Search form (vxe-grid formConfig parity). */}
      <Show when={merged.formConfig}>
        <form
          data-iris-table-form=""
          onSubmit={handleFormSubmit}
          onReset={handleFormReset}
          style={{
            display: 'flex',
            'flex-wrap': 'wrap',
            'align-items': 'flex-end',
            gap: 'var(--iris-space-sm, 12px)',
            padding: 'var(--iris-space-sm, 12px)',
            border: '1px solid var(--iris-border)',
            'border-bottom': 'none',
            background: 'var(--iris-surface)',
            'font-size': 'var(--iris-font-size-sm, 13px)',
          }}
        >
          <For each={merged.formConfig!.fields}>
            {(field) => (
              <div data-iris-table-form-field={field.key} style={{ 'min-width': '180px' }}>
                <IrisFormField label={field.label} size="sm">
                  <Show
                    when={field.type === 'select'}
                    fallback={
                      <IrisInput
                        value={formDraft()[field.key] ?? ''}
                        onInput={(e) =>
                          setFormValue(field.key, (e.target as HTMLInputElement).value)
                        }
                        placeholder={field.placeholder}
                        size="sm"
                      />
                    }
                  >
                    <IrisSelect
                      items={(field.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
                      value={formDraft()[field.key] ?? ''}
                      onValueChange={(v) => setFormValue(field.key, String(v ?? ''))}
                      placeholder={field.placeholder ?? t('select.placeholder')}
                      size="sm"
                    />
                  </Show>
                </IrisFormField>
              </div>
            )}
          </For>
          <div style={{ display: 'flex', gap: 'var(--iris-space-xs, 8px)' }}>
            <IrisButton type="submit" size="sm" data-iris-table-form-submit="">
              {merged.formConfig!.submitText ?? t('table.formSubmit')}
            </IrisButton>
            <IrisButton type="reset" variant="outline" size="sm" data-iris-table-form-reset="">
              {merged.formConfig!.resetText ?? t('table.formReset')}
            </IrisButton>
          </div>
        </form>
      </Show>

      {/* Toolbar (vxe-grid toolbarConfig parity, minimal built-ins). */}
      <Show when={merged.toolbar}>
        <div
          data-iris-table-toolbar=""
          style={{
            display: 'flex',
            'align-items': 'center',
            gap: 'var(--iris-space-sm, 12px)',
            padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
            border: '1px solid var(--iris-border)',
            'border-bottom': 'none',
            'border-top-left-radius': 'var(--iris-radius-md, 6px)',
            'border-top-right-radius': 'var(--iris-radius-md, 6px)',
            background: 'var(--iris-surface)',
            'font-size': 'var(--iris-font-size-sm, 13px)',
            position: 'relative',
          }}
        >
          <Show when={merged.toolbar!.title}>
            <span style={{ 'font-weight': 600, color: 'var(--iris-foreground)' }}>
              {merged.toolbar!.title}
            </span>
          </Show>
          <div style={{ flex: 1 }} />
          <Show when={merged.toolbar!.onRefresh}>
            <button
              type="button"
              data-iris-table-toolbar-refresh=""
              onClick={() => {
                merged.toolbar!.onRefresh?.()
                // proxy mode: the built-in refresh also re-queries (vxe parity).
                if (proxy) void proxy.refetch()
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--iris-muted)',
                'font-size': 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={t('table.refresh')}
              title={t('table.refresh')}
            >
              ↻
            </button>
          </Show>
          <Show when={merged.toolbar!.onExport}>
            <button
              type="button"
              data-iris-table-toolbar-export=""
              onClick={() => merged.toolbar!.onExport?.()}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--iris-muted)',
                'font-size': 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={t('table.export')}
              title={t('table.export')}
            >
              ⇩
            </button>
          </Show>
          <Show
            when={
              merged.selectable === 'multi' &&
              displaySelection().length > 0 &&
              merged.toolbar!.batch
            }
          >
            <button
              type="button"
              data-iris-table-toolbar-batch=""
              onClick={() => merged.toolbar!.batch!.onClick([...displaySelection()])}
              style={{
                border: 'none',
                cursor: 'pointer',
                background: 'var(--iris-primary)',
                color: 'var(--iris-primary-foreground)',
                'font-size': 'var(--iris-font-size-md, 14px)',
                display: 'inline-flex',
                'align-items': 'center',
                gap: 'var(--iris-space-xxs, 4px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                'border-radius': 'var(--iris-radius-sm, 4px)',
              }}
              aria-label={merged.toolbar!.batch!.label}
              title={merged.toolbar!.batch!.label}
            >
              <Show when={merged.toolbar!.batch!.icon}>
                <span aria-hidden="true" style={{ 'font-size': 'var(--iris-font-size-sm, 13px)' }}>
                  {merged.toolbar!.batch!.icon}
                </span>
              </Show>
              {merged.toolbar!.batch!.label}
            </button>
          </Show>
          <For each={merged.toolbar!.buttons ?? []}>
            {(btn) => (
              <button
                type="button"
                data-iris-table-toolbar-button={btn.key}
                {...{ [`data-iris-table-toolbar-button-${btn.key}`]: '' }}
                onClick={btn.onClick}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--iris-foreground)',
                  'font-size': 'var(--iris-font-size-md, 14px)',
                  display: 'inline-flex',
                  'align-items': 'center',
                  gap: 'var(--iris-space-xxs, 4px)',
                  padding: '0 var(--iris-space-xxs, 4px)',
                }}
                aria-label={btn.label}
                title={btn.label}
              >
                <Show when={btn.icon}>
                  <span
                    aria-hidden="true"
                    style={{ 'font-size': 'var(--iris-font-size-sm, 13px)' }}
                  >
                    {btn.icon}
                  </span>
                </Show>
                {btn.label}
              </button>
            )}
          </For>
        </div>
      </Show>

      <div
        ref={rootRef}
        // A keyboard-navigable hierarchical table is a `treegrid`; otherwise the
        // grid/table role as before (treegrid implies managed cell focus).
        role={merged.keyboardNavigation ? (treeMode() ? 'treegrid' : 'grid') : 'table'}
        data-iris-table=""
        data-column-virtualized={merged.columnVirtualization ? 'true' : undefined}
        onKeyDown={
          merged.keyboardNavigation || merged.cellRange
            ? (e: KeyboardEvent) => {
                if (merged.keyboardNavigation) handleGridKey(e)
                if (merged.cellRange) handleCellRangeKey(e)
              }
            : undefined
        }
        onPointerMove={
          merged.rowDrag || merged.columnDrag
            ? (e: PointerEvent) => {
                handleRowDragPointerMove(e)
                handleColDragPointerMove(e)
              }
            : undefined
        }
        onPointerUp={
          merged.rowDrag || merged.columnDrag
            ? () => {
                handleRowDragPointerUp()
                handleColDragPointerUp()
              }
            : undefined
        }
        onPointerLeave={merged.rowDrag ? handleRowDragPointerLeave : undefined}
        onScroll={
          merged.columnVirtualization
            ? (e: Event) => setScrollLeft((e.currentTarget as HTMLElement).scrollLeft)
            : undefined
        }
        style={{
          background: 'var(--iris-background)',
          color: 'var(--iris-foreground)',
          border: merged.bordered ? '1px solid var(--iris-border)' : 'none',
          'border-radius': 'var(--iris-radius-md)',
          // Column virtualization turns the table into a horizontal scroll container.
          overflow: merged.columnVirtualization ? 'auto' : 'hidden',
          ...(merged.style ?? {}),
        }}
      >
        {/* Multi-level (grouped) header: a CSS grid of `headerMatrix().length`
          rows; each cell placed by its leaf-column span (colStart/colSpan) and
          row span. Renders INSTEAD of the single-row header when grouped. */}
        <Show when={grouped() && headerMatrix()}>
          <div
            role="row"
            data-iris-table-row="header"
            data-iris-table-header-grouped=""
            style={{
              display: 'grid',
              'grid-template-columns': gridTemplate(),
              'grid-template-rows': `repeat(${headerMatrix()!.length}, auto)`,
            }}
          >
            <Show when={merged.rowDrag}>
              <div
                role="columnheader"
                data-iris-table-header="__drag"
                style={{ 'grid-column': '1', 'grid-row': '1 / -1' }}
              />
            </Show>
            <Show when={merged.seq}>
              <div
                role="columnheader"
                data-iris-table-header="__seq"
                style={{
                  'grid-column': String((merged.rowDrag ? 1 : 0) + 1),
                  'grid-row': '1 / -1',
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  padding: '8px',
                  background: 'var(--iris-surface)',
                  'border-bottom': '1px solid var(--iris-border)',
                }}
              />
            </Show>
            <Show when={hasDetail()}>
              <div
                role="columnheader"
                style={{
                  'grid-column': String((merged.rowDrag ? 1 : 0) + (merged.seq ? 2 : 1)),
                  'grid-row': '1 / -1',
                }}
              />
            </Show>
            <Show when={merged.selectable !== 'none'}>
              <div
                role="columnheader"
                style={{
                  'grid-column': String(
                    (merged.rowDrag ? 1 : 0) + (merged.seq ? 1 : 0) + (hasDetail() ? 2 : 1),
                  ),
                  'grid-row': '1 / -1',
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  padding: '8px',
                  background: 'var(--iris-surface)',
                  'border-bottom': '1px solid var(--iris-border)',
                }}
              >
                <Show when={merged.selectable === 'multi'}>
                  <input
                    type="checkbox"
                    checked={allSelected()}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected()
                    }}
                    onChange={toggleAll}
                    aria-label={t('table.selectAll')}
                  />
                  <Show when={props.selection && props.selection.length > 0}>
                    <span
                      data-iris-table-selected-count=""
                      style={{
                        'margin-inline-start': 'var(--iris-space-xs, 8px)',
                        'font-size': 'var(--iris-font-size-sm, 13px)',
                        color: 'var(--iris-muted)',
                        'white-space': 'nowrap',
                      }}
                    >
                      {t('table.selectedCount', { count: String(props.selection!.length) })}
                    </span>
                  </Show>
                </Show>
              </div>
            </Show>
            <For each={headerMatrix()!.flat()}>
              {(cell) => {
                const col = cell.column
                const isLeaf = (): boolean => !col.children || col.children.length === 0
                const sortable = (): boolean => isLeaf() && !!col.sortable
                const lead =
                  (merged.rowDrag ? 1 : 0) +
                  (merged.seq ? 1 : 0) +
                  (hasDetail() ? 1 : 0) +
                  (merged.selectable !== 'none' ? 1 : 0)
                return (
                  <div
                    role="columnheader"
                    data-iris-table-header={col.key}
                    data-iris-table-header-group={isLeaf() ? undefined : ''}
                    data-iris-col-drag-active={colDragActive() === col.key ? 'true' : undefined}
                    data-iris-col-drag-over={colDragOver() === col.key ? 'true' : undefined}
                    aria-colspan={cell.colSpan}
                    onPointerDown={
                      merged.columnDrag && isLeaf()
                        ? (e: PointerEvent) => handleColDragPointerDown(e, col.key)
                        : undefined
                    }
                    onClick={sortable() ? () => handleHeaderClick(col) : undefined}
                    aria-sort={sortable() ? sortAria(col) : undefined}
                    style={{
                      'grid-column': `${lead + cell.colStart} / span ${cell.colSpan}`,
                      'grid-row': `${cell.level + 1} / span ${cell.rowSpan}`,
                      position: 'relative',
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content': isLeaf() ? 'flex-start' : 'center',
                      padding: '8px var(--iris-padding-md)',
                      cursor: sortable() ? 'pointer' : 'default',
                      'user-select': sortable() ? 'none' : 'auto',
                      background: 'var(--iris-surface)',
                      'border-bottom': '1px solid var(--iris-border)',
                      'font-weight': '600',
                      'font-size': 'var(--iris-font-size-sm, 13px)',
                      color: 'var(--iris-foreground)',
                      'white-space': 'nowrap',
                      overflow: 'hidden',
                      'text-overflow': 'ellipsis',
                    }}
                  >
                    {col.title}
                    <Show when={sortable()}>{sortIndicator(col)}</Show>
                    {renderFilterTrigger(col, isLeaf())}
                  </div>
                )
              }}
            </For>
          </div>
        </Show>

        {/* Header (flat) — unchanged when not grouped. */}
        <Show when={!grouped()}>
          <div
            role="row"
            data-iris-table-header-row=""
            style={{
              display: 'grid',
              'grid-template-columns': gridTemplate(),
            }}
          >
            <Show when={merged.rowDrag}>
              <div
                role="columnheader"
                data-iris-table-header="__drag"
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  padding: '8px',
                  background: 'var(--iris-surface)',
                  'border-bottom': '1px solid var(--iris-border)',
                }}
              />
            </Show>
            <Show when={merged.seq}>
              <div
                role="columnheader"
                data-iris-table-header="__seq"
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  padding: '8px',
                  background: 'var(--iris-surface)',
                  'border-bottom': '1px solid var(--iris-border)',
                }}
              />
            </Show>
            <Show when={hasDetail()}>
              <div
                role="columnheader"
                data-iris-table-header="__expand"
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  padding: '8px',
                  background: 'var(--iris-surface)',
                  'border-bottom': '1px solid var(--iris-border)',
                }}
              />
            </Show>
            <Show when={merged.selectable !== 'none'}>
              <div
                role="columnheader"
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  padding: '8px',
                  background: 'var(--iris-surface)',
                  'border-bottom': '1px solid var(--iris-border)',
                }}
              >
                <Show when={merged.selectable === 'multi'}>
                  <input
                    type="checkbox"
                    checked={allSelected()}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected()
                    }}
                    onChange={toggleAll}
                    aria-label={t('table.selectAll')}
                  />
                  <Show when={props.selection && props.selection.length > 0}>
                    <span
                      data-iris-table-selected-count=""
                      style={{
                        'margin-inline-start': 'var(--iris-space-xs, 8px)',
                        'font-size': 'var(--iris-font-size-sm, 13px)',
                        color: 'var(--iris-muted)',
                        'white-space': 'nowrap',
                      }}
                    >
                      {t('table.selectedCount', { count: String(props.selection!.length) })}
                    </span>
                  </Show>
                </Show>
              </div>
            </Show>
            <For each={displayColumns()}>
              {(col, colIndexAccessor) => {
                const colIndex = colIndexAccessor()
                // Column virtualization: skip headers outside the visible window
                // (+ pinned); place rendered headers on their grid track.
                const inWindow = (): boolean => {
                  const set = visibleColSet()
                  return !set || set.has(colIndex)
                }
                return (
                  <Show when={inWindow()}>
                    <div
                      role="columnheader"
                      data-iris-table-header={col.key}
                      data-iris-table-pinned={col.pinned}
                      data-iris-col-drag-active={colDragActive() === col.key ? 'true' : undefined}
                      data-iris-col-drag-over={colDragOver() === col.key ? 'true' : undefined}
                      onPointerDown={
                        merged.columnDrag
                          ? (e: PointerEvent) => handleColDragPointerDown(e, col.key)
                          : undefined
                      }
                      onClick={() => handleHeaderClick(col)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content':
                          col.align === 'right'
                            ? 'flex-end'
                            : col.align === 'center'
                              ? 'center'
                              : 'flex-start',
                        padding: '8px var(--iris-padding-md)',
                        cursor: col.sortable ? 'pointer' : 'default',
                        'user-select': col.sortable ? 'none' : 'auto',
                        background: 'var(--iris-surface)',
                        'border-bottom': '1px solid var(--iris-border)',
                        'font-weight': '600',
                        'font-size': 'var(--iris-font-size-sm, 13px)',
                        color: 'var(--iris-foreground)',
                        'white-space': 'nowrap',
                        overflow: 'hidden',
                        'text-overflow': 'ellipsis',
                        ...(visibleColSet()
                          ? { 'grid-column-start': String(colTrack(colIndex)) }
                          : {}),
                      }}
                      aria-sort={sortAria(col)}
                    >
                      {col.title}
                      {sortIndicator(col)}
                      {renderFilterTrigger(col, true)}
                      <Show when={merged.resizableColumns}>
                        <ColumnResizeHandle
                          colKey={col.key}
                          label={col.title}
                          width={() => widthOf(col)}
                          minWidth={col.minWidth ?? DEFAULT_MIN_WIDTH}
                          maxWidth={col.maxWidth ?? Infinity}
                          onResize={(key, w) => setColumnWidths({ ...effectiveWidths(), [key]: w })}
                        />
                      </Show>
                    </div>
                  </Show>
                )
              }}
            </For>
          </div>
        </Show>

        {/* Body */}
        <Show
          when={!tableError() && !tableLoading()}
          fallback={
            <Show
              when={tableError()}
              fallback={
                <div
                  role="row"
                  aria-busy="true"
                  data-iris-table-row="loading"
                  style={stateRowStyle}
                >
                  {props.loadingState ?? t('table.loading')}
                </div>
              }
            >
              <div role="row" data-iris-table-row="error" style={stateRowStyle}>
                <span
                  style={{
                    'margin-inline-end': props.onRetry ? 'var(--iris-space-sm, 12px)' : '0px',
                  }}
                >
                  {props.errorState ?? t('table.error')}
                </span>
                <Show when={props.onRetry || hasProxy()}>
                  <button
                    type="button"
                    data-iris-table-retry=""
                    onClick={() => {
                      // Proxy mode: the built-in retry re-queries (vxe parity).
                      if (proxy) void proxy.refetch()
                      props.onRetry?.()
                    }}
                    style={{
                      border: '1px solid var(--iris-border)',
                      background: 'var(--iris-surface)',
                      color: 'var(--iris-foreground)',
                      'border-radius': 'var(--iris-radius-sm, 4px)',
                      padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                      'font-size': 'var(--iris-font-size-sm, 13px)',
                      cursor: 'pointer',
                    }}
                  >
                    {t('table.retry')}
                  </button>
                </Show>
              </div>
            </Show>
          }
        >
          <Show
            when={bodyRows().length > 0}
            fallback={
              <div role="row" data-iris-table-row="empty" style={stateRowStyle}>
                {props.emptyState ?? t('table.empty')}
              </div>
            }
          >
            <Show
              when={merged.virtualScroll && (!treeMode() || !hasDetail())}
              fallback={
                <div role="rowgroup" data-iris-table-body="">
                  <For each={bodyEntries()}>
                    {(entry, indexAccessor) => {
                      const row = entry.row
                      const treeMeta = entry.meta
                      const index = indexAccessor()
                      const id = rowId(row, index)
                      const expanded = (): boolean => expandedKeys().includes(String(id))
                      const expandable = (): boolean => isRowExpandable(row, index)
                      return (
                        <>
                          {renderRow(row, index, treeMeta)}
                          {/* Full-width detail panel beneath an expanded, expandable
                            row (spans all grid tracks). Only in the non-virtual path. */}
                          <Show when={hasDetail() && expandable() && expanded()}>
                            <div
                              role="row"
                              data-iris-table-row-detail={String(id)}
                              style={{
                                display: 'grid',
                                'grid-template-columns': gridTemplate(),
                              }}
                            >
                              <div
                                role="cell"
                                data-iris-table-detail-cell=""
                                style={{
                                  'grid-column': '1 / -1',
                                  padding: '8px 12px',
                                  'border-bottom': '1px solid var(--iris-border)',
                                }}
                              >
                                {props.renderDetail!(row, index)}
                              </div>
                            </div>
                          </Show>
                        </>
                      )
                    }}
                  </For>
                </div>
              }
            >
              {/* Virtualize flat mode, and tree mode too — tree rows are uniform
                height, so the only thing that bars it is variable-height detail
                panels, hence the `!hasDetail()` guard. `bodyRows()` is the flattened
                visible rows (= sortedRows() in flat mode); `flatTree()?.[idx]`
                supplies each row's tree meta (depth + toggle), with `idx` the
                absolute row index the scroller passes its render callback. */}
              <IrisVirtualScroll
                items={bodyRows()}
                itemHeight={merged.virtualScroll!.itemHeight}
                height={merged.virtualScroll!.height}
                buffer={merged.virtualScroll!.buffer}
                keyOf={(row, idx) => rowId(row, idx)}
                renderItem={(row, idx) => renderRow(row, idx, flatTree()?.[idx] ?? null)}
              />
            </Show>
          </Show>
        </Show>

        {/* Summary / footer row: each column with a `summary` op aggregates over
          the full sorted dataset (the core `aggregate` material). */}
        <Show
          when={
            !tableError() &&
            !tableLoading() &&
            bodyRows().length > 0 &&
            leafColumns().some((c) => c.summary)
          }
        >
          <div
            role="row"
            data-iris-table-row="summary"
            style={{
              display: 'grid',
              'grid-template-columns': gridTemplate(),
              'font-weight': '600',
              'border-top': '2px solid var(--iris-border)',
              background: 'var(--iris-surface)',
            }}
          >
            <Show when={merged.rowDrag}>
              <div
                role="cell"
                data-iris-table-cell="__drag"
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  padding: '8px',
                  'border-bottom': '1px solid var(--iris-border)',
                }}
              />
            </Show>
            <Show when={merged.seq}>
              <div
                role="cell"
                data-iris-table-cell="__seq"
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  padding: '8px',
                  'border-bottom': '1px solid var(--iris-border)',
                }}
              />
            </Show>
            <Show when={merged.selectable !== 'none'}>
              <div
                role="cell"
                data-iris-table-cell="__selection"
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  padding: '8px',
                  'border-bottom': '1px solid var(--iris-border)',
                }}
              />
            </Show>
            <For each={leafColumns()}>
              {(col, colIndexAccessor) => {
                const colIndex = colIndexAccessor()
                const op = col.summary
                const value = op ? aggregate(bodyRows(), (r) => getCellValue(r, col), op) : null
                // Column virtualization: skip summary cells outside the window
                // (+ pinned); place rendered cells on their grid track.
                const inWindow = (): boolean => {
                  const set = visibleColSet()
                  return !set || set.has(colIndex)
                }
                return (
                  <Show when={inWindow()}>
                    <div
                      role="cell"
                      data-iris-table-cell={col.key}
                      data-iris-table-summary-cell={op ? '' : undefined}
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content':
                          col.align === 'right'
                            ? 'flex-end'
                            : col.align === 'center'
                              ? 'center'
                              : 'flex-start',
                        padding: '8px var(--iris-padding-md)',
                        'border-bottom': '1px solid var(--iris-border)',
                        'font-size': 'var(--iris-font-size-md, 14px)',
                        'white-space': 'nowrap',
                        overflow: 'hidden',
                        'text-overflow': 'ellipsis',
                        ...(visibleColSet()
                          ? { 'grid-column-start': String(colTrack(colIndex)) }
                          : {}),
                      }}
                    >
                      <Show when={op != null && value != null}>
                        <Show when={col.renderSummary} fallback={String(value)}>
                          {col.renderSummary!(value!, bodyRows())}
                        </Show>
                      </Show>
                    </div>
                  </Show>
                )
              }}
            </For>
          </div>
        </Show>

        {/* Server-side pager (vxe-grid proxyConfig parity): driven by the
          controller's page/pageSize/total; page changes call setParams and
          proxyConfig.onPageChange. */}
        <Show when={hasProxy()}>
          <div
            data-iris-table-pager=""
            style={{
              display: 'flex',
              'justify-content': 'flex-end',
              'align-items': 'center',
              padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
              'border-top': '1px solid var(--iris-border)',
              background: 'var(--iris-surface)',
            }}
          >
            <div
              style={{ display: 'flex', 'align-items': 'center', gap: 'var(--iris-space-xs, 8px)' }}
            >
              <Show when={merged.pagerConfig?.showTotal}>
                <span
                  data-iris-table-total=""
                  style={{ color: 'var(--iris-muted)', 'white-space': 'nowrap' }}
                >
                  {t('table.total', { total: proxyState().total })}
                </span>
              </Show>
              <Show
                when={merged.pagerConfig?.pageSizes && merged.pagerConfig!.pageSizes!.length > 0}
              >
                <IrisSelect
                  items={(merged.pagerConfig?.pageSizes ?? []).map((s) => ({
                    value: String(s),
                    label: `${s} / ${t('table.page')}`,
                  }))}
                  value={String(proxyState().params.pageSize)}
                  onValueChange={(v) => {
                    const size = Number(v)
                    proxy?.setParams({ pageSize: size, page: 1 })
                    props.proxyConfig?.onPageChange?.(1, size)
                  }}
                  aria-label={t('table.pageSize')}
                />
              </Show>
              <IrisPagination
                total={proxyState().total}
                pageSize={proxyState().params.pageSize}
                page={proxyState().params.page}
                onChange={(page) => {
                  proxy?.setParams({ page })
                  props.proxyConfig?.onPageChange?.(page, proxyState().params.pageSize)
                }}
              />
            </div>
          </div>
        </Show>
      </div>

      {/* Right-click context menu (vxe contextMenu parity): portaled to body,
        positioned at the cursor via the virtual anchor. */}
      <Show when={contextMenuState()}>
        {(state) => (
          <TableContextMenu
            open={state().open}
            anchor={contextAnchor}
            items={state().items}
            params={state().params}
            onSelect={(key, params) => merged.contextMenu?.onSelect(key, params)}
            onClose={closeContextMenu}
          />
        )}
      </Show>

      {/* Header filter panel (vxe filterConfig parity): keyed Show on the
        state object identity → each open remounts the panel so its draft
        checkbox state re-seeds from the applied filterValues. */}
      <Show when={filterPanelState()}>
        {(state) => {
          const fcol = displayColumns().find((c) => c.key === state().colKey)
          if (!fcol || !fcol.filterable) return null
          return (
            <TableFilterPanel
              open={state().open}
              anchor={filterAnchor}
              columnKey={fcol.key}
              options={fcol.filterOptions ?? []}
              initialChecked={props.filterValues?.[fcol.key] ?? []}
              onApply={applyFilterValues}
              onClear={clearFilterValues}
              onClose={closeFilterPanel}
              t={t}
            />
          )
        }}
      </Show>
    </>
  )
}
