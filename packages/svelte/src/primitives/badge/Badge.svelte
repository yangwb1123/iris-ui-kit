<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'
  import type { IrisBadgeProps, IrisBadgeVariant, IrisBadgeTone, IrisBadgeSize } from './types'

  const TONE_TO_VAR: Record<IrisBadgeTone, string> = {
    primary: '--iris-primary',
    success: '--iris-success',
    warning: '--iris-warning',
    danger: '--iris-danger',
    neutral: '--iris-muted',
  }

  function badgeStyle(variant: IrisBadgeVariant, tone: IrisBadgeTone, size: IrisBadgeSize): string {
    const v = `var(${TONE_TO_VAR[tone]})`
    const base: Record<string, string | number> = {
      display: 'inline-flex',
      'align-items': 'center',
      gap: '4px',
      'border-radius': 'var(--iris-radius-sm, 4px)',
      'font-family': 'var(--iris-font-family, inherit)',
      'font-weight': 500,
      'line-height': 1,
      'white-space': 'nowrap',
      'font-size': size === 'sm' ? '11px' : '12px',
      padding: size === 'sm' ? '2px 6px' : '3px 8px',
    }
    if (variant === 'solid')
      return styleToString({
        ...base,
        background: v,
        color: 'var(--iris-primary-foreground, #fff)',
        border: '1px solid transparent',
      })
    if (variant === 'outline')
      return styleToString({ ...base, background: 'transparent', color: v, border: `1px solid ${v}` })
    return styleToString({
      ...base,
      background: `color-mix(in srgb, ${v} 12%, transparent)`,
      color: v,
      border: '1px solid transparent',
    })
  }

  let { variant = 'subtle', tone = 'primary', size = 'md', style, children, ...rest }: IrisBadgeProps =
    $props()
  const base = $derived(badgeStyle(variant, tone, size))
</script>

<span
  {...rest}
  data-iris-badge
  data-iris-badge-variant={variant}
  data-iris-badge-tone={tone}
  data-iris-badge-size={size}
  style={mergeStyle(base, style)}
>
  {@render children?.()}
</span>
