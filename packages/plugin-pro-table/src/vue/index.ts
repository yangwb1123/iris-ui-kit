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
import {
  createSortable,
  createVirtualizer,
  type SortableRect,
  type HeaderCell,
} from '@iris-ui/core'
import {
  collectRects,
  proTableLabel,
  type ProTableColumn,
  type ProTableStore,
  type ProTableLabels,
} from '../core'

export type { ProTableColumn, ProTableStore, ProTableLabels } from '../core'

function pinnedStyle(column: ProTableColumn): Record<string, string> | undefined {
  if (!column.pinned) return undefined
  return { position: 'sticky', [column.pinned]: '0', zIndex: '1' }
}

export const IrisProTable = defineComponent({
  name: 'IrisProTable',
  props: {
    store: { type: Object as PropType<ProTableStore>, required: true },
    labels: { type: Object as PropType<ProTableLabels>, default: undefined },
    columnReorder: { type: Boolean, default: false },
    virtualized: { type: Boolean, default: false },
    rowHeight: { type: Number, default: 40 },
    maxHeight: { type: Number, default: 400 },
  },
  setup(props) {
    const state = shallowRef(props.store.getState())
    const draft = ref('')
    let dragKey: string | null = null
    let unsub = () => {}

    const sortable = createSortable()
    const sortableState = shallowRef(sortable.getState())
    let unsubSortable = () => {}
    let dragRects: SortableRect[] = []

    const virtualizer = createVirtualizer({
      count: state.value.rows.length,
      estimateSize: props.rowHeight,
      viewportSize: props.maxHeight,
      getItemKey: (i) => String(props.store.rowKeyOf(state.value.rows[i]!)),
    })
    const vState = shallowRef(virtualizer.getState())
    let unsubVirtual = () => {}

    const onHeaderPointerDown = (key: string) => (e: PointerEvent) => {
      if (!props.columnReorder || e.pointerType === 'mouse') return
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      } catch {
        /* ignore */
      }
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
        sortable.cancel()
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
      const matrix = props.store.headerMatrix()

      const headerRows: VNode[] = matrix.map((row, ri) =>
        h('tr', { key: ri }, [
          ...(ri === 0
            ? [
                h('th', { scope: 'col', rowSpan: matrix.length }, [
                  h('input', {
                    type: 'checkbox',
                    'aria-label': proTableLabel(props.labels, 'selectAll'),
                    checked: props.store.isAllSelected(),
                    onChange: () => props.store.toggleAll(),
                  }),
                ]),
              ]
            : []),
          ...row.map((cell: HeaderCell<ProTableColumn>) => {
            const c = cell.column
            const isLeaf =
              !(c as ProTableColumn).children ||
              ((c as ProTableColumn).children as any[]).length === 0
            const colWidth = state.value.columnSizes[c.key] ?? c.width
            return h(
              'th',
              isLeaf
                ? {
                    key: c.key,
                    scope: 'col',
                    'data-iris-col-key': c.key,
                    'aria-sort': ariaSort(c),
                    tabindex: c.sortable ? 0 : undefined,
                    style: {
                      textAlign: c.align,
                      width: colWidth,
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
                  }
                : {
                    key: c.key,
                    scope: 'colgroup',
                    colSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
                    rowSpan: cell.rowSpan > 0 ? cell.rowSpan : undefined,
                    style: { textAlign: 'center' },
                  },
              isLeaf
                ? [
                    c.title,
                    h('span', { 'aria-hidden': 'true' }, sortIndicator(c.key)),
                    ...((c.resizable ?? typeof c.width === 'number')
                      ? [
                          h('span', {
                            'data-iris-col-resize-handle': '',
                            style: {
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              bottom: 0,
                              width: '4px',
                              cursor: 'col-resize',
                              zIndex: 2,
                            },
                            onPointerdown: (e: PointerEvent) => {
                              e.stopPropagation()
                              e.preventDefault()
                              const startX = e.clientX
                              const startW = colWidth as number
                              const onMove = (ev: PointerEvent) => {
                                ev.preventDefault()
                                props.store.setColumnWidth(c.key, startW + ev.clientX - startX)
                              }
                              const onUp = () => {
                                document.removeEventListener('pointermove', onMove)
                                document.removeEventListener('pointerup', onUp)
                              }
                              document.addEventListener('pointermove', onMove)
                              document.addEventListener('pointerup', onUp)
                            },
                          }),
                        ]
                      : []),
                  ]
                : [c.title],
            )
          }),
        ]),
      )

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

      const totalColumnCount = columns.length + 1

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
        h('thead', [...headerRows, filterRow ? filterRow : null]),
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
