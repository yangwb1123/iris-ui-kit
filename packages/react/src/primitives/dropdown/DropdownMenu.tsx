import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { useDropdownContext } from './context'

export interface IrisDropdownMenuProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  portalTarget?: HTMLElement | false
  children?: React.ReactNode
}

/**
 * The menu surface. Renders `role="menu"` and handles ArrowUp/Down/Home/End
 * navigation across child `IrisDropdownItem`s. Closes on Escape, outside
 * pointerdown, and Tab.
 */
export const IrisDropdownMenu = React.forwardRef<HTMLDivElement, IrisDropdownMenuProps>(
  function IrisDropdownMenu({ portalTarget, style, onKeyDown, children, ...rest }, forwardedRef) {
    const ctx = useDropdownContext('IrisDropdownMenu')

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

    // Outside-click + Escape dismiss.
    React.useEffect(() => {
      if (!ctx.open) return
      const onPointerDown = (e: PointerEvent) => {
        const target = e.target as Node | null
        if (!target) return
        const t = ctx.triggerRef.current
        const c = ctx.contentRef.current
        if (t && t.contains(target)) return
        if (c && c.contains(target)) return
        ctx.setOpen(false)
      }
      const onDocKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          ctx.setOpen(false)
        }
      }
      document.addEventListener('pointerdown', onPointerDown)
      document.addEventListener('keydown', onDocKeyDown)
      return () => {
        document.removeEventListener('pointerdown', onPointerDown)
        document.removeEventListener('keydown', onDocKeyDown)
      }
    }, [ctx])

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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e)
      if (!ctx.open) return
      const items = Array.from(
        innerRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([aria-disabled="true"])',
        ) ?? [],
      )
      if (items.length === 0) return
      const current = document.activeElement as HTMLElement | null
      const index = current ? items.indexOf(current) : -1
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          const next = index < 0 ? 0 : (index + 1) % items.length
          items[next]?.focus()
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const next = index <= 0 ? items.length - 1 : index - 1
          items[next]?.focus()
          break
        }
        case 'Home':
          e.preventDefault()
          items[0]?.focus()
          break
        case 'End':
          e.preventDefault()
          items[items.length - 1]?.focus()
          break
        case 'Tab':
          // Tab closes the menu and lets focus continue out.
          ctx.setOpen(false)
          break
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
        data-iris-dropdown-menu=""
        data-state="open"
        onKeyDown={handleKeyDown}
        style={{
          ...floatingStyles,
          background: 'var(--iris-surface)',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-md, 6px)',
          padding: 'var(--iris-padding-sm, 4px)',
          boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.16), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
          minWidth: 160,
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
