import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { usePopoverContext } from './context'
import { installFloatingAnimations, ANIM_POPOVER } from '../../floating/animations'

export interface IrisPopoverContentProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
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
        installFloatingAnimations()
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
          background: 'var(--iris-surface-floating)',
          animation: ANIM_POPOVER,
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-md, 6px)',
          padding: 'var(--iris-padding-md, 12px)',
          boxShadow: 'var(--iris-shadow-lg)',
          fontSize: 'var(--iris-font-size-md, 14px)',
          zIndex: 'var(--iris-z-popover, 1000)',
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
