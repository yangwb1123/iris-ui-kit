import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { usePopoverContext } from './context'

export interface IrisPopoverContentProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Portal target. `false` renders in place; an HTMLElement renders inside it; default = `document.body`. */
  portalTarget?: HTMLElement | false
  /** Move focus into the content on open (default: true). */
  autoFocus?: boolean
  /** Restore focus to the trigger on close (default: true). */
  restoreFocus?: boolean
  children?: React.ReactNode
}

/**
 * The floating panel rendered when the Popover is open. Position is computed
 * by `useFloating` (Floating UI); dismissal is handled by document-level
 * pointerdown + Escape listeners. Focus moves into the content on open and
 * back to the trigger on close.
 *
 * The content is portaled to `document.body` by default to avoid stacking /
 * overflow / z-index foot-guns. Pass `portalTarget={false}` to render inline.
 */
export const IrisPopoverContent = React.forwardRef<HTMLDivElement, IrisPopoverContentProps>(
  function IrisPopoverContent(
    { portalTarget, autoFocus = true, restoreFocus = true, style, children, ...rest },
    forwardedRef,
  ) {
    const ctx = usePopoverContext('IrisPopoverContent')

    const innerRef = React.useRef<HTMLDivElement | null>(null)

    const captureRef = React.useCallback(
      (el: HTMLDivElement | null) => {
        innerRef.current = el
        ctx.contentRef.current = el
        if (typeof forwardedRef === 'function') forwardedRef(el)
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = el
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
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          ctx.setOpen(false)
        }
      }
      document.addEventListener('pointerdown', onPointerDown)
      document.addEventListener('keydown', onKeyDown)
      return () => {
        document.removeEventListener('pointerdown', onPointerDown)
        document.removeEventListener('keydown', onKeyDown)
      }
    }, [ctx])

    // Focus management.
    const lastFocusedRef = React.useRef<HTMLElement | null>(null)
    const wasOpenRef = React.useRef(false)
    React.useEffect(() => {
      if (ctx.open && !wasOpenRef.current) {
        lastFocusedRef.current =
          (document.activeElement as HTMLElement | null) ?? ctx.triggerRef.current
        if (autoFocus) {
          // Defer to next microtask so the content is mounted/painted.
          queueMicrotask(() => {
            innerRef.current?.focus()
          })
        }
      } else if (!ctx.open && wasOpenRef.current) {
        if (restoreFocus) {
          const target = ctx.triggerRef.current ?? lastFocusedRef.current
          target?.focus()
        }
      }
      wasOpenRef.current = ctx.open
    }, [ctx.open, autoFocus, restoreFocus, ctx.triggerRef])

    if (!ctx.open) return null

    const node = (
      <div
        {...rest}
        ref={captureRef}
        id={ctx.contentId}
        role="dialog"
        tabIndex={-1}
        data-state="open"
        data-placement={ctx.placement}
        style={{
          ...floatingStyles,
          background: 'var(--iris-surface)',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-md, 6px)',
          padding: 'var(--iris-padding-md, 12px)',
          boxShadow:
            '0 8px 24px -8px rgba(0, 0, 0, 0.16), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
          fontSize: 14,
          zIndex: 1000,
          outline: 'none',
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
