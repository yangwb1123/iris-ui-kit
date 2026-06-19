import * as React from 'react'

/** A single menu row, or a divider. */
export type MenuItem =
  | { label: string; onClick?: () => void; danger?: boolean; disabled?: boolean }
  | { separator: true }

export interface ContextMenuProps {
  /** Anchor position (viewport coordinates); the menu is clamped to stay on screen. */
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

const isSeparator = (item: MenuItem): item is { separator: true } =>
  (item as { separator?: true }).separator === true

const MENU_WIDTH = 220
const VIEWPORT_MARGIN = 8

/**
 * A reusable right-click menu, token-styled to the active OS skin. Renders at
 * (x, y), clamped into the viewport, and dismisses on click-outside (captured
 * pointerdown) or Escape. Item clicks fire `onClick` then `onClose`.
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  // Measure the rendered menu so the clamp can account for its real height.
  const [pos, setPos] = React.useState({ left: x, top: y })

  React.useLayoutEffect(() => {
    const el = ref.current
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = el?.offsetWidth ?? MENU_WIDTH
    const height = el?.offsetHeight ?? 0
    const left = Math.max(VIEWPORT_MARGIN, Math.min(x, vw - width - VIEWPORT_MARGIN))
    const top = Math.max(VIEWPORT_MARGIN, Math.min(y, vh - height - VIEWPORT_MARGIN))
    setPos({ left, top })
  }, [x, y, items])

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    // Capture so we win over the desktop's own pointerdown handler.
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      className="ctx-menu"
      // Don't let clicks inside the menu bubble to desktop/window handlers.
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 99999,
        minWidth: MENU_WIDTH,
        padding: 6,
        borderRadius: 'var(--os-window-radius)',
        background: 'var(--os-window-bg)',
        color: 'var(--os-window-fg)',
        border: 'var(--os-window-border)',
        boxShadow: 'var(--os-window-shadow)',
        backdropFilter: 'var(--os-blur)',
        WebkitBackdropFilter: 'var(--os-blur)',
        font: '13px var(--os-font)',
        userSelect: 'none',
      }}
    >
      {items.map((item, i) => {
        if (isSeparator(item)) {
          return (
            <div
              key={`sep-${i}`}
              role="separator"
              style={{
                height: 1,
                margin: '5px 6px',
                background: 'rgba(127,127,127,0.28)',
              }}
            />
          )
        }
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="ctx-menu-item"
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.()
              onClose()
            }}
            style={{ color: item.danger ? '#e5484d' : 'inherit' }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
