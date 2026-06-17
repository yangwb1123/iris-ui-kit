<script lang="ts">
  import { getMenuContext } from './context'

  interface Props {
    disabled?: boolean
    onclick?: (e: MouseEvent) => void
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { disabled = false, onclick, children, ...rest }: Props = $props()
  const ctx = getMenuContext('IrisMenuItem')

  function handleClick(e: MouseEvent): void {
    if (disabled) return
    onclick?.(e)
    // Close the whole tree — a leaf inside a submenu collapses everything
    // (matches React/Solid). At the root, closeRoot === setOpen(false).
    ctx.closeRoot()
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
      e.preventDefault()
      handleClick(e as unknown as MouseEvent)
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
