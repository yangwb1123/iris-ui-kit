/**
 * Behavior wrapper: makes a list of items sortable via drag-and-drop.
 * Uses `createSortable` from `@iris-ui-kit/core` for the drag-and-drop controller.
 *
 * @example
 *   const [items, setItems] = React.useState(['A', 'B', 'C'])
 *   <IrisSortable items={items} onReorder={setItems}>
 *     {items.map((label) => <div key={label}>{label}</div>)}
 *   </IrisSortable>
 */
import * as React from 'react'
import { createSortable, type SortableState } from '@iris-ui-kit/core'

export interface IrisSortableProps<T = string> {
  items: readonly T[]
  onReorder: (next: T[]) => void
  getKey?: (item: T, index: number) => string
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
}

export const SORTABLE_ITEM_ATTR = 'data-iris-sortable-item'

export function IrisSortable<T>({
  items,
  onReorder,
  getKey = (_item, index) => String(index),
  disabled = false,
  style,
  className,
  children,
  ...rest
}: IrisSortableProps<T> &
  Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const ctrlRef = React.useRef<ReturnType<typeof createSortable> | null>(null)
  if (ctrlRef.current === null) ctrlRef.current = createSortable()
  const ctrl = ctrlRef.current

  const [state, setState] = React.useState<SortableState>({ activeId: null, overId: null })
  React.useEffect(() => ctrl.subscribe(setState), [ctrl])

  const dragging = state.activeId

  const indexByKey = (key: string): number =>
    Array.from(containerRef.current?.querySelectorAll(`[${SORTABLE_ITEM_ATTR}]`) ?? []).findIndex(
      (el) => el.getAttribute(SORTABLE_ITEM_ATTR) === key,
    )

  const onPointerDown = (e: React.PointerEvent<HTMLElement>): void => {
    if (disabled) return
    const target = (e.target as HTMLElement).closest(`[${SORTABLE_ITEM_ATTR}]`)
    if (!target) return
    const key = target.getAttribute(SORTABLE_ITEM_ATTR) ?? ''
    if (!key) return
    ctrl.press(key, e.clientX, e.clientY)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLElement>): void => {
    if (!ctrl.getState().activeId) {
      // Pending press — promote if past threshold
      if (!ctrl.tryStart(e.clientX, e.clientY)) return
    }
    const els = containerRef.current?.querySelectorAll<HTMLElement>(`[${SORTABLE_ITEM_ATTR}]`)
    const rects = Array.from(els ?? []).map((el) => ({
      id: el.getAttribute(SORTABLE_ITEM_ATTR) ?? '',
      ...el.getBoundingClientRect(),
    }))
    ctrl.moveOver({ x: e.clientX, y: e.clientY }, rects)
  }

  const onPointerUp = (): void => {
    const result = ctrl.end()
    if (result.activeId && result.overId && result.activeId !== result.overId) {
      const from = indexByKey(result.activeId)
      const to = indexByKey(result.overId)
      if (from >= 0 && to >= 0 && from !== to) {
        const next = [...items]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved!)
        onReorder(next)
      }
    }
  }

  return (
    <div
      {...rest}
      ref={containerRef}
      data-iris-sortable=""
      data-state={dragging ? 'dragging' : 'idle'}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-gap-sm, 4px)',
        opacity: disabled ? 0.6 : 1,
        userSelect: dragging ? 'none' : undefined,
        ...style,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child
        const key = getKey(items[index]!, index)
        const isDragging = key === dragging
        return (
          <div
            key={key}
            data-iris-sortable-item={key}
            data-iris-sortable-dragging={isDragging ? '' : undefined}
            style={{
              transition: isDragging ? 'none' : 'transform 150ms ease',
              opacity: isDragging ? 0.4 : 1,
              position: 'relative',
              zIndex: isDragging ? 100 : undefined,
            }}
          >
            {child}
          </div>
        )
      })}
    </div>
  )
}
