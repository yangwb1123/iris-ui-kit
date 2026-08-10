import * as React from 'react'
import { createPortal } from 'react-dom'
import { matchTypeahead } from '@iris-ui-kit/core'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
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

    // Typeahead buffer: accumulated printable chars, reset after a ~500ms pause.
    const typeaheadRef = React.useRef<{
      buffer: string
      timer: ReturnType<typeof setTimeout> | null
    }>({ buffer: '', timer: null })

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
        default: {
          // Typeahead: a single printable char jumps to (and repeated chars
          // cycle through) items whose label matches the accumulated buffer.
          if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
            const ta = typeaheadRef.current
            ta.buffer += e.key
            if (ta.timer) clearTimeout(ta.timer)
            ta.timer = setTimeout(() => {
              ta.buffer = ''
            }, 500)
            const match = matchTypeahead(
              items.map((it) => it.textContent ?? ''),
              ta.buffer,
              index,
            )
            if (match >= 0) {
              e.preventDefault()
              items[match]?.focus()
            }
          }
        }
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
          background: 'var(--iris-surface-floating)',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-md, 6px)',
          padding: 'var(--iris-padding-sm, 4px)',
          boxShadow: 'var(--iris-shadow-lg)',
          minWidth: 160,
          outline: 'none',
          zIndex: 'var(--iris-z-popover, 1000)',
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
