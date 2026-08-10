<script lang="ts">
  /**
   * IrisMenuSub — nested submenu within a Menu. Renders a trigger item that
   * opens a sub-panel on hover/focus (right side by default).
   */
  import { generateId } from '@iris-ui-kit/core'
  import { useFloating } from '../../floating/useFloating.svelte'
  import { useDismiss } from '../../floating/useDismiss.svelte'
  import { portal } from '../../internal/portal'
  import { getMenuContext, setMenuContext } from './context'

  interface Props {
    label: string
    disabled?: boolean
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { label, disabled = false, children, ...rest }: Props = $props()

  // The root menu context — closing it collapses the whole tree (Tab behavior).
  const ctx = getMenuContext('IrisMenuSub')

  let open = $state(false)
  let triggerEl = $state<HTMLElement | undefined>(undefined)
  let contentEl = $state<HTMLElement | undefined>(undefined)
  const subId = generateId()

  // Provide a NESTED menu context so descendant items / deeper IrisMenuSubs use
  // THIS submenu's open state (not the root's), while `closeRoot` still points
  // at the root menu — so any leaf, however deep, collapses the whole tree.
  setMenuContext({
    get open() {
      return open
    },
    setOpen: (next: boolean) => {
      open = next
    },
    get trigger() {
      return triggerEl
    },
    setTrigger: (el) => {
      triggerEl = el
    },
    get content() {
      return contentEl
    },
    setContent: (el) => {
      contentEl = el
    },
    contentId: subId,
    placement: 'right-start',
    offset: 0,
    closeRoot: ctx.closeRoot,
  })

  const floating = useFloating({
    anchor: () => triggerEl,
    floating: () => contentEl,
    open: () => open,
    placement: 'right-start',
    offset: 0,
  })

  // Outside-pointer-down closes this submenu (Escape is handled by the content
  // keydown). With this in place, pointer-LEAVE no longer needs to close — the
  // submenu stays open until ArrowLeft / Escape / select / outside-click,
  // matching the React/Vue reference hover model.
  useDismiss({
    enabled: () => open,
    exclude: [() => triggerEl, () => contentEl],
    onDismiss: () => {
      open = false
    },
    escape: false,
  })

  // Hover open is debounced ~100ms; pointer-leave only cancels a pending open.
  const HOVER_OPEN_DELAY = 100
  let openTimer: ReturnType<typeof setTimeout> | null = null
  function clearTimer(): void {
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = null
    }
  }
  function scheduleOpen(): void {
    if (disabled) return
    clearTimer()
    openTimer = setTimeout(() => {
      open = true
      openTimer = null
    }, HOVER_OPEN_DELAY)
  }

  function setTrigger(node: HTMLElement): { destroy: () => void } {
    triggerEl = node
    return {
      destroy: () => {
        triggerEl = undefined
      },
    }
  }
  function setContent(node: HTMLElement): { destroy: () => void } {
    contentEl = node
    return {
      destroy: () => {
        contentEl = undefined
      },
    }
  }

  // Trigger keyboard: ArrowRight/Enter/Space open; ArrowLeft closes.
  function onTriggerKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      clearTimer()
      if (!disabled) open = true
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      open = false
    }
  }

  // Content keyboard: Arrow up/down roving nav; ArrowLeft/Escape close +
  // return focus to the trigger; Tab collapses the whole menu tree.
  function onContentKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const items = Array.from(
        contentEl?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ??
          [],
      )
      if (items.length === 0) return
      const index = items.indexOf(document.activeElement as HTMLElement)
      const next =
        e.key === 'ArrowDown'
          ? index < 0
            ? 0
            : (index + 1) % items.length
          : index <= 0
            ? items.length - 1
            : index - 1
      items[next]?.focus()
    } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      open = false
      triggerEl?.focus()
    } else if (e.key === 'Tab') {
      ctx.closeRoot()
    }
  }

  // Focus the first item on open; restore focus to the trigger on close.
  let wasOpen = false
  $effect(() => {
    const isOpen = open
    if (isOpen && !wasOpen) {
      queueMicrotask(() => {
        contentEl
          ?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
          ?.focus()
      })
    } else if (!isOpen && wasOpen) {
      triggerEl?.focus()
    }
    wasOpen = isOpen
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  role="menuitem"
  tabindex={disabled ? -1 : 0}
  aria-haspopup="menu"
  aria-expanded={open}
  aria-controls={subId}
  aria-disabled={disabled ? 'true' : undefined}
  data-iris-menu-sub-trigger
  {...rest}
  use:setTrigger
  onpointerenter={scheduleOpen}
  onpointerleave={clearTimer}
  onclick={() => {
    clearTimer()
    if (!disabled) open = !open
  }}
  onkeydown={onTriggerKeyDown}
  style="padding: var(--iris-padding-sm, 4px) var(--iris-padding-md, 8px); cursor: {disabled
    ? 'not-allowed'
    : 'pointer'}; border-radius: var(--iris-radius-sm, 3px); display: flex; align-items: center; justify-content: space-between; gap: 8px; color: {disabled
    ? 'var(--iris-muted)'
    : 'var(--iris-foreground)'}; outline: none"
>
  {label}
  <span aria-hidden="true">▶</span>
</div>

{#if open}
  <div
    use:setContent
    use:portal
    id={subId}
    role="menu"
    tabindex={-1}
    data-iris-menu-sub-content
    onpointerenter={clearTimer}
    onkeydown={onContentKeyDown}
    style="{floating.floatingStyles}; background: var(--iris-surface-floating); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); padding: var(--iris-padding-sm, 4px); box-shadow: var(--iris-shadow-lg); min-width: 140px; z-index: 1001; outline: none"
  >
    {@render children?.()}
  </div>
{/if}
