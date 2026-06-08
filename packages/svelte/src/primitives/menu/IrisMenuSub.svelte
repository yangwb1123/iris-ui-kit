<script lang="ts">
  /**
   * IrisMenuSub — nested submenu within a Menu. Renders a trigger item that
   * opens a sub-panel on hover/focus (right side by default).
   */
  import { generateId } from '@iris-ui/core'
  import { useFloating } from '../../floating/useFloating.svelte'
  import { portal } from '../../internal/portal'

  interface Props {
    label: string
    disabled?: boolean
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { label, disabled = false, children, ...rest }: Props = $props()

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
  onfocus={() => { if (!disabled) open = true }}
  onblur={(e) => { if (!contentEl?.contains(e.relatedTarget as Node)) open = false }}
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
    style="{floating.floatingStyles}; background: var(--iris-surface); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); padding: var(--iris-padding-sm, 4px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.16); min-width: 140px; z-index: 1001; outline: none"
  >
    {@render children?.()}
  </div>
{/if}
