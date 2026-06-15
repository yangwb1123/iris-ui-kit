import { createSignal, createEffect, onCleanup, For, Show, type JSX } from 'solid-js'
import { createSortable, createVirtualizer, type SortableRect } from '@iris-ui/core'
import { proTableLabel, type ProTableStore, type ProTableLabels } from '../core'

export type { ProTableColumn, ProTableStore, ProTableLabels } from '../core'

/** Collect drop-target rects (id + client rect) for every `[attr]` under `root`. */
function collectRects(root: HTMLElement | null, attr: string): SortableRect[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(`[${attr}]`)).map((el) => {
    const r = el.getBoundingClientRect()
    return {
      id: el.getAttribute(attr)!,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    }
  })
}

export interface IrisProTableProps<Row extends Record<string, unknown>> {
  store: ProTableStore<Row>
  class?: string
  /**
   * Host-overridable UI strings (aria-labels + pager). Pass localized values
   * (e.g. from the adapter's `useI18n().t`) — plugins can't reach adapter i18n
   * directly. Defaults to English.
   */
  labels?: ProTableLabels
  /**
   * Enable drag-to-reorder column headers. When `true` every column `<th>`
   * becomes draggable and drop onto another header calls `store.reorderColumns`.
   * Default `false` — existing layouts are unchanged.
   */
  columnReorder?: boolean
  /**
   * Opt-in row virtualization. When `true` the body region becomes a scroll
   * container and only the visible window of rows is rendered (via core's
   * `createVirtualizer`), so a 100k-row table renders a handful of `<tr>` rather
   * than every row. Default `false` — behavior is UNCHANGED (all rows render).
   */
  virtualized?: boolean
  /** Estimated row height in px (drives the virtualizer). Default `40`. */
  rowHeight?: number
  /** Scroll viewport height in px when virtualized. Default `400`. */
  maxHeight?: number
}

function pinnedStyle(column: { pinned?: 'left' | 'right' }): JSX.CSSProperties | undefined {
  if (!column.pinned) return undefined
  return { position: 'sticky', [column.pinned]: '0', 'z-index': 1 }
}

/**
 * vxe-table-style CRUD data table for SolidJS. Subscribes to the
 * framework-agnostic {@link ProTableStore} via a signal.
 */
