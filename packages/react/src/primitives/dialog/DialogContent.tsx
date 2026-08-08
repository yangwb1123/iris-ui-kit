import * as React from 'react'
import { createPortal } from 'react-dom'
import { composeEventHandlers } from '@iris-ui-kit/core'
import { useBodyScrollLock } from '../../modal-utils/useBodyScrollLock'
import { useFocusTrap } from '../../modal-utils/useFocusTrap'
import { IrisSlot } from '../slot/Slot'
import { useDialogContext } from './context'
import { installFloatingAnimations, ANIM_DIALOG } from '../../floating/animations'

export interface IrisDialogContentProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  /** Portal target. `false` renders in place; default = `document.body`. */
  portalTarget?: HTMLElement | false
  children?: React.ReactNode
}

/**
 * The modal surface (and its backdrop). Renders only while the dialog is
 * open. Behaviors enabled automatically:
 *
 *   - **Body scroll lock** — reference-counted across stacked dialogs.
 *   - **Focus trap** — Tab cycling within content; restores focus on close.
 *   - **Escape to dismiss** — controlled by `Dialog.closeOnEscape`.
 *   - **Backdrop click to dismiss** — controlled by `Dialog.closeOnOutsideClick`.
 *   - **ARIA** — `role="dialog"`, `aria-modal="true"`, `aria-labelledby` /
 *     `aria-describedby` wired automatically when `<IrisDialogTitle>` /
 *     `<IrisDialogDescription>` are present.
 */
export const IrisDialogContent = React.forwardRef<HTMLDivElement, IrisDialogContentProps>(
  function IrisDialogContent(
    { portalTarget, style, onPointerDown, children, ...rest },
    forwardedRef,
  ) {
    const ctx = useDialogContext('IrisDialogContent')

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
    installFloatingAnimations()

    useBodyScrollLock(ctx.open)
    useFocusTrap({
      container: innerRef,
      active: ctx.open,
      returnFocusTo: ctx.triggerRef,
    })

    React.useEffect(() => {
      if (!ctx.open || !ctx.closeOnEscape) return
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          ctx.setOpen(false)
        }
      }
      document.addEventListener('keydown', onKeyDown)
      return () => document.removeEventListener('keydown', onKeyDown)
    }, [ctx])

    if (!ctx.open) return null

    const handleBackdropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!ctx.closeOnOutsideClick) return
      if (e.target === e.currentTarget) ctx.setOpen(false)
    }

    const handleContentPointerDown = composeEventHandlers(
      onPointerDown as ((e: React.PointerEvent<HTMLDivElement>) => void) | undefined,
      (e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation(),
    )

    const node = (
      <div
        data-iris-dialog-backdrop=""
        onPointerDown={handleBackdropPointerDown}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--iris-backdrop, rgba(0, 0, 0, 0.5))',
          zIndex: 'var(--iris-z-modal, 1200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          {...rest}
          ref={captureRef}
          id={ctx.contentId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ctx.hasTitle ? ctx.titleId : undefined}
          aria-describedby={ctx.hasDescription ? ctx.descriptionId : undefined}
          tabIndex={-1}
          data-state="open"
          onPointerDown={handleContentPointerDown}
          style={{
            background: 'var(--iris-surface-floating)',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-lg, 8px)',
            animation: ANIM_DIALOG,
            padding: 'var(--iris-padding-lg, 20px)',
            boxShadow: 'var(--iris-shadow-xl)',
            maxWidth: '90vw',
            maxHeight: '85vh',
            overflow: 'auto',
            outline: 'none',
            ...style,
          }}
        >
          {children}
        </div>
      </div>
    )

    if (portalTarget === false) return node
    if (typeof document === 'undefined') return null
    return createPortal(node, portalTarget ?? document.body)
  },
)

export interface IrisDialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: keyof React.JSX.IntrinsicElements
}

/**
 * Sets `aria-labelledby` on the dialog content automatically. Renders an
 * `<h2>` by default.
 */
export const IrisDialogTitle = React.forwardRef<HTMLElement, IrisDialogTitleProps>(
  function IrisDialogTitle({ as = 'h2', style, children, ...rest }, ref) {
    const ctx = useDialogContext('IrisDialogTitle')
    React.useEffect(() => ctx.registerTitle(), [ctx.registerTitle])
    return React.createElement(
      as,
      {
        ...rest,
        ref,
        id: ctx.titleId,
        style: {
          margin: '0 0 var(--iris-gap-md, 12px) 0',
          fontSize: 'var(--iris-font-size-xl, 18px)',
          fontWeight: 600,
          ...style,
        },
      },
      children,
    )
  },
)

export interface IrisDialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  as?: keyof React.JSX.IntrinsicElements
}

/**
 * Sets `aria-describedby` on the dialog content automatically. Renders a
 * `<p>` by default.
 */
export const IrisDialogDescription = React.forwardRef<HTMLElement, IrisDialogDescriptionProps>(
  function IrisDialogDescription({ as = 'p', style, children, ...rest }, ref) {
    const ctx = useDialogContext('IrisDialogDescription')
    React.useEffect(() => ctx.registerDescription(), [ctx.registerDescription])
    return React.createElement(
      as,
      {
        ...rest,
        ref,
        id: ctx.descriptionId,
        style: {
          margin: '0 0 var(--iris-gap-lg, 16px) 0',
          color: 'var(--iris-muted)',
          fontSize: 'var(--iris-font-size-md, 14px)',
          ...style,
        },
      },
      children,
    )
  },
)

export interface IrisDialogCloseProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  asChild?: boolean
  children?: React.ReactNode
}

/** Close button. Renders a `<button type="button">` or, with `asChild`, wraps the provided child. */
export const IrisDialogClose = React.forwardRef<HTMLElement, IrisDialogCloseProps>(
  function IrisDialogClose({ asChild = false, onClick, children, ...rest }, forwardedRef) {
    const ctx = useDialogContext('IrisDialogClose')
    const handleClick = composeEventHandlers(
      onClick as ((e: React.MouseEvent<HTMLElement>) => void) | undefined,
      () => ctx.setOpen(false),
    )

    if (asChild) {
      if (!React.isValidElement(children)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[iris-ui] IrisDialogClose asChild requires a single React element')
        }
        return null
      }
      return (
        <IrisSlot ref={forwardedRef as React.Ref<unknown>} {...rest} onClick={handleClick}>
          {children}
        </IrisSlot>
      )
    }
    return (
      <button
        type="button"
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        ref={forwardedRef as React.Ref<HTMLButtonElement>}
        onClick={handleClick}
      >
        {children}
      </button>
    )
  },
)
