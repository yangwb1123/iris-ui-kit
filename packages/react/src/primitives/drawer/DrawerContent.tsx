import * as React from 'react'
import { createPortal } from 'react-dom'
import { composeEventHandlers } from '@iris-ui/core'
import { useBodyScrollLock } from '../../modal-utils/useBodyScrollLock'
import { useFocusTrap } from '../../modal-utils/useFocusTrap'
import { IrisSlot } from '../slot/Slot'
import { useDrawerContext, type IrisDrawerSide } from './context'

const SIDE_TO_TRANSFORM: Record<IrisDrawerSide, string> = {
  left: 'translateX(-100%)',
  right: 'translateX(100%)',
  top: 'translateY(-100%)',
  bottom: 'translateY(100%)',
}

/**
 * Safe-area padding for the screen edges the panel actually touches, so its
 * content clears the notch / home indicator on mobile webviews (Cordova). The
 * insets resolve to 0 on devices/orientations without a cutout, and the whole
 * declaration is simply ignored on engines without env() support.
 * (Host must set <meta name="viewport" content="...,viewport-fit=cover">.)
 */
function safeAreaPadding(side: IrisDrawerSide): React.CSSProperties {
  const top = 'max(0px, env(safe-area-inset-top))'
  const right = 'max(0px, env(safe-area-inset-right))'
  const bottom = 'max(0px, env(safe-area-inset-bottom))'
  const left = 'max(0px, env(safe-area-inset-left))'
  switch (side) {
    case 'left':
      return { paddingTop: top, paddingBottom: bottom, paddingLeft: left }
    case 'right':
      return { paddingTop: top, paddingBottom: bottom, paddingRight: right }
    case 'top':
      return { paddingTop: top, paddingLeft: left, paddingRight: right }
    case 'bottom':
      return { paddingBottom: bottom, paddingLeft: left, paddingRight: right }
  }
}

function panelPositionStyle(side: IrisDrawerSide, size: string): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'fixed',
    background: 'var(--iris-background)',
    color: 'var(--iris-foreground)',
    boxShadow: 'var(--iris-shadow-md, 0 8px 24px rgba(0,0,0,.18))',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    transition: 'transform 220ms ease',
    willChange: 'transform',
    ...safeAreaPadding(side),
  }
  switch (side) {
    case 'left':
      return { ...base, top: 0, bottom: 0, left: 0, width: size, height: '100vh' }
    case 'right':
      return { ...base, top: 0, bottom: 0, right: 0, width: size, height: '100vh' }
    case 'top':
      return { ...base, top: 0, left: 0, right: 0, width: '100vw', height: size }
    case 'bottom':
      return { ...base, bottom: 0, left: 0, right: 0, width: '100vw', height: size }
  }
}

const EXIT_DURATION_MS = 220

export interface IrisDrawerContentProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  portalTarget?: HTMLElement | false
  children?: React.ReactNode
}

/**
 * The slide-in surface. Mounts when `open` becomes true and unmounts
 * `EXIT_DURATION_MS` after `open` becomes false so the slide-out transition
 * runs before removal. Provides backdrop, body scroll lock, focus trap, and
 * Escape / outside-click dismiss.
 */
export const IrisDrawerContent = React.forwardRef<HTMLDivElement, IrisDrawerContentProps>(
  function IrisDrawerContent({ portalTarget, style, children, ...rest }, forwardedRef) {
    const ctx = useDrawerContext('IrisDrawerContent')

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

    // 2-stage mount: mounted (in DOM) + visible (transform applied).
    const [mounted, setMounted] = React.useState(ctx.open)
    const [visible, setVisible] = React.useState(ctx.open)

    React.useEffect(() => {
      if (ctx.open) {
        setMounted(true)
        // RAF so initial off-screen transform commits before flipping to on-screen.
        const raf = requestAnimationFrame(() => setVisible(true))
        return () => cancelAnimationFrame(raf)
      } else {
        setVisible(false)
        const timer = setTimeout(() => setMounted(false), EXIT_DURATION_MS)
        return () => clearTimeout(timer)
      }
    }, [ctx.open])

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
          e.preventDefault()
          ctx.setOpen(false)
        }
      }
      document.addEventListener('keydown', onKeyDown)
      return () => document.removeEventListener('keydown', onKeyDown)
    }, [ctx])

    if (!mounted) return null

    const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!ctx.closeOnOutsideClick) return
      if (e.target !== e.currentTarget) return
      ctx.setOpen(false)
    }

    const onContentPointerDown = composeEventHandlers(
      rest.onPointerDown as ((e: React.PointerEvent<HTMLDivElement>) => void) | undefined,
      (e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation(),
    )

    const offScreen = SIDE_TO_TRANSFORM[ctx.side]
    const panelStyle = panelPositionStyle(ctx.side, ctx.size)

    const node = (
      <div
        data-iris-drawer-backdrop=""
        data-state={visible ? 'open' : 'closed'}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          opacity: visible ? 1 : 0,
          transition: `opacity ${EXIT_DURATION_MS}ms ease`,
          zIndex: 1200,
        }}
        onClick={onBackdropClick}
      >
        <div
          {...rest}
          ref={captureRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ctx.hasTitle ? ctx.titleId : undefined}
          id={ctx.contentId}
          data-iris-drawer-content=""
          data-iris-drawer-side={ctx.side}
          data-state={visible ? 'open' : 'closed'}
          tabIndex={-1}
          onPointerDown={onContentPointerDown}
          style={{
            ...panelStyle,
            transform: visible ? 'translate(0,0)' : offScreen,
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

export type IrisDrawerTitleProps = React.HTMLAttributes<HTMLHeadingElement>

export const IrisDrawerTitle = React.forwardRef<HTMLHeadingElement, IrisDrawerTitleProps>(
  function IrisDrawerTitle({ style, children, ...rest }, ref) {
    const ctx = useDrawerContext('IrisDrawerTitle')
    React.useEffect(() => ctx.registerTitle(), [ctx.registerTitle])
    return (
      <h2
        {...rest}
        ref={ref}
        id={ctx.titleId}
        data-iris-drawer-title=""
        style={{
          margin: 0,
          padding: 'var(--iris-padding-md, 12px)',
          fontSize: 'var(--iris-font-size-lg, 16px)',
          fontWeight: 600,
          borderBottom: '1px solid var(--iris-border)',
          ...style,
        }}
      >
        {children}
      </h2>
    )
  },
)

export interface IrisDrawerCloseProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  asChild?: boolean
  children?: React.ReactNode
}

export const IrisDrawerClose = React.forwardRef<HTMLElement, IrisDrawerCloseProps>(
  function IrisDrawerClose({ asChild = false, onClick, children, ...rest }, forwardedRef) {
    const ctx = useDrawerContext('IrisDrawerClose')
    const handleClick = composeEventHandlers(
      onClick as ((e: React.MouseEvent<HTMLElement>) => void) | undefined,
      () => ctx.setOpen(false),
    )

    if (asChild) {
      if (!React.isValidElement(children)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[iris-ui] IrisDrawerClose asChild requires a single React element')
        }
        return null
      }
      return (
        <IrisSlot
          ref={forwardedRef as React.Ref<unknown>}
          {...rest}
          data-iris-drawer-close=""
          onClick={handleClick}
        >
          {children}
        </IrisSlot>
      )
    }
    return (
      <button
        type="button"
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        ref={forwardedRef as React.Ref<HTMLButtonElement>}
        data-iris-drawer-close=""
        onClick={handleClick}
      >
        {children}
      </button>
    )
  },
)
