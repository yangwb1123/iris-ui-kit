import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import type { IrisTableContextMenuParams } from './types'

/** One right-click menu entry (vxe MenuFirstOption code/name/disabled parity). */
export interface IrisTableContextMenuItem {
  key: string
  label: string
  disabled?: boolean
}

interface TableContextMenuProps<Row extends Record<string, unknown>> {
  open: boolean
  /**
   * Virtual anchor: a ref whose `current` is a fake element exposing
   * `getBoundingClientRect()` at the right-click cursor coordinates (zero
   * size). Populated by the table right before `open` flips to true.
   */
  anchorRef: React.RefObject<HTMLElement | null>
  items: IrisTableContextMenuItem[]
  params: IrisTableContextMenuParams<Row>
  onSelect: (key: string, params: IrisTableContextMenuParams<Row>) => void
  onClose: () => void
}

/**
 * Floating right-click menu for `IrisTable` (vxe-grid contextMenu parity).
 * Self-drawn with the same building blocks `IrisMenuContent` uses —
 * `useFloating` + `useDismiss` — because `IrisMenu` is trigger-DOM-anchored
 * and cannot host a coordinate-based menu without faking a trigger.
 *
 * Positioning: the anchor is a VIRTUAL element at the cursor (zero-size rect),
 * so the menu's top-left lands exactly on the cursor — flip/shift are disabled
 * deliberately (cursor-anchored menu, vxe parity; with a zero-size anchor at
 * the viewport edge they would clamp the coordinates away from the cursor).
 * Dismissal: Escape, outside pointer-down (useDismiss), and any
 * scroll (capture-phase document listener — nested scrollers count too).
 * Rendered through a portal to `document.body` so the table's `overflow`
 * clipping never cuts it.
 */
export function TableContextMenu<Row extends Record<string, unknown>>({
  open,
  anchorRef,
  items,
  params,
  onSelect,
  onClose,
}: TableContextMenuProps<Row>): React.ReactElement | null {
  const menuRef = React.useRef<HTMLDivElement | null>(null)

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: menuRef,
    open,
    placement: 'bottom-start',
    flip: false,
    shift: false,
  })

  useDismiss({
    enabled: open,
    exclude: [menuRef],
    onDismiss: onClose,
  })

  // Scroll anywhere closes the menu. Capture phase so scrolling inside any
  // nested scroll container (or the table itself) also counts.
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onScroll = (): void => onCloseRef.current()
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  }, [open])

  if (!open) return null

  const node = (
    <div
      ref={menuRef}
      role="menu"
      data-iris-table-context-menu=""
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-padding-sm, 4px)',
        minWidth: 160,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          data-iris-table-context-menu-item={item.key}
          disabled={item.disabled}
          aria-disabled={item.disabled ? 'true' : undefined}
          onClick={() => {
            onSelect(item.key, params)
            onClose()
          }}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: item.disabled ? 'default' : 'pointer',
            color: item.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
            font: 'inherit',
            textAlign: 'start',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
