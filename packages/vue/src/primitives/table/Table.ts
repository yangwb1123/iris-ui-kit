import { computed, defineComponent, h, nextTick, ref, watch, type PropType, type VNode } from 'vue'
import { useI18n } from '../../i18n'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { useDrag } from '../drag/useDrag'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableSortDirection,
  IrisTableSortState,
  IrisTableVirtualOptions,
} from './types'

function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

function defaultSorter(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

const SELECTION_COL_WIDTH = 40
const DEFAULT_COL_WIDTH = 140
const DEFAULT_MIN_WIDTH = 60
const RESIZE_STEP = 16

function resolveInitialWidth(col: IrisTableColumn): number {
  if (typeof col.width === 'number') return col.width
  if (typeof col.width === 'string') {
    const m = col.width.match(/^(\d+(?:\.\d+)?)px$/)
    if (m) return Number(m[1])
  }
  return DEFAULT_COL_WIDTH
}

/**
 * Data-driven table. Renders as a CSS-grid layout under the hood (no native
 * `<table>` element) so it can support virtual scrolling and column resize
 * uniformly. ARIA roles (`role="table" / "row" / "columnheader" / "cell"`)
 * are wired explicitly for screen readers.
 *
 * **Features**:
 *   - Column-driven rendering with optional `#cell.<key>` slots
 *   - Sorting (controlled or uncontrolled, cycles `none → asc → desc → none`)
 *   - Row selection (single / multi) with master checkbox + indeterminate
 *   - **Column resize** (`resizable-columns`) — draggable handle on each
 *     column boundary, `v-model:columnWidths` exposes the map
 *   - **Virtual scrolling** (`:virtual-scroll="{ itemHeight, height }"`) —
 *     renders only the visible row window; viable for 100k+ rows
 *
 * @example
 *   <IrisTable
 *     :columns="cols"
 *     :data="rows"
 *     row-key="id"
 *     selectable="multi"
 *     resizable-columns
 *     :virtual-scroll="{ itemHeight: 36, height: 480 }"
 *   />
 */
export const IrisTable = defineComponent({
  name: 'IrisTable',
  inheritAttrs: false,
  props: {
    columns: {
      type: Array as PropType<IrisTableColumn<Record<string, unknown>>[]>,
      required: true,
    },
    data: {
      type: Array as PropType<Array<Record<string, unknown>>>,
      required: true,
    },
    rowKey: { type: String, default: 'id' },
    selectable: {
      type: String as PropType<'none' | 'single' | 'multi'>,
      default: 'none',
    },
    selection: {
      type: Array as PropType<Array<string | number>>,
      default: undefined,
    },
    sort: {
      type: Object as PropType<IrisTableSortState | null>,
      default: undefined,
    },
    striped: { type: Boolean, default: false },
    bordered: { type: Boolean, default: true },
    /** Enable per-column resize handles. Combine with `v-model:columnWidths` for persistence. */
    resizableColumns: { type: Boolean, default: false },
    /** Controlled column widths in px. */
    columnWidths: {
      type: Object as PropType<IrisTableColumnWidths>,
      default: undefined,
    },
    /** Enable virtual scrolling for the body. */
    virtualScroll: {
      type: Object as PropType<IrisTableVirtualOptions>,
      default: undefined,
    },
    /** Show the loading state instead of rows. */
    loading: { type: Boolean, default: false },
    /** Show the error state instead of rows (takes precedence over loading). */
    error: { type: Boolean, default: false },
  },
  emits: {
    'update:selection': (_value: Array<string | number>) => true,
    'update:sort': (_value: IrisTableSortState | null) => true,
    'update:columnWidths': (_value: IrisTableColumnWidths) => true,
    rowClick: (_row: Record<string, unknown>, _index: number) => true,
    cellEdit: (_payload: IrisTableCellEditEvent<Record<string, unknown>>) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const { t } = useI18n()
    // -------- Sort --------
    const internalSortValue = ref<IrisTableSortState | null>(null)
    const internalSort = computed<IrisTableSortState | null>({
      get: () => (props.sort === undefined ? internalSortValue.value : props.sort),
      set: (value) => {
        if (props.sort === undefined) internalSortValue.value = value
        emit('update:sort', value)
      },
    })

    const sortedRows = computed(() => {
      const state = internalSort.value
      if (!state) return props.data
      const column = props.columns.find((c) => c.key === state.key)
      if (!column) return props.data
      const sorter =
        column.sorter ??
        ((a: Record<string, unknown>, b: Record<string, unknown>) =>
          defaultSorter(getCellValue(a, column), getCellValue(b, column)))
      const arr = [...props.data]
      arr.sort(sorter)
      if (state.direction === 'desc') arr.reverse()
      return arr
    })

    // -------- Selection --------
    const internalSelectionState = ref<Array<string | number>>([])
    const effectiveSelection = computed<Array<string | number>>(
      () => props.selection ?? internalSelectionState.value,
    )
    const setSelection = (next: Array<string | number>) => {
      if (props.selection === undefined) internalSelectionState.value = next
      emit('update:selection', next)
    }

    const rowId = (row: Record<string, unknown>, index: number): string | number => {
      const v = row[props.rowKey]
      if (typeof v === 'string' || typeof v === 'number') return v
      return index
    }

    const isSelected = (id: string | number) => effectiveSelection.value.includes(id)
    const allRowIds = computed(() => sortedRows.value.map((r, i) => rowId(r, i)))
    const allSelected = computed(
      () =>
        allRowIds.value.length > 0 &&
        allRowIds.value.every((id) => effectiveSelection.value.includes(id)),
    )
    const someSelected = computed(
      () =>
        !allSelected.value && allRowIds.value.some((id) => effectiveSelection.value.includes(id)),
    )

    const toggleRow = (id: string | number) => {
      if (props.selectable === 'single') {
        setSelection(isSelected(id) ? [] : [id])
      } else if (props.selectable === 'multi') {
        const current = effectiveSelection.value
        const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
        setSelection(next)
      }
    }
    const toggleAll = () => {
      if (allSelected.value) setSelection([])
      else setSelection([...allRowIds.value])
    }

    // -------- Inline editing --------
    /** Encode a unique cell identity: row id + column key. */
    const editingCellId = ref<string | null>(null)
    const editingDraft = ref<string>('')
    const editorInputRef = ref<HTMLInputElement | null>(null)

    const cellId = (rowIdent: string | number, colKey: string) => `${rowIdent}::${colKey}`

    const beginEdit = (
      row: Record<string, unknown>,
      column: IrisTableColumn,
      rowIdent: string | number,
    ) => {
      if (!column.editable) return
      editingCellId.value = cellId(rowIdent, column.key)
      const current = getCellValue(row, column)
      editingDraft.value = current == null ? '' : String(current)
      void nextTick(() => editorInputRef.value?.focus())
    }

    const commitEdit = (
      row: Record<string, unknown>,
      column: IrisTableColumn,
      rowIndex: number,
    ) => {
      if (editingCellId.value === null) return
      const oldValue = getCellValue(row, column)
      const draft = editingDraft.value
      const newValue =
        column.editor === 'number'
          ? draft === '' || Number.isNaN(Number(draft))
            ? oldValue
            : Number(draft)
          : draft
      editingCellId.value = null
      if (newValue !== oldValue) {
        emit('cellEdit', { row, column, oldValue, newValue, rowIndex })
      }
    }

    const cancelEdit = () => {
      editingCellId.value = null
    }

    // -------- Column widths --------
    const internalWidths = ref<IrisTableColumnWidths>({})
    // Seed internal widths from columns when uncontrolled.
    watch(
      () => props.columns,
      (cols) => {
        const seeded = { ...internalWidths.value }
        for (const col of cols) {
          if (seeded[col.key] === undefined) seeded[col.key] = resolveInitialWidth(col)
        }
        internalWidths.value = seeded
      },
      { immediate: true, deep: false },
    )
    const effectiveWidths = computed<IrisTableColumnWidths>(() => {
      if (props.columnWidths) return props.columnWidths
      return internalWidths.value
    })
    const setColumnWidths = (next: IrisTableColumnWidths) => {
      if (props.columnWidths === undefined) internalWidths.value = next
      emit('update:columnWidths', next)
    }

    const onHeaderClick = (column: IrisTableColumn) => {
      if (!column.sortable) return
      const current = internalSort.value
      let next: IrisTableSortState | null
      if (!current || current.key !== column.key) {
        next = { key: column.key, direction: 'asc' }
      } else if (current.direction === 'asc') {
        next = { key: column.key, direction: 'desc' }
      } else {
        next = null
      }
      internalSort.value = next
    }

    const sortIndicator = (col: IrisTableColumn): VNode | null => {
      if (!col.sortable) return null
      const state = internalSort.value
      const isActive = state?.key === col.key
      const direction: IrisTableSortDirection | null = isActive ? state!.direction : null
      const color = isActive ? 'var(--iris-primary)' : 'var(--iris-muted)'
      return h(
        'span',
        {
          'aria-hidden': 'true',
          style: {
            display: 'inline-flex',
            flexDirection: 'column',
            marginInlineStart: '4px',
            lineHeight: '0.6',
            fontSize: '8px',
            color,
          },
        },
        [
          h('span', { style: { opacity: direction === 'asc' ? '1' : '0.45' } }, '▲'),
          h('span', { style: { opacity: direction === 'desc' ? '1' : '0.45' } }, '▼'),
        ],
      )
    }

    /** Build the grid-template-columns string for the current widths. */
    const gridTemplate = computed(() => {
      const parts: string[] = []
      if (props.selectable !== 'none') parts.push(`${SELECTION_COL_WIDTH}px`)
      for (const col of props.columns) {
        parts.push(`${effectiveWidths.value[col.key] ?? resolveInitialWidth(col)}px`)
      }
      return parts.join(' ')
    })

    // Sticky offsets for pinned columns (mirrors the React adapter): accumulate
    // resolved widths between each pinned column and its edge (+ selection col).
    const pinnedOffsets = computed(() => {
      const map: Record<string, { side: 'left' | 'right'; offset: number }> = {}
      const widthOf = (col: IrisTableColumn) =>
        effectiveWidths.value[col.key] ?? resolveInitialWidth(col)
      let left = props.selectable !== 'none' ? SELECTION_COL_WIDTH : 0
      for (const col of props.columns) {
        if (col.pinned === 'left') {
          map[col.key] = { side: 'left', offset: left }
          left += widthOf(col)
        }
      }
      let right = 0
      for (let i = props.columns.length - 1; i >= 0; i -= 1) {
        const col = props.columns[i]
        if (col?.pinned === 'right') {
          map[col.key] = { side: 'right', offset: right }
          right += widthOf(col)
        }
      }
      return map
    })
    const pinnedStyle = (key: string): Record<string, string> => {
      const p = pinnedOffsets.value[key]
      if (!p) return {}
      return {
        position: 'sticky',
        [p.side]: `${p.offset}px`,
        zIndex: '1',
        background: 'var(--iris-background)',
      }
    }

    // -------- Resize handle (one ref per column for useDrag) --------
    const resizeHandles = new Map<string, ReturnType<typeof ref<HTMLElement | null>>>()
    const getHandleRef = (key: string) => {
      let r = resizeHandles.get(key)
      if (!r) {
        r = ref<HTMLElement | null>(null)
        resizeHandles.set(key, r)
      }
      return r
    }
    // Track which columns have been wired so we don't double-attach useDrag.
    const wiredKeys = new Set<string>()

    /** Wire a useDrag for the given column key. Idempotent per key. */
    const wireResize = (col: IrisTableColumn) => {
      if (!props.resizableColumns) return
      if (wiredKeys.has(col.key)) return
      wiredKeys.add(col.key)
      const handle = getHandleRef(col.key)
      let startWidth = 0
      useDrag({
        handle,
        onStart: () => {
          startWidth = effectiveWidths.value[col.key] ?? resolveInitialWidth(col)
        },
        onDrag: ({ dx }) => {
          const minW = col.minWidth ?? DEFAULT_MIN_WIDTH
          const maxW = col.maxWidth ?? Infinity
          const nextW = Math.max(minW, Math.min(maxW, startWidth + dx))
          setColumnWidths({ ...effectiveWidths.value, [col.key]: nextW })
        },
      })
    }

    return () => {
      const showSelection = props.selectable !== 'none'

      const headerCells: VNode[] = []
      if (showSelection) {
        headerCells.push(
          h(
            'div',
            {
              role: 'columnheader',
              key: '__select__',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                background: 'var(--iris-surface)',
                borderBottom: '1px solid var(--iris-border)',
              },
            },
            props.selectable === 'multi'
              ? [
                  h(IrisCheckbox, {
                    modelValue: allSelected.value
                      ? true
                      : someSelected.value
                        ? 'indeterminate'
                        : false,
                    size: 'sm',
                    'onUpdate:modelValue': toggleAll,
                  }),
                ]
              : '',
          ),
        )
      }
      for (const col of props.columns) {
        const align = col.align ?? 'left'
        wireResize(col)
        const handle = props.resizableColumns
          ? h('span', {
              ref: (el: unknown) => {
                getHandleRef(col.key).value = (el ?? null) as HTMLElement | null
              },
              role: 'separator',
              'aria-orientation': 'vertical',
              'aria-label': `Resize ${col.title}`,
              tabindex: 0,
              'data-iris-table-resize-handle': '',
              'data-column-key': col.key,
              onClick: (e: MouseEvent) => e.stopPropagation(),
              onKeydown: (e: KeyboardEvent) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                e.preventDefault()
                e.stopPropagation()
                const minW = col.minWidth ?? DEFAULT_MIN_WIDTH
                const maxW = col.maxWidth ?? Infinity
                const cur = effectiveWidths.value[col.key] ?? resolveInitialWidth(col)
                const delta = e.key === 'ArrowRight' ? RESIZE_STEP : -RESIZE_STEP
                setColumnWidths({
                  ...effectiveWidths.value,
                  [col.key]: Math.max(minW, Math.min(maxW, cur + delta)),
                })
              },
              style: {
                position: 'absolute',
                right: '0',
                top: '0',
                bottom: '0',
                width: '6px',
                cursor: 'col-resize',
                touchAction: 'none',
                userSelect: 'none',
                zIndex: '1',
              },
            })
          : null

        headerCells.push(
          h(
            'div',
            {
              key: col.key,
              role: 'columnheader',
              'data-iris-table-header': col.key,
              'data-iris-table-pinned': col.pinned,
              onClick: () => onHeaderClick(col),
              style: {
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                padding: '8px var(--iris-padding-md)',
                cursor: col.sortable ? 'pointer' : 'default',
                userSelect: col.sortable ? 'none' : 'auto',
                background: 'var(--iris-surface)',
                borderBottom: '1px solid var(--iris-border)',
                fontWeight: '600',
                fontSize: '13px',
                color: 'var(--iris-foreground)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                ...(col.pinned
                  ? { ...pinnedStyle(col.key), background: 'var(--iris-surface)' }
                  : {}),
              },
              'aria-sort':
                internalSort.value?.key === col.key
                  ? internalSort.value.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : col.sortable
                    ? 'none'
                    : undefined,
            },
            [col.title, sortIndicator(col), handle],
          ),
        )
      }

      const headerRow = h(
        'div',
        {
          role: 'row',
          'data-iris-table-header-row': '',
          style: {
            display: 'grid',
            gridTemplateColumns: gridTemplate.value,
          },
        },
        headerCells,
      )

      const renderRow = (
        row: Record<string, unknown>,
        index: number,
        style?: Record<string, string>,
      ): VNode => {
        const id = rowId(row, index)
        const selected = isSelected(id)
        const cells: VNode[] = []
        if (showSelection) {
          cells.push(
            h(
              'div',
              {
                role: 'cell',
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  borderBottom: '1px solid var(--iris-border)',
                },
              },
              [
                h(IrisCheckbox, {
                  modelValue: selected,
                  size: 'sm',
                  'onUpdate:modelValue': () => toggleRow(id),
                  onClick: (e: MouseEvent) => e.stopPropagation(),
                }),
              ],
            ),
          )
        }
        for (const col of props.columns) {
          const align = col.align ?? 'left'
          const cellSlot = slots[`cell.${col.key}`]
          const isEditing = editingCellId.value === cellId(id, col.key)

          let content: unknown
          if (isEditing) {
            content = h('input', {
              ref: (el: unknown) => {
                editorInputRef.value = (el ?? null) as HTMLInputElement | null
              },
              type: col.editor === 'number' ? 'number' : 'text',
              value: editingDraft.value,
              'data-iris-table-editor': '',
              onInput: (e: Event) => {
                editingDraft.value = (e.target as HTMLInputElement).value
              },
              onKeydown: (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitEdit(row, col, index)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelEdit()
                }
              },
              onBlur: () => commitEdit(row, col, index),
              onClick: (e: MouseEvent) => e.stopPropagation(),
              onDblclick: (e: MouseEvent) => e.stopPropagation(),
              style: {
                width: '100%',
                border: '1px solid var(--iris-primary)',
                borderRadius: 'var(--iris-radius-sm)',
                padding: '4px 6px',
                font: 'inherit',
                background: 'var(--iris-background)',
                color: 'var(--iris-foreground)',
                outline: 'none',
                boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.18)',
              },
            })
          } else {
            content =
              cellSlot?.({ row, index, value: getCellValue(row, col) }) ??
              String(getCellValue(row, col) ?? '')
          }

          cells.push(
            h(
              'div',
              {
                key: col.key,
                role: 'cell',
                'data-iris-table-cell': col.key,
                'data-iris-table-pinned': col.pinned,
                'data-editable': col.editable ? '' : undefined,
                'data-editing': isEditing ? '' : undefined,
                onDblclick: col.editable ? () => beginEdit(row, col, id) : undefined,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                  padding: isEditing ? '4px' : '8px var(--iris-padding-md)',
                  borderBottom: '1px solid var(--iris-border)',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: col.editable ? 'cell' : 'default',
                  ...pinnedStyle(col.key),
                },
              },
              content as VNode | string,
            ),
          )
        }
        return h(
          'div',
          {
            key: String(id),
            role: 'row',
            'data-iris-table-row': '',
            'data-state': selected ? 'selected' : undefined,
            onClick: () => emit('rowClick', row, index),
            style: {
              display: 'grid',
              gridTemplateColumns: gridTemplate.value,
              background: selected
                ? 'var(--iris-surface-hover)'
                : props.striped && index % 2 === 1
                  ? 'var(--iris-surface)'
                  : 'transparent',
              transition: 'background-color 120ms ease',
              cursor: 'default',
              ...style,
            },
          },
          cells,
        )
      }

      // State row style shared by error / loading / empty.
      const stateRowStyle = {
        padding: '32px 12px',
        textAlign: 'center',
        color: 'var(--iris-muted)',
      }

      let bodyNode: VNode
      // Precedence: error → loading → empty → rows.
      if (props.error) {
        bodyNode = h(
          'div',
          { role: 'row', 'data-iris-table-row': 'error', style: stateRowStyle },
          slots.error ? slots.error() : t('table.error'),
        )
      } else if (props.loading) {
        bodyNode = h(
          'div',
          {
            role: 'row',
            'aria-busy': 'true',
            'data-iris-table-row': 'loading',
            style: stateRowStyle,
          },
          slots.loading ? slots.loading() : t('table.loading'),
        )
      } else if (sortedRows.value.length === 0) {
        bodyNode = h(
          'div',
          { role: 'row', 'data-iris-table-row': 'empty', style: stateRowStyle },
          slots.empty ? slots.empty() : t('table.empty'),
        )
      } else if (props.virtualScroll) {
        bodyNode = h(
          IrisVirtualScroll,
          {
            items: sortedRows.value,
            itemHeight: props.virtualScroll.itemHeight,
            height: props.virtualScroll.height,
            buffer: props.virtualScroll.buffer,
            'data-iris-table-body': '',
            style: { width: '100%' },
          },
          {
            item: ({ item, index }: { item: Record<string, unknown>; index: number }) =>
              renderRow(item, index),
          },
        )
      } else {
        bodyNode = h(
          'div',
          {
            role: 'rowgroup',
            'data-iris-table-body': '',
          },
          sortedRows.value.map((row, i) => renderRow(row, i)),
        )
      }

      return h(
        'div',
        {
          ...attrs,
          role: 'table',
          'data-iris-table': '',
          'data-virtual': props.virtualScroll ? '' : undefined,
          style: {
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            border: props.bordered ? '1px solid var(--iris-border)' : 'none',
            borderRadius: 'var(--iris-radius-md)',
            overflow: 'hidden',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [headerRow, bodyNode],
      )
    }
  },
})
