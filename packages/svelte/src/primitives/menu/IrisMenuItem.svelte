<script lang="ts">
  import { getMenuContext } from './context'

  interface Props {
    disabled?: boolean
    closeOnSelect?: boolean
    onclick?: (e: MouseEvent) => void
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { disabled = false, closeOnSelect = true, onclick, children, ...rest }: Props = $props()
  const ctx = getMenuContext('IrisMenuItem')

  function select(e: MouseEvent | KeyboardEvent, suppressNativeDefault = false): void {
    if (disabled) {
      if (suppressNativeDefault) e.preventDefault()
      return
    }
    onclick?.(e as MouseEvent)
    const selectionCanceled = e.defaultPrevented
    if (suppressNativeDefault) e.preventDefault()
    // Close the whole tree — a leaf inside a submenu collapses everything
    // (matches React/Solid), unless selection is canceled or opted out. At the
    // root, closeRoot === setOpen(false).
    if (closeOnSelect && !selectionCanceled) ctx.closeRoot()
  }

  function handleClick(e: MouseEvent): void {
    select(e)
  }
</script>

<div
  role="menuitem"
  tabindex={disabled ? -1 : 0}
  aria-disabled={disabled ? 'true' : undefined}
  data-iris-menu-item
  data-disabled={disabled ? '' : undefined}
  {...rest}
  onclick={handleClick}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      select(e, true)
    }
  }}
  style="padding: var(--iris-padding-sm, 4px) var(--iris-padding-md, 8px); cursor: {disabled
    ? 'not-allowed'
    : 'pointer'}; border-radius: var(--iris-radius-sm, 3px); color: {disabled
    ? 'var(--iris-muted)'
    : 'var(--iris-foreground)'}; outline: none; {(rest.style as string) ?? ''}"
>
  {@render children?.()}
</div>
