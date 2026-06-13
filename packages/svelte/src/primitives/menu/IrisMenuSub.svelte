<script lang="ts">
  /**
   * IrisMenuSub — nested submenu within a Menu. Renders a trigger item that
   * opens a sub-panel on hover/focus (right side by default).
   */
  import { generateId } from '@iris-ui/core'
  import { useFloating } from '../../floating/useFloating.svelte'
  import { portal } from '../../internal/portal'
  import { getMenuContext } from './context'

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

  const floating = useFloating({
    anchor: () => triggerEl,
    floating: () => contentEl,
    open: () => open,
    placement: 'right-start',
    offset: 0,
  })

  function setTrigger(node: HTMLElement): { destroy: () => void } {
    triggerEl = node
    return { destroy: () => { triggerEl = undefined } }
  }
  function setContent(node: HTMLElement): { destroy: () => void } {
    contentEl = node
    return { destroy: () => { contentEl = undefined } }
  }

  // Trigger keyboard: ArrowRight/Enter/Space open; ArrowLeft closes.
  function onTriggerKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
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
        contentEl?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([aria-disabled="true"])',
        ) ?? [],
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
      ctx.setOpen(false)
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
  aria-disabled={disabled ? 'true' : undefined}
  data-iris-menu-sub-trigger
  {...rest}
  use:setTrigger
  onpointerenter={() => { if (!disabled) open = true }}
  onpointerleave={() => { open = false }}
  onclick={() => { if (!disabled) open = !open }}
  onkeydown={onTriggerKeyDown}
  style="padding: var(--iris-padding-sm, 4px) var(--iris-padding-md, 8px); cursor: {disabled ? 'not-allowed' : 'pointer'}; border-radius: var(--iris-radius-sm, 3px); display: flex; align-items: center; justify-content: space-between; gap: 8px; color: {disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)'}; outline: none"
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
    onpointerenter={() => { open = true }}
    onpointerleave={() => { open = false }}
    onkeydown={onContentKeyDown}
    style="{floating.floatingStyles}; background: var(--iris-surface); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); padding: var(--iris-padding-sm, 4px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.16); min-width: 140px; z-index: 1001; outline: none"
  >
    {@render children?.()}
  </div>
{/if}
