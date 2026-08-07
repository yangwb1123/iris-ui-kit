import { createEffect, splitProps, Show, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { nextEnabledIndex, matchTypeahead } from '@iris-ui-kit/core'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { useDropdownContext } from './context'

export interface IrisDropdownMenuProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Portal target; `false` renders in place. Default `document.body`. */
  portalTarget?: HTMLElement | false
  children?: JSX.Element
}

/**
 * The menu surface (`role="menu"`). Positioned via `useFloating`, dismissed via
 * `useDismiss` (Escape + outside pointerdown), with ArrowUp/Down/Home/End nav
 * across `[role=menuitem]` children + Tab-to-close, and focus moved to the first
 * item on open. Solid port of the React/Vue dropdown menu.
 */
export function IrisDropdownMenu(props: IrisDropdownMenuProps): JSX.Element {
  const ctx = useDropdownContext('IrisDropdownMenu')
  const [local, others] = splitProps(props, ['portalTarget', 'style', 'onKeyDown', 'children'])

  const { floatingStyles } = useFloating({
    anchor: ctx.trigger,
    floating: ctx.content,
    open: ctx.open,
    placement: ctx.placement,
    offset: ctx.offset,
  })

  useDismiss({
    enabled: ctx.open,
    exclude: [ctx.trigger, ctx.content],
    onDismiss: () => ctx.setOpen(false),
  })

  // Typeahead buffer: accumulated printable chars, reset after a ~500ms pause.
  // Plain closure vars — no signal needed (not reactive state).
  let typeaheadBuffer = ''
  let typeaheadTimer: ReturnType<typeof setTimeout> | null = null

  // Focus first item on open; restore focus to the trigger on close.
  let wasOpen = false
  createEffect(() => {
    const open = ctx.open()
    if (open && !wasOpen) {
      queueMicrotask(() => {
        ctx.content()?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
      })
    } else if (!open && wasOpen) {
      ctx.trigger()?.focus?.()
    }
    wasOpen = open
  })

  const handleKeyDown = (e: KeyboardEvent & { currentTarget: HTMLDivElement }): void => {
    if (typeof local.onKeyDown === 'function') {
      ;(local.onKeyDown as (ev: typeof e) => void)(e)
    }
    const root = ctx.content()
    if (!root) return
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
    )
    if (items.length === 0) return
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
      case 'Home':
        e.preventDefault()
        items[0]?.focus()
        break
      case 'End':
        e.preventDefault()
        items[items.length - 1]?.focus()
        break
      case 'Tab':
        ctx.setOpen(false)
        break
      default: {
        // Typeahead: a single printable char jumps to (and repeated chars
        // cycle through) items whose label matches the accumulated buffer.
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          typeaheadBuffer += e.key
          if (typeaheadTimer) clearTimeout(typeaheadTimer)
          typeaheadTimer = setTimeout(() => {
            typeaheadBuffer = ''
          }, 500)
          const match = matchTypeahead(
            items.map((it) => it.textContent ?? ''),
            typeaheadBuffer,
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

  const menu = (): JSX.Element => (
    <div
      {...(others as JSX.HTMLAttributes<HTMLDivElement>)}
      ref={ctx.setContent}
      id={ctx.contentId}
      role="menu"
      tabindex={-1}
      data-iris-dropdown-menu=""
      data-state="open"
      onKeyDown={handleKeyDown}
      style={{
        ...floatingStyles(),
        background: 'var(--iris-surface)',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        'border-radius': 'var(--iris-radius-md, 6px)',
        padding: 'var(--iris-padding-sm, 4px)',
        'box-shadow': 'var(--iris-shadow-lg)',
        'min-width': '160px',
        outline: 'none',
        'z-index': 1000,
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.children}
    </div>
  )

  return (
    <Show when={ctx.open()}>
      <Show when={local.portalTarget !== false} fallback={menu()}>
        <Portal mount={local.portalTarget instanceof HTMLElement ? local.portalTarget : undefined}>
          {menu()}
        </Portal>
      </Show>
    </Show>
  )
}
