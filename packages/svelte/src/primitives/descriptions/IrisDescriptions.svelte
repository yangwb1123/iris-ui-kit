<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'

  type DescriptionsLayout = 'horizontal' | 'vertical'

  interface DescriptionsItem {
    key?: string | number
    label: string | number
    value: string | number
  }

  let {
    items = [] as DescriptionsItem[],
    columns = 1,
    layout = 'horizontal' as DescriptionsLayout,
    bordered = false,
    style,
    ...rest
  } = $props()

  const isHorizontal = $derived(layout === 'horizontal')
  const pad = $derived(bordered ? '8px 12px' : undefined)

  const gridStyle = $derived(
    styleToString({
      display: 'grid',
      'grid-template-columns': isHorizontal
        ? `repeat(${columns}, max-content 1fr)`
        : `repeat(${columns}, 1fr)`,
      gap: bordered ? '0' : isHorizontal ? '8px 16px' : '12px',
      margin: '0',
      ...(bordered
        ? {
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            overflow: 'hidden',
          }
        : {}),
    }),
  )
</script>

<dl
  {...rest}
  data-iris-descriptions
  data-layout={layout}
  style={mergeStyle(gridStyle, style)}
>
  {#each items as item, i (item.key ?? i)}
    {#if isHorizontal}
      <dt
        data-iris-descriptions-label
        style={styleToString({
          margin: '0',
          'font-size': '13px',
          'font-weight': '500',
          color: 'var(--iris-muted)',
          padding: pad,
          ...(bordered ? { background: 'var(--iris-surface)' } : {}),
          ...(bordered && i >= columns
            ? {
                'border-block-start': '1px solid var(--iris-border)',
                'border-inline-end': '1px solid var(--iris-border)',
              }
            : bordered
              ? { 'border-inline-end': '1px solid var(--iris-border)' }
              : {}),
        })}
      >
        {String(item.label)}
      </dt>
      <dd
        data-iris-descriptions-value
        style={styleToString({
          margin: '0',
          'font-size': '14px',
          color: 'var(--iris-foreground)',
          padding: pad,
          ...(bordered && i >= columns
            ? { 'border-block-start': '1px solid var(--iris-border)' }
            : {}),
        })}
      >
        {String(item.value)}
      </dd>
    {:else}
      <div
        data-iris-descriptions-item
        style={styleToString({
          ...(bordered && i >= columns
            ? { 'border-block-start': '1px solid var(--iris-border)' }
            : {}),
          ...(bordered && i % columns !== 0
            ? { 'border-inline-start': '1px solid var(--iris-border)' }
            : {}),
        })}
      >
        <dt
          data-iris-descriptions-label
          style={styleToString({
            margin: '0',
            'font-size': '13px',
            'font-weight': '500',
            color: 'var(--iris-muted)',
            padding: pad,
            ...(bordered ? { background: 'var(--iris-surface)' } : {}),
          })}
        >
          {String(item.label)}
        </dt>
        <dd
          data-iris-descriptions-value
          style={styleToString({
            margin: '0',
            'font-size': '14px',
            color: 'var(--iris-foreground)',
            padding: pad,
          })}
        >
          {String(item.value)}
        </dd>
      </div>
    {/if}
  {/each}
</dl>
