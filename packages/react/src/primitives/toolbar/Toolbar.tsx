import * as React from 'react'
import {
  createKeyboardNav,
  type KeyboardNavAction,
  type KeyboardNavController,
} from '@iris-ui-kit/core'

export type IrisToolbarOrientation = 'horizontal' | 'vertical'

export interface IrisToolbarProps {
  children?: React.ReactNode
  orientation?: IrisToolbarOrientation
  ariaLabel?: string
  style?: React.CSSProperties
  className?: string
}

const SELECTOR = 'button, [href], input, select, textarea, [tabindex]'

/**
 * Toolbar: a `role="toolbar"` grouping of actions with roving-tabindex keyboard
 * navigation — one item is in the tab order, and Arrow keys (per orientation)
 * plus Home/End move focus and the tab stop between the focusable children.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisToolbar}.
 *
 * Keyboard navigation is single-sourced in `createKeyboardNav` from the core
 * package — the controller handles orientation-aware Arrow keys, looping, and
 * Home/End; this component only owns the bridge to the DOM (tabindex + focus).
 */
export function IrisToolbar({
  children,
  orientation = 'horizontal',
  ariaLabel,
  style,
  className,
}: IrisToolbarProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement | null>(null)

  const items = React.useCallback((): HTMLElement[] => {
    const root = ref.current
    if (!root) return []
    return (Array.from(root.querySelectorAll(SELECTOR)) as HTMLElement[]).filter(
      (el) => !el.hasAttribute('disabled'),
    )
  }, [])

  // ── Keyboard navigation (single-sourced in core controller) ────────────

  const navRef = React.useRef<KeyboardNavController | null>(null)
  if (navRef.current === null) {
    navRef.current = createKeyboardNav({
      count: 0,
      loop: true,
      orientation,
      isEnabled: () => true,
    })
  }
  const nav = navRef.current

  // Keep the controller's item count in sync whenever children re-render.
  React.useEffect(() => {
    nav.reset(items().length)
  })

  // Initial roving tabindex: the first (enabled) item is reachable via Tab,
  // the rest are only reachable via arrow keys.
  React.useEffect(() => {
    items().forEach((el, i) => {
      el.tabIndex = i === 0 ? 0 : -1
    })
  }, [items])

  const updateTabIndexes = (target: number, list: HTMLElement[]): void => {
    list.forEach((el, i) => {
      el.tabIndex = i === target ? 0 : -1
    })
  }

  // Keep the nav index in sync when focus moves to a child by any means
  // (click, Tab, programmatic focus) — the nav controller's internal index
  // must match the actual focused element for correct wrapping behaviour.
  const onFocusCapture = (e: React.FocusEvent<HTMLDivElement>): void => {
    const list = items()
    const idx = list.indexOf(e.target as HTMLElement)
    if (idx >= 0) nav.focus(idx)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const list = items()
    if (list.length === 0) return

    // Only route navigation keys through the controller — let Enter / Space
    // activate native button behaviour unhindered.
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!navKeys.includes(e.key)) return

    const action: KeyboardNavAction = nav.handleKeyDown({
      key: e.key,
      preventDefault: () => e.preventDefault(),
    })

    if (action.type === 'focus') {
      updateTabIndexes(action.target, list)
      list[action.target]?.focus()
    }
    // 'previous' / 'next' are cross-orientation arrows (e.g. ArrowUp in
    // horizontal mode) — the toolbar ignores them.
    // 'noop' — the key had no effect, nothing to do.
  }

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-orientation={orientation}
      aria-label={ariaLabel}
      data-iris-toolbar=""
      data-orientation={orientation}
      className={className}
      onFocusCapture={onFocusCapture}
      onKeyDown={onKeyDown}
      style={{
        display: 'inline-flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        alignItems: 'center',
        gap: 4,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
