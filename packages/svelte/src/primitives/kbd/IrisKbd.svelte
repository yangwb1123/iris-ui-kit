<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'

  type KbdSize = 'sm' | 'md'

  const SIZE_MAP: Record<KbdSize, { fontSize: string; padding: string }> = {
    sm: { fontSize: '10px', padding: '2px 5px' },
    md: { fontSize: '12px', padding: '3px 6px' },
  }

  let {
    keys = [] as string | string[],
    separator = '+',
    size = 'md' as KbdSize,
    style,
    children,
    ...rest
  } = $props()

  const sz = $derived(SIZE_MAP[size as KbdSize] ?? SIZE_MAP.md)
  const keyList = $derived(
    typeof keys === 'string' ? (keys ? [keys] : []) : (keys as string[]),
  )

  const baseStyle = $derived(
    styleToString({
      display: 'inline-flex',
      'align-items': 'center',
      gap: '3px',
      'font-family': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      'font-size': sz.fontSize,
      'vertical-align': 'middle',
    }),
  )

  const keyStyle = $derived(
    styleToString({
      display: 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      padding: sz.padding,
      background: 'var(--iris-surface)',
      color: 'var(--iris-foreground)',
      border: '1px solid var(--iris-border)',
      'border-radius': '4px',
      'box-shadow': '0 1px 0 var(--iris-border)',
      'line-height': '1',
      'font-weight': '500',
    }),
  )
</script>

{#if children}
  <kbd
    {...rest}
    data-iris-kbd
    style={mergeStyle(baseStyle, style)}
  >
    {@render children()}
  </kbd>
{:else if keyList.length > 0}
  <span
    {...rest}
    data-iris-kbd
    data-iris-kbd-size={size}
    style={mergeStyle(baseStyle, style)}
  >
    {#each keyList as key, i (i)}
      <kbd data-iris-kbd-key style={keyStyle}>{key}</kbd>
      {#if i < keyList.length - 1}
        <span data-iris-kbd-separator aria-hidden="true" style="color: var(--iris-muted)">{separator}</span>
      {/if}
    {/each}
  </span>
{/if}
