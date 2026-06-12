import {
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  type PropType,
  type VNode,
} from 'vue'
import {
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
  },
  setup(props) {
    const state = shallowRef(props.store.getState())
    const draft = ref('')
    // Drag-to-reorder: mutable ref — no reactivity needed (no re-render on drag).
    let dragKey: string | null = null
    let unsub = () => {}

    onMounted(() => {
      unsub = props.store.subscribe((s) => {
        state.value = s
        if (s.editing) {
          const row = s.rows.find((r) => props.store.rowKeyOf(r) === s.editing!.rowKey)
          const col = props.store.visibleColumns().find((c) => c.key === s.editing!.columnKey)
          if (row && col) draft.value = String(props.store.cellValue(row, col) ?? '')
        }
      })
    })
    onUnmounted(() => unsub())

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
              'aria-sort': ariaSort(c),
              tabindex: c.sortable ? 0 : undefined,
              style: {
                textAlign: c.align,
                width: c.width,
                cursor: props.columnReorder ? 'grab' : undefined,
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

      const bodyRows = state.value.rows.map((row) => {
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
      })

      return h('div', { 'data-iris-pro-table': '' }, [
        h('table', [
          h('thead', filterRow ? [h('tr', headerCells), filterRow] : [h('tr', headerCells)]),
          h('tbody', bodyRows),
        ]),
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
