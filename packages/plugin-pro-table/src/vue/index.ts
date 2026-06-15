import {
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import { createSortable, createVirtualizer, type SortableRect } from '@iris-ui/core'
import {
  proTableLabel,
  type ProTableColumn,
  type ProTableStore,
  type ProTableLabels,
} from '../core'

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

function pinnedStyle(column: ProTableColumn): Record<string, string> | undefined {
  if (!column.pinned) return undefined
  return { position: 'sticky', [column.pinned]: '0', zIndex: '1' }
}

/**
 * vxe-table-style CRUD data table for Vue (render-function authored, matching
 * the `@iris-ui/vue` convention). Subscribes to the framework-agnostic
 * {@link ProTableStore}.
 */
export const IrisProTable = defineComponent({
  name: 'IrisProTable',
  props: {
    store: { type: Object as PropType<ProTableStore>, required: true },
    /**
     * Host-overridable UI strings (aria-labels + pager). Pass localized values
     * (e.g. from the adapter's `useI18n().t`) — plugins can't reach adapter i18n
     * directly. Defaults to English.
     */
    labels: { type: Object as PropType<ProTableLabels>, default: undefined },
    /**
     * Enable drag-to-reorder column headers. When `true` every column `<th>`
     * becomes draggable and drop onto another header calls `store.reorderColumns`.
     * Default `false` — existing layouts are unchanged.
     */
    columnReorder: { type: Boolean, default: false },
    /**
     * Opt-in row virtualization. When `true` the body region becomes a scroll
     * container and only the visible window of rows is rendered (via core's
     * `createVirtualizer`), so a 100k-row table renders a handful of `<tr>` rather
     * than every row. Default `false` — behavior is UNCHANGED (all rows render).
     */
    virtualized: { type: Boolean, default: false },
    /** Estimated row height in px (drives the virtualizer). Default `40`. */
    rowHeight: { type: Number, default: 40 },
    /** Scroll viewport height in px when virtualized. Default `400`. */
    maxHeight: { type: Number, default: 400 },
  },
  setup(props) {
    const state = shallowRef(props.store.getState())
    const draft = ref('')
    // Drag-to-reorder: mutable ref — no reactivity needed (no re-render on drag).
    let dragKey: string | null = null
    let unsub = () => {}

    // Touch/pen column reorder via the shared core controller. Native HTML5 DnD
    // (the `draggable` <th>) never fires on touch, so the pointer path drives the
    // reorder there; it is gated on `pointerType !== 'mouse'` so the mouse flow is
    // unchanged. A bare tap (down→up, no move) leaves overId null → no reorder,
    // so header-tap sorting still works.
    const sortable = createSortable()
    const sortableState = shallowRef(sortable.getState())
    let unsubSortable = () => {}
    // Header rects, measured ONCE when a drag actually starts (not per move).
    // Plain closure var — no reactivity needed (rects don't drive rendering).
    let dragRects: SortableRect[] = []

    // --- Row virtualization (opt-in) -----------------------------------------
    // Create the virtualizer ONCE. viewportSize is driven from the `maxHeight`
    // PROP (not a measured clientHeight) so the window is deterministic in jsdom.
    // `getItemKey` reads `state.value.rows` so it always sees the current page's
    // data (the virtualizer instance is created once).
    const virtualizer = createVirtualizer({
      count: state.value.rows.length,
      estimateSize: props.rowHeight,
      viewportSize: props.maxHeight,
      getItemKey: (i) => String(props.store.rowKeyOf(state.value.rows[i]!)),
    })
    // Bridge the virtualizer store reactively the SAME way the pro-table store is
    // bridged: a shallowRef updated from its subscription (set up in onMounted).
    const vState = shallowRef(virtualizer.getState())
    let unsubVirtual = () => {}

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
    const onHeaderPointerCancel = () => () => {
      sortable.cancel()
    }

    onMounted(() => {
      unsub = props.store.subscribe((s) => {
        state.value = s
        if (s.editing) {
          const row = s.rows.find((r) => props.store.rowKeyOf(r) === s.editing!.rowKey)
          const col = props.store.visibleColumns().find((c) => c.key === s.editing!.columnKey)
          if (row && col) draft.value = String(props.store.cellValue(row, col) ?? '')
        }
      })
      unsubSortable = sortable.subscribe(() => {
        sortableState.value = sortable.getState()
      })
      unsubVirtual = virtualizer.subscribe((s) => {
        vState.value = s
      })
    })
    onUnmounted(() => {
      unsub()
      unsubSortable()
      unsubVirtual()
    })

    // Keep the virtualizer's count in sync with the current page's row count, and
    // its viewport in sync if the maxHeight prop changes (mirrors React's effects).
    watch(
      () => state.value.rows.length,
      (len) => virtualizer.setCount(len),
    )
    watch(
      () => props.maxHeight,
      (h) => virtualizer.setViewportSize(h),
    )

    const sortIndicator = (key: string): string => {
      const sort = state.value.sort
      return sort?.key === key ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''
    }
    // WAI-ARIA grid sort semantics: aria-sort on the header conveys state to
    // screen readers (the visual ▲/▼ is decorative/aria-hidden), and sortable
    // headers are keyboard-operable (Enter/Space) — mirrors the base IrisTable.
    const ariaSort = (c: ProTableColumn): 'ascending' | 'descending' | 'none' | undefined => {
      const sort = state.value.sort
      return sort?.key === c.key
        ? sort.direction === 'asc'
          ? 'ascending'
          : 'descending'
        : c.sortable
          ? 'none'
          : undefined
    }

    return () => {
      const columns = props.store.visibleColumns()
      const hasFilter = columns.some((c) => c.filterable)

      const headerCells: VNode[] = [
        h('th', { scope: 'col' }, [
          h('input', {
            type: 'checkbox',
            'aria-label': proTableLabel(props.labels, 'selectAll'),
            checked: props.store.isAllSelected(),
            onChange: () => props.store.toggleAll(),
          }),
        ]),
        ...columns.map((c) =>
          h(
            'th',
            {
              key: c.key,
              scope: 'col',
              'data-iris-col-key': c.key,
              'aria-sort': ariaSort(c),
              tabindex: c.sortable ? 0 : undefined,
              style: {
                textAlign: c.align,
                width: c.width,
                cursor: props.columnReorder ? 'grab' : undefined,
                touchAction: props.columnReorder ? 'none' : undefined,
                outline:
                  sortableState.value.activeId &&
                  sortableState.value.overId === c.key &&
                  sortableState.value.activeId !== c.key
                    ? '2px solid var(--iris-color-primary, #2563eb)'
                    : undefined,
                outlineOffset: '-2px',
                ...pinnedStyle(c),
              },
              'data-sortable': c.sortable ? '' : undefined,
              onClick: c.sortable ? () => props.store.toggleSort(c.key) : undefined,
              onKeydown: c.sortable
                ? (e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      props.store.toggleSort(c.key)
                    }
                  }
                : undefined,
              onPointerdown: onHeaderPointerDown(c.key),
              onPointermove: onHeaderPointerMove(c.key),
              onPointerup: onHeaderPointerUp(c.key),
              onPointercancel: onHeaderPointerCancel(),
              draggable: props.columnReorder ? true : undefined,
              onDragstart: props.columnReorder
                ? (e: DragEvent) => {
                    dragKey = c.key
                    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
                  }
                : undefined,
              onDragover: props.columnReorder
                ? (e: DragEvent) => {
                    e.preventDefault()
                    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                  }
                : undefined,
              onDrop: props.columnReorder
                ? (e: DragEvent) => {
                    e.preventDefault()
                    if (dragKey && dragKey !== c.key) {
                      props.store.reorderColumns(dragKey, c.key)
                    }
                    dragKey = null
                  }
                : undefined,
            },
            [c.title, h('span', { 'aria-hidden': 'true' }, sortIndicator(c.key))],
          ),
        ),
      ]

      const filterRow = hasFilter
        ? h('tr', [
            h('th'),
            ...columns.map((c) =>
              h(
                'th',
                { key: c.key },
                c.filterable
                  ? [
                      h('input', {
                        'aria-label': proTableLabel(props.labels, 'filterColumn', {
                          title: c.title,
                        }),
                        value: state.value.filters[c.key] ?? '',
                        onInput: (e: Event) =>
                          props.store.setFilter(c.key, (e.target as HTMLInputElement).value),
                      }),
                    ]
                  : [],
              ),
            ),
          ])
        : null

      // Single source of truth for a data row's markup — shared by the windowed
      // (virtualized) and full (non-virtualized) render paths so selection, inline
      // edit, filters, and pinnedStyle are identical in both.
      const renderRow = (row: Record<string, unknown>): VNode => {
        const key = props.store.rowKeyOf(row)
        return h('tr', { key, 'data-selected': props.store.isSelected(key) ? '' : undefined }, [
          h('td', [
            h('input', {
              type: 'checkbox',
              'aria-label': proTableLabel(props.labels, 'selectRow', { key: String(key) }),
              checked: props.store.isSelected(key),
              onChange: () => props.store.toggleRow(key),
            }),
          ]),
          ...columns.map((c) => {
            const editing =
              state.value.editing?.rowKey === key && state.value.editing?.columnKey === c.key
            return h(
              'td',
              {
                key: c.key,
                style: { textAlign: c.align, ...pinnedStyle(c) },
                onDblclick: c.editable ? () => props.store.startEdit(key, c.key) : undefined,
              },
              editing
                ? [
                    h('input', {
                      type: c.editor === 'number' ? 'number' : 'text',
                      value: draft.value,
                      onInput: (e: Event) => (draft.value = (e.target as HTMLInputElement).value),
                      onBlur: () => props.store.commitEdit(draft.value),
                      onKeydown: (e: KeyboardEvent) => {
                        if (e.key === 'Enter') props.store.commitEdit(draft.value)
                        if (e.key === 'Escape') props.store.cancelEdit()
                      },
                    }),
                  ]
                : String(props.store.cellValue(row, c) ?? ''),
            )
          }),
        ])
      }

      // +1 for the leading checkbox column.
      const totalColumnCount = columns.length + 1

      // The <tbody> children. When virtualized, render ONLY the windowed rows with
      // a top/bottom spacer <tr> so the scrollbar height is preserved. Spacers use
      // a single colspan <td> and are aria-hidden so tests can exclude them.
      let bodyRows: VNode[]
      if (props.virtualized) {
        const v = vState.value
        const windowSize = v.items.reduce((sum, it) => sum + it.size, 0)
        const after = Math.max(0, v.totalSize - v.offsetBefore - windowSize)
        bodyRows = []
        if (v.offsetBefore > 0) {
          bodyRows.push(
            h('tr', { style: { height: `${v.offsetBefore}px` }, 'aria-hidden': 'true' }, [
              h('td', { colspan: totalColumnCount }),
            ]),
          )
        }
        for (const item of v.items) {
          const row = state.value.rows[item.index]
          if (row !== undefined) bodyRows.push(renderRow(row))
        }
        if (after > 0) {
          bodyRows.push(
            h('tr', { style: { height: `${after}px` }, 'aria-hidden': 'true' }, [
              h('td', { colspan: totalColumnCount }),
            ]),
          )
        }
      } else {
        bodyRows = state.value.rows.map((row) => renderRow(row))
      }

      const activeFilters = Object.keys(state.value.filters).filter((k) => state.value.filters[k])
      const colByKey = new Map(state.value.columns.map((c: ProTableColumn) => [c.key, c]))
      const filterChips =
        activeFilters.length > 0
          ? h(
              'div',
              {
                'data-iris-filter-chips': '',
                style: 'display:flex;flex-wrap:wrap;gap:0.25rem;padding:0.25rem 0;',
              },
              [
                ...activeFilters.map((k) => {
                  const col = colByKey.get(k) as ProTableColumn | undefined
                  const title = col?.title ?? k
                  return h(
                    'span',
                    {
                      key: k,
                      style:
                        'display:inline-flex;align-items:center;gap:0.25rem;padding:0.125rem 0.5rem;background:var(--iris-chip-bg,var(--iris-surface-alt,#f3f4f6));border-radius:9999px;',
                    },
                    [
                      `${title}: "${state.value.filters[k]}"`,
                      h(
                        'button',
                        {
                          type: 'button',
                          'aria-label': `Clear filter ${title}`,
                          onClick: () => props.store.setFilter(k, ''),
                          style: 'background:none;border:none;cursor:pointer;padding:0;',
                        },
                        '×',
                      ),
                    ],
                  )
                }),
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => props.store.clearFilters(),
                    style: 'background:none;border:none;cursor:pointer;',
                  },
                  'Clear all ×',
                ),
              ],
            )
          : null

      const tableEl = h('table', [
        h('thead', filterRow ? [h('tr', headerCells), filterRow] : [h('tr', headerCells)]),
        h('tbody', bodyRows),
      ])

      return h('div', { 'data-iris-pro-table': '' }, [
        props.virtualized
          ? h(
              'div',
              {
                'data-iris-pro-table-scroll': '',
                style: { overflow: 'auto', height: `${props.maxHeight}px` },
                onScroll: (e: Event) =>
                  virtualizer.setScroll((e.currentTarget as HTMLElement).scrollTop),
              },
              [tableEl],
            )
          : tableEl,
        ...(filterChips ? [filterChips] : []),
        h('div', { 'data-iris-pro-table-footer': '' }, [
          h(
            'button',
            {
              type: 'button',
              disabled: state.value.page <= 1,
              onClick: () => props.store.setPage(state.value.page - 1),
            },
            proTableLabel(props.labels, 'prev'),
          ),
          h(
            'span',
            { 'data-iris-pro-table-page': '' },
            `${state.value.page} / ${props.store.pageCount()}`,
          ),
          h(
            'button',
            {
              type: 'button',
              disabled: state.value.page >= props.store.pageCount(),
              onClick: () => props.store.setPage(state.value.page + 1),
            },
            proTableLabel(props.labels, 'next'),
          ),
        ]),
      ])
    }
  },
})
