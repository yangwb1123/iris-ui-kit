<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'

  type CardVariant = 'elevated' | 'outline' | 'subtle'
  type CardPadding = 'none' | 'sm' | 'md' | 'lg'

  const PADDING_MAP: Record<CardPadding, string> = {
    none: '0',
    sm: '12px',
    md: 'var(--iris-padding-lg, 20px)',
    lg: 'var(--iris-space-xl, 24px)',
  }

  let {
    variant = 'elevated' as CardVariant,
    padding = 'md' as CardPadding,
    hover = false,
    style,
    children,
    header,
    footer,
    ...rest
  } = $props()

  const containerStyle = $derived(() => {
    const base = {
      display: 'flex',
      'flex-direction': 'column',
      background: 'var(--iris-background)',
      color: 'var(--iris-foreground)',
      'border-radius': 'var(--iris-radius-md, 8px)',
      overflow: 'hidden',
      transition: hover ? 'transform 160ms ease, box-shadow 160ms ease' : 'none',
    }
    const v = variant as CardVariant
    if (v === 'elevated') return { ...base, 'box-shadow': 'var(--iris-shadow-md)' }
    if (v === 'outline') return { ...base, border: '1px solid var(--iris-border)' }
    // subtle
    return { ...base, background: 'var(--iris-surface)' }
  })

  const sectionPadding = $derived(PADDING_MAP[padding as CardPadding] ?? PADDING_MAP.md)
</script>

<div
  {...rest}
  data-iris-card
  data-iris-card-variant={variant}
  data-iris-card-padding={padding}
  data-iris-card-hover={hover ? 'true' : undefined}
  style={mergeStyle(styleToString(containerStyle()), style)}
>
  {#if header}
    <div
      data-iris-card-header
      style="padding: {sectionPadding}; border-bottom: 1px solid var(--iris-border); font-weight: 600"
    >
      {@render header()}
    </div>
  {/if}
  {#if children}
    <div data-iris-card-body style="padding: {sectionPadding}; flex: 1">
      {@render children()}
    </div>
  {/if}
  {#if footer}
    <div
      data-iris-card-footer
      style="padding: {sectionPadding}; border-top: 1px solid var(--iris-border)"
    >
      {@render footer()}
    </div>
  {/if}
</div>

<style>
  [data-iris-card-hover='true']:hover {
    transform: translateY(-2px);
    box-shadow: var(--iris-shadow-lg);
  }
</style>
