<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'

  interface ListItem<T = unknown> {
    value: T
    label?: string
    disabled?: boolean
  }

  let {
    items = [] as ListItem[],
    value: modelValue = undefined as unknown,
    multi = false,
    ariaLabel = undefined as string | undefined,
    style,
    children,
    ...rest
  } = $props()

  // svelte-ignore state_referenced_locally
  let activeIndex = $state(0)

  const isSelected = (val: unknown): boolean => {
    if (multi) {
      return Array.isArray(modelValue) && (modelValue as unknown[]).includes(val)
    }
    return modelValue === val
  }

  function handleClick(item: ListItem, index: number) {
    if (item.disabled) return
    activeIndex = index
  }

  const listStyle = $derived(
    styleToString({
      'list-style': 'none',
      margin: '0',
      padding: 'var(--iris-padding-sm)',
      display: 'flex',
      'flex-direction': 'column',
      gap: '2px',
      outline: 'none',
    }),
  )
</script>

<ul
  {...rest}
  role="listbox"
  aria-label={ariaLabel}
  aria-multiselectable={multi ? 'true' : undefined}
  data-iris-list
  style={mergeStyle(listStyle, style)}
>
  {#if items.length === 0}
    <li
      role="presentation"
      data-iris-list-state="empty"
      aria-live="polite"
      style="list-style: none; padding: 12px; text-align: center; color: var(--iris-muted); font-size: 14px"
    >
      {#if children}
        {@render children()}
      {:else}
        No items
      {/if}
    </li>
  {:else}
    {#each items as item, index (String(item.value ?? index))}
      {@const selected = isSelected(item.value)}
      {@const active = index === activeIndex}
      <li
        role="option"
        tabindex={active ? 0 : -1}
        aria-selected={selected ? 'true' : 'false'}
        aria-disabled={item.disabled ? 'true' : undefined}
        data-iris-list-index={index}
        data-iris-list-item
        data-state={selected ? 'selected' : active ? 'active' : 'idle'}
        onclick={() => handleClick(item, index)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(item, index) } }}
        style={styleToString({
          display: 'flex',
          'align-items': 'center',
          gap: 'var(--iris-gap-sm)',
          padding: '6px var(--iris-padding-md)',
          'border-radius': 'var(--iris-radius-sm)',
          cursor: item.disabled ? 'not-allowed' : 'pointer',
          opacity: item.disabled ? '0.5' : '1',
          'font-size': '14px',
          background: selected
            ? 'var(--iris-primary)'
            : active
              ? 'var(--iris-surface-hover)'
              : 'transparent',
          color: selected ? 'var(--iris-primary-foreground)' : 'var(--iris-foreground)',
          outline: 'none',
        })}
      >
        {item.label ?? String(item.value)}
      </li>
    {/each}
  {/if}
</ul>
