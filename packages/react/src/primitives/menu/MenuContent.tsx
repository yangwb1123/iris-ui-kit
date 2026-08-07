import * as React from 'react'
import { createPortal } from 'react-dom'
import {
  createKeyboardNav,
  type KeyboardNavController,
  type KeyboardNavAction,
} from '@iris-ui-kit/core'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { useMenuContext } from './context'

export interface IrisMenuContentProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  portalTarget?: HTMLElement | false
  children?: React.ReactNode
}

/**
 * Menu surface (`role="menu"`). Handles ArrowUp/Down/Home/End nav across all
 * `[role="menuitem"]` descendants (including those inside submenu triggers).
 * Closes on outside click, Escape, and Tab.
 *
 * Keyboard navigation is single-sourced in `@iris-ui-kit/core`'s
 * {@link createKeyboardNav} — this adapter only bridges the returned actions
 * to DOM focus.
 */
export const IrisMenuContent = React.forwardRef<HTMLDivElement, IrisMenuContentProps>(
  function IrisMenuContent({ portalTarget, style, onKeyDown, children, ...rest }, forwardedRef) {
    const ctx = useMenuContext('IrisMenuContent')

    const innerRef = React.useRef<HTMLDivElement | null>(null)
    const captureRef = React.useCallback(
      (el: HTMLDivElement | null) => {
        innerRef.current = el
        ctx.contentRef.current = el
        if (typeof forwardedRef === 'function') forwardedRef(el)
        else if (forwardedRef)
          (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = el
      },
      [ctx, forwardedRef],
    )

    const { floatingStyles } = useFloating({
      anchor: ctx.triggerRef,
      floating: innerRef,
      open: ctx.open,
      placement: ctx.placement,
      offset: ctx.offset,
    })

    // Outside-pointerdown + Escape dismiss (shared floating hook).
    useDismiss({
      enabled: ctx.open,
      exclude: [ctx.triggerRef, ctx.contentRef],
      onDismiss: () => ctx.setOpen(false),
    })

    // Focus first item on open; restore focus to trigger on close.
    const wasOpenRef = React.useRef(false)
    React.useEffect(() => {
      if (ctx.open && !wasOpenRef.current) {
        queueMicrotask(() => {
          const items = innerRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')
          items?.[0]?.focus()
        })
      } else if (!ctx.open && wasOpenRef.current) {
        ctx.triggerRef.current?.focus?.()
      }
      wasOpenRef.current = ctx.open
    }, [ctx.open, ctx.triggerRef])

    // ── Keyboard navigation (single-sourced in core controller) ──────────
    const navRef = React.useRef<KeyboardNavController | null>(null)
    if (navRef.current === null) {
      navRef.current = createKeyboardNav({ count: 0, loop: true })
    }
    const nav = navRef.current

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e)
      if (!ctx.open) return
      const items = Array.from(
        innerRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([aria-disabled="true"])',
        ) ?? [],
      )
      if (items.length === 0) return

      // Tab always closes the root menu.
      if (e.key === 'Tab') {
        ctx.closeRoot()
        return
      }

      // Sync nav state to the currently focused element.
      nav.reset(items.length)
      const current = document.activeElement as HTMLElement | null
      const curIndex = current ? items.indexOf(current) : -1
      if (curIndex >= 0) nav.focus(curIndex)

      const action: KeyboardNavAction = nav.handleKeyDown({
        key: e.key,
        preventDefault: () => e.preventDefault(),
      })

      if (action.type === 'focus') {
        items[action.target]?.focus()
      }
    }

    if (!ctx.open) return null

    const node = (
      <div
        {...rest}
        ref={captureRef}
        id={ctx.contentId}
        role="menu"
        tabIndex={-1}
        data-iris-menu=""
        data-state="open"
        onKeyDown={handleKeyDown}
        style={{
          ...floatingStyles,
          background: 'var(--iris-surface)',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-md, 6px)',
          padding: 'var(--iris-padding-sm, 4px)',
          boxShadow: 'var(--iris-shadow-lg)',
          minWidth: 180,
          outline: 'none',
          zIndex: 1000,
          ...style,
        }}
      >
        {children}
      </div>
    )

    if (portalTarget === false) return node
    if (typeof document === 'undefined') return null
    return createPortal(node, portalTarget ?? document.body)
  },
)
