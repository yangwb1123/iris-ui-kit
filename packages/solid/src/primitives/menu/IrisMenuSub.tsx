import { createEffect, createSignal, createUniqueId, onCleanup, Show, type JSX } from 'solid-js'
import { nextEnabledIndex } from '@iris-ui-kit/core'
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
      case 'ArrowLeft':
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        trigger()?.focus()
        break
      case 'Tab':
        ctx.closeRoot()
        break
    }
  }

  // Hover open is debounced ~100ms and pointer-leave does NOT close (it only
  // cancels a pending open) — the submenu stays open until ArrowLeft / Escape /
  // select / outside-dismiss. Matches the React/Vue reference hover model.
  const HOVER_OPEN_DELAY = 100
  let openTimer: ReturnType<typeof setTimeout> | null = null
  const clearTimer = (): void => {
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = null
    }
  }
  const scheduleOpen = (): void => {
    if (props.disabled) return
    clearTimer()
    openTimer = setTimeout(() => {
      setOpen(true)
      openTimer = null
    }, HOVER_OPEN_DELAY)
  }
  onCleanup(clearTimer)

  // Close sub when root closes
  createEffect(() => {
    if (!ctx.open()) setOpen(false)
  })

  // Focus first item on open; restore focus to this submenu's trigger on close.
  let wasOpen = false
  createEffect(() => {
    const isOpen = open()
    if (isOpen && !wasOpen) {
      queueMicrotask(() => {
        submenu()
          ?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
          ?.focus()
      })
    } else if (!isOpen && wasOpen) {
      trigger()?.focus?.()
    }
    wasOpen = isOpen
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
        onPointerEnter={scheduleOpen}
        onPointerLeave={clearTimer}
        onClick={() => {
          clearTimer()
          if (!props.disabled) setOpen((v) => !v)
        }}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            clearTimer()
            if (!props.disabled) setOpen(true)
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            setOpen(false)
          }
        }}
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
          'font-size': 'var(--iris-font-size-md, 14px)',
          'border-radius': 'var(--iris-radius-sm, 4px)',
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          color: props.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
          outline: 'none',
        }}
      >
        <span>{props.label}</span>
        <span
          aria-hidden="true"
          style={{ 'font-size': 'var(--iris-font-size-xs, 12px)', opacity: '0.7' }}
        >
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
          onPointerEnter={clearTimer}
          onKeyDown={handleKeyDown}
          style={{
            ...floatingStyles(),
            background: 'var(--iris-surface)',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            padding: 'var(--iris-padding-sm, 4px)',
            'box-shadow': 'var(--iris-shadow-lg)',
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
