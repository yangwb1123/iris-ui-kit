<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'

  type Orientation = 'horizontal' | 'vertical'
  type Spacing = 'sm' | 'md' | 'lg'

  const SPACING_MAP: Record<Spacing, string> = {
    sm: '8px',
    md: '16px',
    lg: '24px',
  }

  let {
    orientation = 'horizontal' as Orientation,
    label = '',
    spacing = 'md' as Spacing,
    style,
    children,
    ...rest
  } = $props()

  const sp = $derived(SPACING_MAP[spacing as Spacing] ?? '16px')
  const hasLabel = $derived(Boolean(label || children))
</script>

{#if orientation === 'horizontal' && !hasLabel}
  <hr
    {...rest}
    data-iris-divider
    data-iris-divider-orientation="horizontal"
    style={mergeStyle(
      styleToString({
        border: 'none',
        'border-top': '1px solid var(--iris-border)',
        margin: `${sp} 0`,
        width: '100%',
      }),
      style,
    )}
  />
{:else if orientation === 'vertical'}
  <div
    {...rest}
    role="separator"
    aria-orientation="vertical"
    data-iris-divider
    data-iris-divider-orientation="vertical"
    style={mergeStyle(
      styleToString({
        display: 'inline-block',
        width: '1px',
        'align-self': 'stretch',
        background: 'var(--iris-border)',
        margin: `0 ${sp}`,
      }),
      style,
    )}
  ></div>
{:else}
  <!-- horizontal + label -->
  <div
    {...rest}
    role="separator"
    aria-orientation="horizontal"
    data-iris-divider
    data-iris-divider-orientation="horizontal"
    data-iris-divider-has-label="true"
    style={mergeStyle(
      styleToString({
        display: 'flex',
        'align-items': 'center',
        gap: '8px',
        margin: `${sp} 0`,
        color: 'var(--iris-muted)',
        'font-size': 'var(--iris-font-size-xs, 12px)',
        'text-transform': 'uppercase',
        'letter-spacing': '0.04em',
      }),
      style,
    )}
  >
    <span
      data-iris-divider-line="before"
      style="flex: 1; height: 1px; background: var(--iris-border)"
    ></span>
    <span data-iris-divider-label>
      {#if children}
        {@render children()}
      {:else}
        {label}
      {/if}
    </span>
    <span
      data-iris-divider-line="after"
      style="flex: 1; height: 1px; background: var(--iris-border)"
    ></span>
  </div>
{/if}
