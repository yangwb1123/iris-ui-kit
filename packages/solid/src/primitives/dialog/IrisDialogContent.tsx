import { createEffect, onCleanup, splitProps, Show, type JSX } from 'solid-js'
import { Portal, Dynamic } from 'solid-js/web'
import { useBodyScrollLock } from '../../modal-utils/useBodyScrollLock'
import { useFocusTrap } from '../../modal-utils/useFocusTrap'
import { useDialogContext } from './context'

export interface IrisDialogContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Portal target; `false` renders in place. Default renders to body. */
  portalTarget?: HTMLElement | false
  children?: JSX.Element
}

/**
 * The modal surface (and its backdrop). Renders only while the dialog is open.
 * Behaviors: body scroll lock, focus trap, Escape to dismiss, backdrop click to dismiss.
 * Solid port of the Vue IrisDialogContent.
 */
export function IrisDialogContent(props: IrisDialogContentProps): JSX.Element {
  const ctx = useDialogContext('IrisDialogContent')
  const [local, others] = splitProps(props, ['portalTarget', 'style', 'children'])

  useBodyScrollLock(ctx.open)
  useFocusTrap({
    container: ctx.contentRef,
    active: ctx.open,
    returnFocusTo: ctx.triggerRef,
  })

  // Escape handler
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && ctx.closeOnEscape) {
      event.stopPropagation()
      ctx.setOpen(false)
    }
  }

  createEffect(() => {
    if (ctx.open()) {
      document.addEventListener('keydown', onKeyDown)
    } else {
      document.removeEventListener('keydown', onKeyDown)
    }
  })

  onCleanup(() => {
    document.removeEventListener('keydown', onKeyDown)
  })

  const onBackdropPointerDown = (event: MouseEvent): void => {
    if (!ctx.closeOnOutsideClick) return
    if (event.target === event.currentTarget) {
      ctx.setOpen(false)
    }
  }

  const onContentPointerDown = (event: MouseEvent): void => {
    event.stopPropagation()
  }

  const backdrop = (): JSX.Element => (
    <div
      data-iris-dialog-backdrop=""
      onPointerDown={onBackdropPointerDown}
      style={{
        position: 'fixed',
        inset: '0',
        background: 'rgba(0, 0, 0, 0.5)',
        'z-index': 1200,
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        padding: '24px',
      }}
    >
      <div
        {...(others as JSX.HTMLAttributes<HTMLDivElement>)}
        ref={ctx.setContentRef}
        id={ctx.contentId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ctx.hasTitle() ? ctx.titleId : undefined}
        aria-describedby={ctx.hasDescription() ? ctx.descriptionId : undefined}
        tabindex={-1}
        data-state="open"
        onPointerDown={onContentPointerDown}
        style={{
          background: 'var(--iris-surface)',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          'border-radius': 'var(--iris-radius-lg)',
          padding: 'var(--iris-padding-lg)',
          'box-shadow': '0 24px 48px -16px rgba(0,0,0,0.32), 0 8px 16px -4px rgba(0,0,0,0.16)',
          'max-width': '90vw',
          'max-height': '85vh',
          overflow: 'auto',
          outline: 'none',
          ...((local.style as JSX.CSSProperties) ?? {}),
        }}
      >
        {local.children}
      </div>
    </div>
  )

  return (
    <Show when={ctx.open()}>
      <Show when={local.portalTarget !== false} fallback={backdrop()}>
        <Portal mount={local.portalTarget instanceof HTMLElement ? local.portalTarget : undefined}>
          {backdrop()}
        </Portal>
      </Show>
    </Show>
  )
}

/**
 * Accessible title for the dialog.
 */
export function IrisDialogTitle(
  props: JSX.HTMLAttributes<HTMLHeadingElement> & { as?: string },
): JSX.Element {
  const ctx = useDialogContext('IrisDialogTitle')
  ctx.setHasTitle(true)

  const { as: tag = 'h2', style, ...rest } = props

  return (
    <Dynamic
      component={tag}
      {...rest}
      id={ctx.titleId}
      style={{
        margin: '0 0 var(--iris-gap-md) 0',
        'font-size': '18px',
        'font-weight': '600',
        ...((style as JSX.CSSProperties) ?? {}),
      }}
    />
  )
}

/**
 * Accessible description for the dialog.
 */
export function IrisDialogDescription(
  props: JSX.HTMLAttributes<HTMLParagraphElement> & { as?: string },
): JSX.Element {
  const ctx = useDialogContext('IrisDialogDescription')
  ctx.setHasDescription(true)

  const { as: tag = 'p', style, ...rest } = props

  return (
    <Dynamic
      component={tag}
      {...rest}
      id={ctx.descriptionId}
      style={{
        margin: '0 0 var(--iris-gap-lg) 0',
        color: 'var(--iris-muted)',
        'font-size': '14px',
        ...((style as JSX.CSSProperties) ?? {}),
      }}
    />
  )
}

/**
 * Close button for dialog.
 */
export function IrisDialogClose(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  const ctx = useDialogContext('IrisDialogClose')
  const { onClick, children, ...rest } = props

  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (typeof onClick === 'function') onClick(e)
    ctx.setOpen(false)
  }

  return (
    <button type="button" {...rest} onClick={handleClick}>
      {children}
    </button>
  )
}
