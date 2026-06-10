import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import {
  aggregate,
  compareValues,
  computeVirtualRange,
  createExpansion,
  createSelectionModel,
} from '@iris-ui/core'
import { useI18n } from '../../i18n'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { useDrag } from '../drag/useDrag'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableRenderDetail,
  IrisTableRowExpandable,
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

const SELECTION_COL_WIDTH = 40
const EXPAND_COL_WIDTH = 40
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
    /** Render only the horizontally-visible columns (+ pinned + overscan) for wide tables. */
    columnVirtualization: { type: Boolean, default: false },
    /**
     * Render an expandable detail panel beneath a row. Providing this adds a
     * leading expand-toggle column; clicking it reveals a full-width detail row.
     * (Not applied in the virtual-scroll path.)
     */
    renderDetail: {
      type: Function as PropType<IrisTableRenderDetail<Record<string, unknown>>>,
      default: undefined,
    },
    /** Which rows can expand a detail panel. Defaults to all rows when `renderDetail` is set. */
    rowExpandable: {
      type: Function as PropType<IrisTableRowExpandable<Record<string, unknown>>>,
      default: undefined,
    },
    /** Initially-expanded row keys (uncontrolled). */
    defaultExpandedRowKeys: {
      type: Array as PropType<Array<string | number>>,
      default: undefined,
    },
  },
  emits: {
    'update:selection': (_value: Array<string | number>) => true,
    'update:sort': (_value: IrisTableSortState | null) => true,
    'update:columnWidths': (_value: IrisTableColumnWidths) => true,
    rowClick: (_row: Record<string, unknown>, _index: number) => true,
    cellEdit: (_payload: IrisTableCellEditEvent<Record<string, unknown>>) => true,
    expandedRowsChange: (_keys: Array<string | number>) => true,
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
          compareValues(getCellValue(a, column), getCellValue(b, column)))
      const arr = [...props.data]
      arr.sort(sorter)
      if (state.direction === 'desc') arr.reverse()
      return arr
    })

    // -------- Selection (single-sourced via core createSelectionModel) --------
    // The model owns the selected-key set plus the toggle / dedup / select-all
    // logic; the table keeps only its controlled-or-uncontrolled value shape
    // (`Array<string | number>`) and the row-id mapping. It runs in the default
    // `multiple` mode so `selectable` stays runtime-reactive — single-select is a
    // replace (`set`) and multi-select a `toggle`, matching the previous behavior.
    const selectionModel = createSelectionModel<string | number>({
      defaultSelected: props.selection ?? [],
      onChange: (keys) => emit('update:selection', keys),
    })
    const selectedKeys = shallowRef<Array<string | number>>(selectionModel.get())
    onBeforeUnmount(
      selectionModel.store.subscribe((keys) => {
        selectedKeys.value = keys
      }),
    )
    // Controlled: mirror the prop into the model without re-emitting onChange.
    watch(
      () => props.selection,
      (sel) => {
        if (sel !== undefined) selectionModel.sync(sel)
      },
    )

    // -------- Expandable detail rows (single-sourced via core createExpansion) --------
    // A leading toggle column + a full-width detail panel beneath an expanded
    // row, driven by the framework-agnostic expansion model (multiple-open). The
    // keys are the row keys as strings (matching React). Mirrors the selection
    // pattern: shallowRef + subscribe so toggling re-renders.
    const hasDetail = computed(() => props.renderDetail !== undefined)
    const expansion = createExpansion({
      mode: 'multiple',
      defaultExpanded: (props.defaultExpandedRowKeys ?? []).map(String),
      onChange: (keys) => emit('expandedRowsChange', keys),
    })
    const expandedKeys = shallowRef<string[]>(expansion.get())
    onBeforeUnmount(
      expansion.store.subscribe((keys) => {
        expandedKeys.value = keys
      }),
    )
    const isRowExpandable = (row: Record<string, unknown>, idx: number): boolean =>
      hasDetail.value && (props.rowExpandable ? props.rowExpandable(row, idx) : true)

    const rowId = (row: Record<string, unknown>, index: number): string | number => {
      const v = row[props.rowKey]
      if (typeof v === 'string' || typeof v === 'number') return v
      return index
    }

    const isSelected = (id: string | number) => selectedKeys.value.includes(id)
    const allRowIds = computed(() => sortedRows.value.map((r, i) => rowId(r, i)))
    const allSelected = computed(() => {
      const sel = selectedKeys.value
      return allRowIds.value.length > 0 && allRowIds.value.every((id) => sel.includes(id))
    })
    const someSelected = computed(() => {
      const sel = selectedKeys.value
      return !allSelected.value && allRowIds.value.some((id) => sel.includes(id))
    })

    const toggleRow = (id: string | number) => {
      if (props.selectable === 'single') {
        selectionModel.set(selectionModel.isSelected(id) ? [] : [id])
      } else if (props.selectable === 'multi') {
        selectionModel.toggle(id)
      }
    }
    const toggleAll = () => {
      selectionModel.set(allSelected.value ? [] : [...allRowIds.value])
    }

    // -------- Inline editing --------
    /** Encode a unique cell identity: row id + column key. */
    const editingCellId = ref<string | null>(null)
    const editingDraft = ref<string>('')
    const editError = ref<string | null>(null)
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
      editError.value = null
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
      // A column validator can reject the draft: keep the editor open, surface the
      // message, and skip the commit until the value is valid (or the user cancels).
      if (column.validate) {
        const error = column.validate(newValue, row)
        if (error) {
          editError.value = error
          return
        }
      }
      editError.value = null
      editingCellId.value = null
      if (newValue !== oldValue) {
        emit('cellEdit', { row, column, oldValue, newValue, rowIndex })
      }
    }

    const cancelEdit = () => {
      editError.value = null
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
      if (hasDetail.value) parts.push(`${EXPAND_COL_WIDTH}px`)
      if (props.selectable !== 'none') parts.push(`${SELECTION_COL_WIDTH}px`)
      for (const col of props.columns) {
        parts.push(`${effectiveWidths.value[col.key] ?? resolveInitialWidth(col)}px`)
      }
      return parts.join(' ')
    })

    // -------- Column virtualization (opt-in) --------
    const rootRef = ref<HTMLElement | null>(null)
    const scrollLeft = ref(0)
    const viewportWidth = ref(0)
    const colTrack = (i: number): number =>
      (hasDetail.value ? 1 : 0) + (props.selectable !== 'none' ? 2 : 1) + i

    if (typeof ResizeObserver !== 'undefined') {
      let ro: ResizeObserver | null = null
      onMounted(() => {
        if (!props.columnVirtualization || !rootRef.value) return
        const measure = () => {
          if (rootRef.value) viewportWidth.value = rootRef.value.clientWidth
        }
        measure()
        ro = new ResizeObserver(measure)
        ro.observe(rootRef.value)
      })
      onBeforeUnmount(() => {
        ro?.disconnect()
        ro = null
      })
    }

    // Column indices to render: visible window + overscan ∪ pinned. `null` ⇒ all.
    const visibleColSet = computed<Set<number> | null>(() => {
      if (!props.columnVirtualization) return null
      const w = computeVirtualRange({
        itemCount: props.columns.length,
        scrollTop: scrollLeft.value,
        viewportSize: viewportWidth.value,
        itemSize: (i) =>
          effectiveWidths.value[props.columns[i].key] ?? resolveInitialWidth(props.columns[i]),
        buffer: 2,
      })
      const set = new Set<number>()
      for (let i = w.startIndex; i <= w.endIndex; i += 1) set.add(i)
      props.columns.forEach((col, i) => {
        if (col.pinned) set.add(i)
      })
      return set
    })

    // Sticky offsets for pinned columns (mirrors the React adapter): accumulate
    // resolved widths between each pinned column and its edge (+ selection col).
    const pinnedOffsets = computed(() => {
      const map: Record<string, { side: 'left' | 'right'; offset: number }> = {}
      const widthOf = (col: IrisTableColumn) =>
        effectiveWidths.value[col.key] ?? resolveInitialWidth(col)
      let left =
        (hasDetail.value ? EXPAND_COL_WIDTH : 0) +
        (props.selectable !== 'none' ? SELECTION_COL_WIDTH : 0)
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
      const showDetail = hasDetail.value

      const headerCells: VNode[] = []
      if (showDetail) {
        headerCells.push(
          h('div', {
            role: 'columnheader',
            key: '__expand__',
            'data-iris-table-header': '__expand',
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              background: 'var(--iris-surface)',
              borderBottom: '1px solid var(--iris-border)',
            },
          }),
        )
      }
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
                    ariaLabel: t('table.selectAll'),
                    'onUpdate:modelValue': toggleAll,
                  }),
                ]
              : '',
          ),
        )
      }
      for (let ci = 0; ci < props.columns.length; ci += 1) {
        const col = props.columns[ci]
        if (visibleColSet.value && !visibleColSet.value.has(ci)) continue
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
                ...(visibleColSet.value ? { gridColumnStart: String(colTrack(ci)) } : {}),
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
        if (showDetail) {
          const rowExpandable = isRowExpandable(row, index)
          const isExpanded = expandedKeys.value.includes(String(id))
          cells.push(
            h(
              'div',
              {
                key: '__expand',
                role: 'cell',
                'data-iris-table-cell': '__expand',
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  borderBottom: '1px solid var(--iris-border)',
                },
              },
              rowExpandable
                ? [
                    h(
                      'button',
                      {
                        type: 'button',
                        'data-iris-table-expand-toggle': '',
                        'aria-expanded': isExpanded ? 'true' : 'false',
                        'aria-label': t(isExpanded ? 'treeSelect.collapse' : 'treeSelect.expand'),
                        onClick: (e: MouseEvent) => {
                          e.stopPropagation()
                          expansion.toggle(String(id))
                        },
                        style: {
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: '0',
                          font: 'inherit',
                          color: 'var(--iris-foreground)',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 150ms',
                        },
                      },
                      '▶',
                    ),
                  ]
                : '',
            ),
          )
        }
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
                  ariaLabel: t('table.selectRow', { key: id }),
                  'onUpdate:modelValue': () => toggleRow(id),
                  onClick: (e: MouseEvent) => e.stopPropagation(),
                }),
              ],
            ),
          )
        }
        for (let ci = 0; ci < props.columns.length; ci += 1) {
          const col = props.columns[ci]
          if (visibleColSet.value && !visibleColSet.value.has(ci)) continue
          const align = col.align ?? 'left'
          const cellSlot = slots[`cell.${col.key}`]
          const isEditing = editingCellId.value === cellId(id, col.key)

          let content: unknown
          if (isEditing) {
            const editCellId = cellId(id, col.key)
            const error = editError.value
            const input = h('input', {
              ref: (el: unknown) => {
                editorInputRef.value = (el ?? null) as HTMLInputElement | null
              },
              type: col.editor === 'number' ? 'number' : 'text',
              value: editingDraft.value,
              'data-iris-table-editor': '',
              'aria-invalid': error ? 'true' : undefined,
              'aria-describedby': error ? `${editCellId}-error` : undefined,
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
                border: `1px solid ${error ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
                borderRadius: 'var(--iris-radius-sm)',
                padding: '4px 6px',
                font: 'inherit',
                background: 'var(--iris-background)',
                color: 'var(--iris-foreground)',
                outline: 'none',
                boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.18)',
              },
            })
            content = error
              ? [
                  input,
                  h(
                    'div',
                    {
                      id: `${editCellId}-error`,
                      role: 'alert',
                      'data-iris-table-editor-error': '',
                      style: {
                        marginTop: '2px',
                        fontSize: '12px',
                        color: 'var(--iris-danger)',
                      },
                    },
                    error,
                  ),
                ]
              : input
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
                  ...(visibleColSet.value ? { gridColumnStart: String(colTrack(ci)) } : {}),
                  ...pinnedStyle(col.key),
                },
              },
              content as VNode | VNode[] | string,
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
        const bodyChildren: VNode[] = []
        sortedRows.value.forEach((row, i) => {
          bodyChildren.push(renderRow(row, i))
          // Full-width detail panel beneath an expanded, expandable row (spans
          // all grid tracks). Only in the non-virtualized path.
          if (showDetail && isRowExpandable(row, i)) {
            const id = rowId(row, i)
            if (expandedKeys.value.includes(String(id))) {
              bodyChildren.push(
                h(
                  'div',
                  {
                    key: `${String(id)}::detail`,
                    role: 'row',
                    'data-iris-table-row-detail': String(id),
                    style: {
                      display: 'grid',
                      gridTemplateColumns: gridTemplate.value,
                    },
                  },
                  [
                    h(
                      'div',
                      {
                        role: 'cell',
                        'data-iris-table-detail-cell': '',
                        style: {
                          gridColumn: '1 / -1',
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--iris-border)',
                        },
                      },
                      [props.renderDetail!(row, i)],
                    ),
                  ],
                ),
              )
            }
          }
        })
        bodyNode = h(
          'div',
          {
            role: 'rowgroup',
            'data-iris-table-body': '',
          },
          bodyChildren,
        )
      }

      // -------- Summary / footer row --------
      // Each column with a `summary` op aggregates over the FULL sorted dataset
      // (the same array the body maps), via the core `aggregate` material. The
      // footer appears only when there is data and at least one column opts in.
      let summaryRow: VNode | null = null
      if (
        !props.error &&
        !props.loading &&
        sortedRows.value.length > 0 &&
        props.columns.some((c) => c.summary)
      ) {
        const summaryCells: VNode[] = []
        if (showSelection) {
          summaryCells.push(
            h('div', {
              key: '__selection',
              role: 'cell',
              'data-iris-table-cell': '__selection',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
              },
            }),
          )
        }
        for (let ci = 0; ci < props.columns.length; ci += 1) {
          const col = props.columns[ci]
          if (visibleColSet.value && !visibleColSet.value.has(ci)) continue
          const align = col.align ?? 'left'
          const op = col.summary
          const value = op ? aggregate(sortedRows.value, (r) => getCellValue(r, col), op) : null
          // Columns without a summary op render an empty cell.
          const summaryContent: VNode | VNode[] | string =
            op != null && value != null
              ? col.renderSummary
                ? (col.renderSummary(value, sortedRows.value) as VNode | VNode[] | string)
                : String(value)
              : ''
          summaryCells.push(
            h(
              'div',
              {
                key: col.key,
                role: 'cell',
                'data-iris-table-cell': col.key,
                'data-iris-table-summary-cell': op ? '' : undefined,
                'data-iris-table-pinned': col.pinned,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                  padding: '8px var(--iris-padding-md)',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  ...(visibleColSet.value ? { gridColumnStart: String(colTrack(ci)) } : {}),
                  ...pinnedStyle(col.key),
                },
              },
              summaryContent,
            ),
          )
        }
        summaryRow = h(
          'div',
          {
            role: 'row',
            'data-iris-table-row': 'summary',
            style: {
              display: 'grid',
              gridTemplateColumns: gridTemplate.value,
              fontWeight: '600',
              borderTop: '2px solid var(--iris-border)',
              background: 'var(--iris-surface)',
            },
          },
          summaryCells,
        )
      }

      return h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            rootRef.value = (el ?? null) as HTMLElement | null
          },
          role: 'table',
          'data-iris-table': '',
          'data-virtual': props.virtualScroll ? '' : undefined,
          'data-column-virtualized': props.columnVirtualization ? 'true' : undefined,
          onScroll: props.columnVirtualization
            ? (e: Event) => {
                scrollLeft.value = (e.currentTarget as HTMLElement).scrollLeft
              }
            : undefined,
          style: {
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            border: props.bordered ? '1px solid var(--iris-border)' : 'none',
            borderRadius: 'var(--iris-radius-md)',
            // Column virtualization turns the table into a horizontal scroll container.
            overflow: props.columnVirtualization ? 'auto' : 'hidden',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [headerRow, bodyNode, summaryRow],
      )
    }
  },
})
