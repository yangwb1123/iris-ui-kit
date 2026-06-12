import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  splitProps,
  Show,
  type JSX,
} from 'solid-js'
import { Portal } from 'solid-js/web'
import { useBodyScrollLock } from '../../modal-utils/useBodyScrollLock'
import { useFocusTrap } from '../../modal-utils/useFocusTrap'
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
function safeAreaPadding(side: IrisDrawerSide): JSX.CSSProperties {
  const top = 'max(0px, env(safe-area-inset-top))'
  const right = 'max(0px, env(safe-area-inset-right))'
  const bottom = 'max(0px, env(safe-area-inset-bottom))'
  const left = 'max(0px, env(safe-area-inset-left))'
  switch (side) {
    case 'left':
      return { 'padding-top': top, 'padding-bottom': bottom, 'padding-left': left }
    case 'right':
      return { 'padding-top': top, 'padding-bottom': bottom, 'padding-right': right }
    case 'top':
      return { 'padding-top': top, 'padding-left': left, 'padding-right': right }
    case 'bottom':
      return { 'padding-bottom': bottom, 'padding-left': left, 'padding-right': right }
    default:
      return {}
  }
}

function panelPositionStyle(side: IrisDrawerSide, size: string): JSX.CSSProperties {
  const base: JSX.CSSProperties = {
    position: 'fixed',
    background: 'var(--iris-background)',
    color: 'var(--iris-foreground)',
    'box-shadow': 'var(--iris-shadow-md, 0 8px 24px rgba(0,0,0,.18))',
    display: 'flex',
    'flex-direction': 'column',
    overflow: 'auto',
    transition: 'transform 220ms ease',
    'will-change': 'transform',
    ...safeAreaPadding(side),
  }
  // `100vh` is the fallback; `max-height: 100dvh` clamps full-height side panels to
  // the DYNAMIC viewport so they don't overflow under mobile browser chrome (dvh ≤ vh).
  // A separate property, so it's simply ignored where dvh is unsupported, leaving 100vh.
  switch (side) {
    case 'left':
      return {
        ...base,
        top: '0',
        bottom: '0',
        left: '0',
        width: size,
        height: '100vh',
        'max-height': '100dvh',
      }
    case 'right':
      return {
        ...base,
        top: '0',
        bottom: '0',
        right: '0',
        width: size,
        height: '100vh',
        'max-height': '100dvh',
      }
    case 'top':
      return { ...base, top: '0', left: '0', right: '0', width: '100vw', height: size }
    case 'bottom':
      return { ...base, bottom: '0', left: '0', right: '0', width: '100vw', height: size }
    default:
      return base
  }
}

export interface IrisDrawerContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children?: JSX.Element
}

/**
 * The slide-in panel. Uses body scroll lock + focus trap.
 * Animate in/out via transform with a mounted/visible state pair.
 * Solid port of the Vue IrisDrawerContent.
 */
export function IrisDrawerContent(props: IrisDrawerContentProps): JSX.Element {
  const ctx = useDrawerContext('IrisDrawerContent')
  const [local, others] = splitProps(props, ['style', 'children'])

  const [mounted, setMounted] = createSignal(false)
  const [visible, setVisible] = createSignal(false)

  let exitTimer: ReturnType<typeof setTimeout> | null = null

  createEffect(() => {
    const isOpen = ctx.open()
    if (isOpen) {
      if (exitTimer) {
        clearTimeout(exitTimer)
        exitTimer = null
      }
      setMounted(true)
      requestAnimationFrame(() => {
        setVisible(true)
      })
    } else if (mounted()) {
      setVisible(false)
      exitTimer = setTimeout(() => {
        setMounted(false)
        exitTimer = null
      }, 220)
    }
  })

  onCleanup(() => {
    if (exitTimer) clearTimeout(exitTimer)
  })

  useBodyScrollLock(ctx.open)
  useFocusTrap({
    container: ctx.contentRef,
    active: ctx.open,
    returnFocusTo: ctx.triggerRef,
  })

  // Escape handler
  createEffect(() => {
    if (!ctx.closeOnEscape) return
    if (!ctx.open()) return
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        ctx.setOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    onCleanup(() => document.removeEventListener('keydown', handler))
  })

  const onBackdropClick = (event: MouseEvent): void => {
    if (!ctx.closeOnOutsideClick) return
    if (event.target !== event.currentTarget) return
    ctx.setOpen(false)
  }

  const panelStyle = createMemo(() => panelPositionStyle(ctx.side(), ctx.size()))
  const offScreen = createMemo(() => SIDE_TO_TRANSFORM[ctx.side()] ?? 'translateX(100%)')

  return (
    <Show when={mounted()}>
      <Portal>
        <div
          data-iris-drawer-backdrop=""
          data-state={visible() ? 'open' : 'closed'}
          onClick={onBackdropClick}
          style={{
            position: 'fixed',
            inset: '0',
            background: 'rgba(0,0,0,.4)',
            opacity: visible() ? '1' : '0',
            transition: 'opacity 220ms ease',
          }}
        >
          <div
            {...(others as JSX.HTMLAttributes<HTMLDivElement>)}
            ref={ctx.setContentRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={ctx.hasTitle() ? ctx.titleId : undefined}
            id={ctx.contentId}
            data-iris-drawer-content=""
            data-iris-drawer-side={ctx.side()}
            data-state={visible() ? 'open' : 'closed'}
            tabindex={-1}
            style={{
              ...panelStyle(),
              transform: visible() ? 'translate(0,0)' : offScreen(),
              ...((local.style as JSX.CSSProperties) ?? {}),
            }}
          >
            {local.children}
          </div>
        </div>
      </Portal>
    </Show>
  )
}

/** Accessible title for the drawer. */
export function IrisDrawerTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  const ctx = useDrawerContext('IrisDrawerTitle')
  ctx.setHasTitle(true)

  return (
    <h2
      {...props}
      id={ctx.titleId}
      data-iris-drawer-title=""
      style={{
        margin: '0',
        padding: 'var(--iris-padding-md)',
        'font-size': 'var(--iris-font-size-lg, 16px)',
        'font-weight': '600',
        'border-bottom': '1px solid var(--iris-border)',
        ...((props.style as JSX.CSSProperties) ?? {}),
      }}
    />
  )
}

/** Close button for the drawer. */
export function IrisDrawerClose(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  const ctx = useDrawerContext('IrisDrawerClose')
  const { onClick, children, ...rest } = props

  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (typeof onClick === 'function') onClick(e)
    ctx.setOpen(false)
  }

  return (
    <button type="button" {...rest} data-iris-drawer-close="" onClick={handleClick}>
      {children}
    </button>
  )
}
