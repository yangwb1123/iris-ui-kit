import { computed, h, ref, type Ref, type VNode } from 'vue'
import { pinnedCountFromBudget } from '@iris-ui-kit/core'
import { useDrag } from '../drag/useDrag'
import type { IrisTableColumn } from './types'

function leftPinnedCount(
  columns: readonly IrisTableColumn[],
  pinOf: (column: IrisTableColumn) => 'left' | 'right' | null,
  cap: number,
): number {
  let count = 0
  for (let index = 0; index < cap; index += 1) {
    if (pinOf(columns[index]!) === 'left') count = index + 1
    else break
  }
  return count
}

export function createTablePinnedDrag(options: {
  enabled: () => boolean
  columns: () => IrisTableColumn<Record<string, unknown>>[]
  widthOf: (column: IrisTableColumn) => number
  pinOf: (column: IrisTableColumn) => 'left' | 'right' | null
  setPinned: (key: string, pinned: 'left' | null) => void
  onPinnedCountChange?: (count: number) => void
}): (column: IrisTableColumn) => VNode | null {
  const firstRightPinnedIndex = computed(() => {
    const index = options.columns().findIndex((column) => options.pinOf(column) === 'right')
    return index < 0 ? options.columns().length : index
  })
  const pinnedBoundaryColumn = computed(() => {
    if (!options.enabled()) return null
    for (let index = firstRightPinnedIndex.value - 1; index >= 0; index -= 1) {
      const column = options.columns()[index]
      if (column && options.pinOf(column) === 'left') return column
    }
    return null
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
  const resolvePinnedCount = (dx: number): number => {
    const columns = options.columns()
    const cap = firstRightPinnedIndex.value
    const current = leftPinnedCount(columns, options.pinOf, cap)
    let currentWidth = 0
    for (let index = 0; index < current; index += 1) {
      const column = columns[index]
      if (column) currentWidth += options.widthOf(column)
    }
    return pinnedCountFromBudget(
      columns,
      (column) => options.widthOf(column),
      currentWidth + dx,
      cap,
    )
  }
  const commitPinnedCount = (count: number): void => {
    if (!options.enabled()) return
    const columns = options.columns()
    const cap = firstRightPinnedIndex.value
    const clamped = Math.max(0, Math.min(cap, count))
    const current = leftPinnedCount(columns, options.pinOf, cap)
    if (clamped === current) return
    for (let index = 0; index < cap; index += 1) {
      const column = columns[index]
      if (!column) continue
      const target: 'left' | null = index < clamped ? 'left' : null
      if (options.pinOf(column) === target) continue
      options.setPinned(column.key, target)
    }
    options.onPinnedCountChange?.(clamped)
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
