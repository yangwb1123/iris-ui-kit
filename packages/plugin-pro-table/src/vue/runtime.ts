import { onMounted, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import {
  createVirtualizer,
  type SortableController,
  type SortableState,
  type Virtualizer,
  type VirtualizerState,
} from '@iris-ui-kit/core'
import { createProTableColumnReorder, type ProTableStore } from '../core'
import type { ProTableState } from '../core/types'

interface VueProTableRuntimeProps<Row extends Record<string, unknown>> {
  store: ProTableStore<Row>
  columnReorder: boolean
  columnVirtualized: boolean
  rowHeight: number
  maxHeight: number
}

interface ProTableRuntimeRefs<Row extends Record<string, unknown>> {
  state: Ref<ProTableState<Row>>
  draft: Ref<string>
  sortableState: Ref<SortableState>
  vState: Ref<VirtualizerState>
}

function updateEditingDraft<Row extends Record<string, unknown>>(
  props: VueProTableRuntimeProps<Row>,
  state: ProTableState<Row>,
  draft: Ref<string>,
): void {
  if (!state.editing) return
  const row = state.rows.find((item) => props.store.rowKeyOf(item) === state.editing!.rowKey)
  const column = props.store.visibleColumns().find((item) => item.key === state.editing!.columnKey)
  if (row && column) draft.value = String(props.store.cellValue(row, column) ?? '')
}

function installProTableLifecycle<Row extends Record<string, unknown>>(
  props: VueProTableRuntimeProps<Row>,
  refs: ProTableRuntimeRefs<Row>,
  sortable: SortableController,
  virtualizer: Virtualizer,
  colScrollRef: Ref<HTMLDivElement | null>,
): void {
  let unsubscribeStore = () => {}
  let unsubscribeSortable = () => {}
  let unsubscribeVirtualizer = () => {}
  let columnObserver: ResizeObserver | null = null

  onMounted(() => {
    unsubscribeStore = props.store.subscribe((next) => {
      refs.state.value = next
      updateEditingDraft(props, next, refs.draft)
    })
    unsubscribeSortable = sortable.subscribe((next) => {
      refs.sortableState.value = next
    })
    unsubscribeVirtualizer = virtualizer.subscribe((next) => {
      refs.vState.value = next
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
}

function createProTablePointerHandlers<Row extends Record<string, unknown>>(
  props: VueProTableRuntimeProps<Row>,
  pointerReorder: ReturnType<typeof createProTableColumnReorder>,
) {
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
  return { onHeaderPointerDown, onHeaderPointerMove, onHeaderPointerUp, onHeaderPointerCancel }
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
  installProTableLifecycle(
    props,
    { state, draft, sortableState, vState },
    sortable,
    virtualizer,
    colScrollRef,
  )

  watch(
    () => state.value.rows.length,
    (length) => virtualizer.setCount(length),
  )
  watch(
    () => props.maxHeight,
    (height) => virtualizer.setViewportSize(height),
  )

  const { onHeaderPointerDown, onHeaderPointerMove, onHeaderPointerUp, onHeaderPointerCancel } =
    createProTablePointerHandlers(props, pointerReorder)

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