export function IrisProTable<Row extends Record<string, unknown>>(props: IrisProTableProps<Row>) {
  const [state, setState] = createSignal(props.store.getState())
  const [draft, setDraft] = createSignal('')
  // Drag-to-reorder: plain mutable — no signal needed (no re-render on drag events).
  let dragKey: string | null = null
  const unsub = props.store.subscribe((s) => {
    setState(s)
    if (s.editing) {
      const row = s.rows.find((r) => props.store.rowKeyOf(r) === s.editing!.rowKey)
      const col = props.store.visibleColumns().find((c) => c.key === s.editing!.columnKey)
      if (row && col) setDraft(String(props.store.cellValue(row, col) ?? ''))
    }
  })
  onCleanup(unsub)

  // Touch/pen column reorder via the shared core controller. Native HTML5 DnD
  // (the `draggable` <th>) never fires on touch, so the pointer path drives the
  // reorder there; it is gated on `pointerType !== 'mouse'` so the mouse flow is
  // unchanged. A bare tap (down→up, no move) leaves overId null → no reorder,
  // so header-tap sorting still works.
  const sortable = createSortable()
  const [sortableState, setSortableState] = createSignal(sortable.getState())
  onCleanup(sortable.subscribe(() => setSortableState(sortable.getState())))
  // Header rects, measured ONCE when a drag actually starts (not per move).
  // Plain mutable var — no signal needed (rects don't drive rendering).
  let dragRects: SortableRect[] = []

  const onHeaderPointerDown = (key: string) => (e: PointerEvent) => {
    if (!props.columnReorder || e.pointerType === 'mouse') return
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
    // Record a pending press — no store write, so a tap (header sort) never re-renders.
    sortable.press(key, e.clientX, e.clientY)
  }
  const onHeaderPointerMove = (key: string) => (e: PointerEvent) => {
    if (sortable.tryStart(e.clientX, e.clientY)) {
      const root = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-iris-pro-table]')
      dragRects = collectRects(root, 'data-iris-col-key')
    }
    if (!sortable.isActive(key)) return
    sortable.moveOver({ x: e.clientX, y: e.clientY }, dragRects)
  }
  const onHeaderPointerUp = (key: string) => () => {
    if (!sortable.isActive(key)) {
      sortable.cancel() // clear a pending tap (idle → no re-render); header-tap sort still works
      return
    }
    const { activeId, overId } = sortable.end()
    if (activeId && overId && activeId !== overId) props.store.reorderColumns(activeId, overId)
  }

  const columns = () => props.store.visibleColumns()

  // --- Row virtualization (opt-in) -----------------------------------------
  // Defaults mirror the React reference exactly.
  const rowHeight = () => props.rowHeight ?? 40
  const maxHeight = () => props.maxHeight ?? 400

  // Create the virtualizer ONCE. viewportSize is driven from the `maxHeight`
  // PROP (not a measured clientHeight) so the window is deterministic in jsdom.
  // `getItemKey` reads `state().rows` so it always sees the current page's data.
  const virtualizer = createVirtualizer({
    count: state().rows.length,
    estimateSize: rowHeight(),
    viewportSize: maxHeight(),
    getItemKey: (i) => String(props.store.rowKeyOf(state().rows[i]!)),
  })

  // Bridge the virtualizer store the SAME way the component bridges the
  // pro-table store: a signal updated on every emit, read through `<For>` /
  // accessor calls so the window re-renders reactively on setScroll. A plain
  // .map outside a tracked scope would NOT update.
  const [vState, setVState] = createSignal(virtualizer.getState())
  onCleanup(virtualizer.subscribe(() => setVState(virtualizer.getState())))

  // Keep the virtualizer's count synced with the current page's row count, and
  // its viewport synced if the maxHeight prop changes. These run in tracked
  // scopes so they react to store/prop changes.
  createEffect(() => virtualizer.setCount(state().rows.length))
  createEffect(() => virtualizer.setViewportSize(maxHeight()))

  const sortIndicator = (key: string): string => {
    const sort = state().sort
    return sort?.key === key ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''
  }
  // WAI-ARIA grid sort semantics: aria-sort on the header conveys state to
  // screen readers (the visual ▲/▼ is decorative/aria-hidden), and sortable
  // headers are keyboard-operable (Enter/Space) — mirrors the base IrisTable.
  const ariaSort = (
    c: ReturnType<typeof columns>[number],
  ): 'ascending' | 'descending' | 'none' | undefined => {
    const sort = state().sort
    return sort?.key === c.key
      ? sort.direction === 'asc'
        ? 'ascending'
        : 'descending'
      : c.sortable
        ? 'none'
        : undefined
  }

  // +1 for the leading checkbox column.
  const totalColumnCount = () => columns().length + 1

  // Single source of truth for a data row's markup — shared by the windowed
  // (virtualized) and full (non-virtualized) render paths so selection, inline
  // edit, filters, and pinnedStyle are identical in both.
  const renderRow = (row: Row): JSX.Element => {
    const key = props.store.rowKeyOf(row)
    return (
      <tr data-selected={props.store.isSelected(key) ? '' : undefined}>
        <td>
          <input
            type="checkbox"
            aria-label={proTableLabel(props.labels, 'selectRow', { key: String(key) })}
            checked={props.store.isSelected(key)}
            onChange={() => props.store.toggleRow(key)}
          />
        </td>
        <For each={columns()}>
          {(c) => {
            const editing = () =>
              state().editing?.rowKey === key && state().editing?.columnKey === c.key
            return (
              <td
                style={{ 'text-align': c.align, ...pinnedStyle(c) }}
                onDblClick={c.editable ? () => props.store.startEdit(key, c.key) : undefined}
              >
                <Show when={editing()} fallback={String(props.store.cellValue(row, c) ?? '')}>
                  <input
                    type={c.editor === 'number' ? 'number' : 'text'}
                    value={draft()}
                    onInput={(e) => setDraft(e.currentTarget.value)}
                    onBlur={() => props.store.commitEdit(draft())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') props.store.commitEdit(draft())
                      if (e.key === 'Escape') props.store.cancelEdit()
                    }}
                  />
                </Show>
              </td>
            )
          }}
        </For>
      </tr>
    )
  }

  // Pixel height of the bottom spacer = total scroll size minus the offset
  // before the window minus the summed height of the rendered window.
  const offsetAfter = (): number => {
    const v = vState()
    const windowSize = v.items.reduce((sum, it) => sum + it.size, 0)
    return Math.max(0, v.totalSize - v.offsetBefore - windowSize)
  }

  // The <tbody> contents. When virtualized, render ONLY the windowed rows with a
  // top/bottom spacer <tr> so the scrollbar height is preserved.
  const tbody = () => (
    <tbody>
      <Show
        when={props.virtualized}
        fallback={<For each={state().rows}>{(row) => renderRow(row)}</For>}
      >
        <Show when={vState().offsetBefore > 0}>
          <tr style={{ height: `${vState().offsetBefore}px` }} aria-hidden="true">
            <td colSpan={totalColumnCount()} />
          </tr>
        </Show>
        <For each={vState().items}>
          {(item) => {
            const row = state().rows[item.index]
            return <Show when={row !== undefined}>{renderRow(row!)}</Show>
          }}
        </For>
        <Show when={offsetAfter() > 0}>
          <tr style={{ height: `${offsetAfter()}px` }} aria-hidden="true">
            <td colSpan={totalColumnCount()} />
          </tr>
        </Show>
      </Show>
    </tbody>
  )

  const tableEl = () => (
    <table>
      <thead>
        <tr>
          <th scope="col">
            <input
              type="checkbox"
              aria-label={proTableLabel(props.labels, 'selectAll')}
              checked={props.store.isAllSelected()}
              onChange={() => props.store.toggleAll()}
            />
          </th>
          <For each={columns()}>
            {(c) => (
              <th
                scope="col"
                data-iris-col-key={c.key}
                aria-sort={ariaSort(c)}
                tabindex={c.sortable ? 0 : undefined}
                style={{
                  'text-align': c.align,
                  width: typeof c.width === 'number' ? `${c.width}px` : c.width,
                  cursor: props.columnReorder ? 'grab' : undefined,
                  'touch-action': props.columnReorder ? 'none' : undefined,
                  outline:
                    sortableState().activeId &&
                    sortableState().overId === c.key &&
                    sortableState().activeId !== c.key
                      ? '2px solid var(--iris-color-primary, #2563eb)'
                      : undefined,
                  'outline-offset': '-2px',
                  ...pinnedStyle(c),
                }}
                data-sortable={c.sortable ? '' : undefined}
                onClick={c.sortable ? () => props.store.toggleSort(c.key) : undefined}
                onKeyDown={
                  c.sortable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          props.store.toggleSort(c.key)
                        }
                      }
                    : undefined
                }
                onPointerDown={onHeaderPointerDown(c.key)}
                onPointerMove={onHeaderPointerMove(c.key)}
                onPointerUp={onHeaderPointerUp(c.key)}
                onPointerCancel={() => sortable.cancel()}
                draggable={props.columnReorder ? true : undefined}
                onDragStart={
                  props.columnReorder
                    ? (e) => {
                        dragKey = c.key
                        e.dataTransfer!.effectAllowed = 'move'
                      }
                    : undefined
                }
                onDragOver={
                  props.columnReorder
                    ? (e) => {
                        e.preventDefault()
                        e.dataTransfer!.dropEffect = 'move'
                      }
                    : undefined
                }
                onDrop={
                  props.columnReorder
                    ? (e) => {
                        e.preventDefault()
                        if (dragKey && dragKey !== c.key) {
                          props.store.reorderColumns(dragKey, c.key)
                        }
                        dragKey = null
                      }
                    : undefined
                }
              >
                {c.title}
                <span aria-hidden="true">{sortIndicator(c.key)}</span>
              </th>
            )}
          </For>
        </tr>
        <Show when={columns().some((c) => c.filterable)}>
          <tr>
            <th />
            <For each={columns()}>
              {(c) => (
                <th>
                  <Show when={c.filterable}>
                    <input
                      aria-label={proTableLabel(props.labels, 'filterColumn', { title: c.title })}
                      value={state().filters[c.key] ?? ''}
                      onInput={(e) => props.store.setFilter(c.key, e.currentTarget.value)}
                    />
                  </Show>
                </th>
              )}
            </For>
          </tr>
        </Show>
      </thead>
      {tbody()}
    </table>
  )

  return (
    <div data-iris-pro-table="" class={props.class}>
      <Show when={props.virtualized} fallback={tableEl()}>
        <div
          data-iris-pro-table-scroll=""
          style={{ overflow: 'auto', height: `${maxHeight()}px` }}
          onScroll={(e) => virtualizer.setScroll(e.currentTarget.scrollTop)}
        >
          {tableEl()}
        </div>
      </Show>
      <Show when={Object.keys(state().filters).some((k) => state().filters[k])}>
        <div
          data-iris-filter-chips=""
          style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '0.25rem', padding: '0.25rem 0' }}
        >
          <For each={Object.keys(state().filters).filter((k) => state().filters[k])}>
            {(k) => {
              const col = state().columns.find((c) => c.key === k)
              const title = col?.title ?? k
              return (
                <span
                  style={{
                    display: 'inline-flex',
                    'align-items': 'center',
                    gap: '0.25rem',
                    padding: '0.125rem 0.5rem',
                    background: 'var(--iris-chip-bg, var(--iris-surface-alt, #f3f4f6))',
                    'border-radius': '9999px',
                  }}
                >
                  {title}: &ldquo;{state().filters[k]}&rdquo;
                  <button
                    type="button"
                    aria-label={`Clear filter ${title}`}
                    onClick={() => props.store.setFilter(k, '')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                  >
                    ×
                  </button>
                </span>
              )
            }}
          </For>
          <button
            type="button"
            onClick={() => props.store.clearFilters()}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Clear all ×
          </button>
        </div>
      </Show>
      <div data-iris-pro-table-footer="">
        <button
          type="button"
          disabled={state().page <= 1}
          onClick={() => props.store.setPage(state().page - 1)}
        >
          {proTableLabel(props.labels, 'prev')}
        </button>
        <span data-iris-pro-table-page="">
          {state().page} / {props.store.pageCount()}
        </span>
        <button
          type="button"
          disabled={state().page >= props.store.pageCount()}
          onClick={() => props.store.setPage(state().page + 1)}
        >
          {proTableLabel(props.labels, 'next')}
        </button>
      </div>
    </div>
  )
}
