<script lang="ts">
  import { getDropdownContext } from './context'
  import { styleToString, mergeStyle } from '../../internal/style'
  import type { IrisDropdownItemProps } from './types'

  let { disabled = false, keepOpen = false, onSelect, style, children, ...rest }: IrisDropdownItemProps =
    $props()
  const ctx = getDropdownContext('IrisDropdownItem')
  let hovered = $state(false)

  function fire(event: Event): void {
    if (disabled) return
    onSelect?.(event)
    if (!keepOpen) ctx.setOpen(false)
  }

  const itemStyle = $derived(
    styleToString({
      display: 'flex',
      'align-items': 'center',
      gap: 'var(--iris-gap-sm, 6px)',
      padding: '6px var(--iris-padding-md, 12px)',
      'border-radius': 'var(--iris-radius-sm, 4px)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      background: hovered && !disabled ? 'var(--iris-surface-hover)' : 'transparent',
      color: 'inherit',
      outline: 'none',
      'font-size': '14px',
      transition: 'background-color 80ms ease',
    }),
  )
</script>

<div
  {...rest}
  role="menuitem"
  tabindex={disabled ? -1 : 0}
  aria-disabled={disabled ? 'true' : undefined}
  data-iris-dropdown-item
  data-disabled={disabled ? '' : undefined}
  onclick={fire}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fire(e)
    }
  }}
  onpointerenter={() => (hovered = true)}
  onpointerleave={() => (hovered = false)}
  onfocus={() => (hovered = true)}
  onblur={() => (hovered = false)}
  style={mergeStyle(itemStyle, style)}
>
  {@render children?.()}
</div>
