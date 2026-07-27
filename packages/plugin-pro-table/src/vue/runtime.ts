import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { createVirtualizer } from '@iris-ui-kit/core'
import { createProTableColumnReorder, type ProTableStore } from '../core'

interface VueProTableRuntimeProps<Row extends Record<string, unknown>> {
  store: ProTableStore<Row>
  columnReorder: boolean
  columnVirtualized: boolean
  rowHeight: number
  maxHeight: number
}

/** Vue reactivity bridge for the framework-neutral table controllers. */
export function useProTableRuntime<Row extends Record<string, unknown>>(
  props: VueProTableRuntimeProps<Row>,
) {
  const state = shallowRef(props.store.getState())
  const draft = ref('')
  const colScrollRef = ref<HTMLDivElement | null>(null)
  const pointerReorder = createProTableColumnReorder()
  const sortable = pointerReorder.sortable
  const sortableState = shallowRef(sortable.getState())
  const virtualizer = createVirtualizer({
    count: state.value.rows.length,
    estimateSize: props.rowHeight,
    viewportSize: props.maxHeight,
    getItemKey: (index) => String(props.store.rowKeyOf(state.value.rows[index]!)),
  })
  const vState = shallowRef(virtualizer.getState())

  let unsubscribeStore = () => {}
  let unsubscribeSortable = () => {}
  let unsubscribeVirtualizer = () => {}
  let columnObserver: ResizeObserver | null = null

  onMounted(() => {
    unsubscribeStore = props.store.subscribe((next) => {
      state.value = next
      if (!next.editing) return
      const row = next.rows.find((item) => props.store.rowKeyOf(item) === next.editing!.rowKey)
      const column = props.store
        .visibleColumns()
        .find((item) => item.key === next.editing!.columnKey)
      if (row && column) draft.value = String(props.store.cellValue(row, column) ?? '')
    })
    unsubscribeSortable = sortable.subscribe(() => {
      sortableState.value = sortable.getState()
    })
    unsubscribeVirtualizer = virtualizer.subscribe((next) => {
      vState.value = next
    })
    const element = props.columnVirtualized ? colScrollRef.value : null
    if (element) {
      props.store.setColumnViewportWidth(element.clientWidth)
      columnObserver = new ResizeObserver(([entry]) => {
        props.store.setColumnViewportWidth(entry.contentRect.width)
      })
      columnObserver.observe(element)
    }
  })

  onUnmounted(() => {
    unsubscribeStore()
    unsubscribeSortable()
    unsubscribeVirtualizer()
    columnObserver?.disconnect()
  })

  watch(
    () => state.value.rows.length,
    (length) => virtualizer.setCount(length),
  )
  watch(
    () => props.maxHeight,
    (height) => virtualizer.setViewportSize(height),
  )

  const onHeaderPointerDown = (key: string) => (event: PointerEvent) => {
    pointerReorder.pointerDown(props.columnReorder, key, event)
  }
  const onHeaderPointerMove = (key: string) => (event: PointerEvent) => {
    pointerReorder.pointerMove(key, event)
  }
  const onHeaderPointerUp = (key: string) => () => {
    const move = pointerReorder.pointerUp(key)
    if (move) props.store.reorderColumns(move.from, move.to)
  }
  const onHeaderPointerCancel = () => () => pointerReorder.pointerCancel()

  return {
    state,
    draft,
    colScrollRef,
    sortableState,
    virtualizer,
    vState,
    onHeaderPointerDown,
    onHeaderPointerMove,
    onHeaderPointerUp,
    onHeaderPointerCancel,
  }
}
