import { computed, h, ref, type Ref, type VNode } from 'vue'
import {
  computePinnedCountPlan,
  firstRightPinnedIndex as getFirstRightPinnedIndex,
  pinnedBoundaryIndex,
  pinnedCountFromDelta,
} from '@iris-ui-kit/core'
import { useDrag } from '../drag/useDrag'
import type { IrisTableColumn } from './types'

export function createTablePinnedDrag(options: {
  enabled: () => boolean
  columns: () => IrisTableColumn<Record<string, unknown>>[]
  widthOf: (column: IrisTableColumn) => number
  pinOf: (column: IrisTableColumn) => 'left' | 'right' | null
  setPinned: (key: string, pinned: 'left' | null) => void
  onPinnedCountChange?: (count: number) => void
}): (column: IrisTableColumn) => VNode | null {
  const firstRightPinnedIndex = computed(() =>
    getFirstRightPinnedIndex(options.columns(), options.pinOf),
  )
  const pinnedBoundaryColumn = computed(() => {
    if (!options.enabled()) return null
    const index = pinnedBoundaryIndex(options.columns(), options.pinOf, firstRightPinnedIndex.value)
    return index >= 0 ? options.columns()[index]! : null
  })
  const handleRefs = new Map<string, Ref<HTMLElement | null>>()
  const wiredKeys = new Set<string>()
  const activeKey = ref<string | null>(null)
  const dragDx = ref(0)
  const getHandleRef = (key: string): Ref<HTMLElement | null> => {
    let handle = handleRefs.get(key)
    if (!handle) {
      handle = ref<HTMLElement | null>(null)
      handleRefs.set(key, handle)
    }
    return handle
  }
  const resolvePinnedCount = (dx: number): number =>
    pinnedCountFromDelta(
      options.columns(),
      options.widthOf,
      dx,
      firstRightPinnedIndex.value,
      options.pinOf,
    )
  const commitPinnedCount = (count: number): void => {
    if (!options.enabled()) return
    const plan = computePinnedCountPlan(
      options.columns(),
      options.pinOf,
      count,
      firstRightPinnedIndex.value,
    )
    if (plan.count === plan.current) return
    for (const update of plan.updates) {
      options.setPinned(update.column.key, update.pinned)
    }
    options.onPinnedCountChange?.(plan.count)
  }
  const wire = (key: string): void => {
    if (wiredKeys.has(key)) return
    wiredKeys.add(key)
    const handle = getHandleRef(key)
    useDrag({
      handle,
      disabled: computed(() => !options.enabled()),
      onStart: () => {
        activeKey.value = key
        dragDx.value = 0
      },
      onDrag: ({ dx }) => {
        activeKey.value = key
        dragDx.value = dx
      },
      onEnd: ({ dx }) => {
        commitPinnedCount(resolvePinnedCount(dx))
        activeKey.value = null
        dragDx.value = 0
      },
    })
  }
  // Register the initial leaf set while Table.ts is still in setup scope. The
  // returned renderer may run outside an active Vue effect scope, while
  // `useDrag` needs that scope for lifecycle cleanup.
  for (const column of options.columns()) wire(column.key)
  return (column: IrisTableColumn): VNode | null => {
    const boundary = pinnedBoundaryColumn.value
    if (!options.enabled() || !boundary || boundary.key !== column.key) return null
    const handle = getHandleRef(column.key)
    return h(
      'span',
      {
        ref: (element: unknown) => {
          handle.value = (element ?? null) as HTMLElement | null
        },
        role: 'separator',
        'aria-orientation': 'vertical',
        'aria-label': `Adjust pinned column count at ${column.title}`,
        tabindex: 0,
        'data-iris-pinned-drag-handle': '',
        'data-column-key': column.key,
        'data-iris-pinned-drag-active':
          activeKey.value === column.key && dragDx.value !== 0 ? 'true' : undefined,
        onPointerdown: (event: PointerEvent) => event.stopPropagation(),
        onKeydown: (event: KeyboardEvent) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          event.stopPropagation()
          commitPinnedCount(resolvePinnedCount(0) + (event.key === 'ArrowRight' ? 1 : -1))
        },
        style: {
          position: 'absolute',
          top: '0',
          right: '0',
          bottom: '0',
          width: '8px',
          cursor: 'col-resize',
          touchAction: 'none',
          userSelect: 'none',
          zIndex: '2',
          transform:
            activeKey.value === column.key && dragDx.value !== 0
              ? `translateX(${dragDx.value}px)`
              : undefined,
        },
      },
      h('span', {
        'aria-hidden': 'true',
        'data-iris-pinned-drag-line': '',
        style: {
          position: 'absolute',
          top: '0',
          bottom: '0',
          insetInlineStart: '50%',
          width: '2px',
          background: 'var(--iris-primary)',
          transform: 'translateX(-50%)',
        },
      }),
    )
  }
}
