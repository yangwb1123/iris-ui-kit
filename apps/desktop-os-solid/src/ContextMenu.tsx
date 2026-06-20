import { For, createSignal, onCleanup, onMount, type JSX } from 'solid-js'

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
export function ContextMenu(props: ContextMenuProps): JSX.Element {
  let ref: HTMLDivElement | undefined
  // Measure the rendered menu so the clamp can account for its real height.
  const [pos, setPos] = createSignal({ left: props.x, top: props.y })

  onMount(() => {
    const el = ref
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = el?.offsetWidth ?? MENU_WIDTH
    const height = el?.offsetHeight ?? 0
    const left = Math.max(VIEWPORT_MARGIN, Math.min(props.x, vw - width - VIEWPORT_MARGIN))
    const top = Math.max(VIEWPORT_MARGIN, Math.min(props.y, vh - height - VIEWPORT_MARGIN))
    setPos({ left, top })
  })

  const onPointerDown = (e: PointerEvent): void => {
    if (ref && !ref.contains(e.target as Node)) props.onClose()
  }
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      props.onClose()
    }
  }
  // Capture so we win over the desktop's own pointerdown handler.
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('keydown', onKeyDown)
  onCleanup(() => {
    window.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div
      ref={ref}
      role="menu"
      class="ctx-menu"
      // Don't let clicks inside the menu bubble to desktop/window handlers.
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: `${pos().left}px`,
        top: `${pos().top}px`,
        'z-index': 99999,
        'min-width': `${MENU_WIDTH}px`,
        padding: '6px',
        'border-radius': 'var(--os-window-radius)',
        background: 'var(--os-window-bg)',
        color: 'var(--os-window-fg)',
        border: 'var(--os-window-border)',
        'box-shadow': 'var(--os-window-shadow)',
        'backdrop-filter': 'var(--os-blur)',
        '-webkit-backdrop-filter': 'var(--os-blur)',
        font: '13px var(--os-font)',
        'user-select': 'none',
      }}
    >
      <For each={props.items}>
        {(item) => {
          if (isSeparator(item)) {
            return (
              <div
                role="separator"
                style={{
                  height: '1px',
                  margin: '5px 6px',
                  background: 'rgba(127,127,127,0.28)',
                }}
              />
            )
          }
          return (
            <button
              type="button"
              role="menuitem"
              class="ctx-menu-item"
              disabled={item.disabled}
              onClick={() => {
                item.onClick?.()
                props.onClose()
              }}
              style={{ color: item.danger ? '#e5484d' : 'inherit' }}
            >
              {item.label}
            </button>
          )
        }}
      </For>
    </div>
  )
}
