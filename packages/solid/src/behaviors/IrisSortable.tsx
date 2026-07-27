import {
  children,
  createSignal,
  createEffect,
  createMemo,
  Index,
  onCleanup,
  splitProps,
  mergeProps,
  type JSX,
} from 'solid-js'
import { createSortable, closestCenter } from '@iris-ui-kit/core'

export const SORTABLE_ITEM_ATTR = 'data-iris-sortable-item'

export interface IrisSortableProps<T = string> {
  /** The ordered items. Used to detect which item is at which position. */
  items: readonly T[]
  /** Called when the user drops an item in a new position. */
  onReorder: (next: T[]) => void
  /** Optional item key getter. Defaults to `String(index)`. */
  getKey?: (item: T, index: number) => string
  /** Children elements, one per item. */
  children?: JSX.Element
  /** CSS class for the container. */
  class?: string
  style?: JSX.CSSProperties
  disabled?: boolean
  orientation?: 'vertical' | 'horizontal'
}

/**
 * IrisSortable (Solid) — Behavior wrapper for drag-to-reorder lists.
 * Uses the framework-agnostic `createSortable` from `@iris-ui-kit/core`.
 */
export function IrisSortable<T>(props: IrisSortableProps<T>): JSX.Element {
  const merged = mergeProps(
    {
      getKey: (_item: T, index: number) => String(index),
      disabled: false,
      orientation: 'vertical' as const,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'items',
    'onReorder',
    'getKey',
    'disabled',
    'children',
    'class',
    'style',
    'orientation',
  ])

  const sortable = createSortable()
  const [activeKey, setActiveKey] = createSignal<string | null>(null)

  let containerRef: HTMLDivElement | undefined

  // Subscribe to sortable state changes to keep activeKey in sync
  createEffect(() => {
    const unsub = sortable.subscribe((state) => {
      setActiveKey(state.activeId)
    })
    onCleanup(unsub)
  })

  // Get the DOM index of a sortable item by its data attribute key
  const indexOf = (key: string): number => {
    if (!containerRef) return -1
    const elements = containerRef.querySelectorAll(`[${SORTABLE_ITEM_ATTR}]`)
    return Array.from(elements).findIndex((el) => el.getAttribute(SORTABLE_ITEM_ATTR) === key)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (local.disabled) return
    const target = (e.target as HTMLElement).closest(`[${SORTABLE_ITEM_ATTR}]`)
    if (!target) return
    const container = containerRef
    if (!container) return
    const key = target.getAttribute(SORTABLE_ITEM_ATTR) ?? ''
    const index = indexOf(key)
    if (index < 0) return
    sortable.press(key, e.clientX, e.clientY)
  }

  const onPointerMove = (e: PointerEvent) => {
    // Promote a pending press to an active drag once the pointer moves past threshold
    if (!sortable.getState().activeId && sortable.isPending()) {
      sortable.tryStart(e.clientX, e.clientY)
    }
    if (!sortable.getState().activeId) return

    // Collect current drop-target rects and find the closest one
    const items = containerRef?.querySelectorAll<HTMLElement>(`[${SORTABLE_ITEM_ATTR}]`)
    const rects = Array.from(items ?? []).map((el) => {
      const rect = el.getBoundingClientRect()
      return {
        id: el.getAttribute(SORTABLE_ITEM_ATTR) ?? '',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }
    })
    const point = { x: e.clientX, y: e.clientY }
    const overId = closestCenter(point, rects)
    sortable.over(overId)
  }

  const onPointerUp = () => {
    const result = sortable.end()
    if (result.activeId && result.overId && result.activeId !== result.overId) {
      const from = indexOf(result.activeId)
      const to = indexOf(result.overId)
      if (from >= 0 && to >= 0) {
        const next = [...local.items]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved!)
        local.onReorder(next)
      }
    }
  }

  // Resolve children once, keep as array for indexed pairing with items
  const resolved = children(() => local.children)
  const childArr = createMemo(() => {
    const c = resolved()
    return Array.isArray(c) ? c : c != null ? [c] : []
  })

  return (
    <div
      ref={containerRef!}
      data-iris-sortable=""
      data-state={activeKey() ? 'dragging' : 'idle'}
      class={local.class}
      style={{
        display: 'flex',
        'flex-direction': local.orientation === 'horizontal' ? 'row' : 'column',
        gap: 'var(--iris-gap-sm, 4px)',
        opacity: local.disabled ? 0.6 : 1,
        'user-select': activeKey() ? 'none' : undefined,
        ...(local.style as Record<string, string | number | undefined>),
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <Index each={local.items as T[]}>
        {(item, index) => {
          const key = local.getKey(item(), index)
          const isDragging = key === activeKey()
          const child = childArr()[index]
          return (
            <div
              data-iris-sortable-item={key}
              data-iris-sortable-dragging={isDragging ? '' : undefined}
              style={{
                transition: isDragging ? 'none' : 'transform 150ms ease',
                opacity: isDragging ? 0.4 : 1,
                position: 'relative',
                'z-index': isDragging ? 100 : undefined,
              }}
            >
              {child}
            </div>
          )
        }}
      </Index>
    </div>
  )
}
