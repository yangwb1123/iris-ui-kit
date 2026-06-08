import { createEffect, createSignal, createUniqueId, Show, type JSX } from 'solid-js'
import { nextEnabledIndex } from '@iris-ui/core'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { useMenuContext } from './context'

export interface IrisMenuSubProps {
  label: string
  disabled?: boolean
  children?: JSX.Element
}

/**
 * Nested sub-menu. Renders a menuitem that expands a floating submenu on hover/click.
 * Solid port of the Vue IrisMenuSub.
 */
export function IrisMenuSub(props: IrisMenuSubProps): JSX.Element {
  const ctx = useMenuContext('IrisMenuSub')
  const [open, setOpen] = createSignal(false)
  const [trigger, setTrigger] = createSignal<HTMLElement | undefined>()
  const [submenu, setSubmenu] = createSignal<HTMLElement | undefined>()
  const submenuId = createUniqueId()

  const { floatingStyles } = useFloating({
    anchor: trigger,
    floating: submenu,
    open,
    placement: 'right-start',
    offset: 4,
  })

  useDismiss({
    enabled: open,
    exclude: [trigger, submenu],
    onDismiss: () => setOpen(false),
    escape: false, // outer menu handles escape
  })

  const handleKeyDown = (e: KeyboardEvent): void => {
    const root = submenu()
    if (!root) return
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
    )
    const index = items.indexOf(document.activeElement as HTMLElement)
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        items[nextEnabledIndex(index, 1, items.length)]?.focus()
        break
      case 'ArrowUp':
        e.preventDefault()
        items[nextEnabledIndex(index, -1, items.length)]?.focus()
        break
      case 'Escape':
        setOpen(false)
        trigger()?.focus()
        break
    }
  }

  // Close sub when root closes
  createEffect(() => {
    if (!ctx.open()) setOpen(false)
  })

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={setTrigger}
        role="menuitem"
        tabindex={props.disabled ? -1 : 0}
        aria-haspopup="menu"
        aria-expanded={open()}
        aria-controls={submenuId}
        aria-disabled={props.disabled ? 'true' : undefined}
        data-iris-menu-sub-trigger=""
        onPointerEnter={() => !props.disabled && setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onClick={() => !props.disabled && setOpen((v) => !v)}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!props.disabled) setOpen(true)
          }
        }}
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: '6px 12px',
          'font-size': '14px',
          'border-radius': 'var(--iris-radius-sm, 4px)',
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          color: props.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
          outline: 'none',
        }}
      >
        <span>{props.label}</span>
        <span aria-hidden="true" style={{ 'font-size': '10px', opacity: '0.7' }}>
          ▶
        </span>
      </div>
      <Show when={open()}>
        <div
          ref={setSubmenu}
          id={submenuId}
          role="menu"
          tabindex={-1}
          data-iris-menu-sub-content=""
          data-state="open"
          onPointerEnter={() => setOpen(true)}
          onPointerLeave={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          style={{
            ...floatingStyles(),
            background: 'var(--iris-surface)',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            padding: 'var(--iris-padding-sm, 4px)',
            'box-shadow': '0 8px 24px -8px rgba(0,0,0,0.16)',
            'min-width': '140px',
            outline: 'none',
            'z-index': 1001,
          }}
        >
          {props.children}
        </div>
      </Show>
    </div>
  )
}
