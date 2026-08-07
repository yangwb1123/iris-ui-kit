import { mergeProps, splitProps, type JSX } from 'solid-js'

export type IrisBadgeVariant = 'solid' | 'outline' | 'subtle'
export type IrisBadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
export type IrisBadgeSize = 'sm' | 'md'

const TONE_TO_VAR: Record<IrisBadgeTone, string> = {
  primary: '--iris-primary',
  success: '--iris-success',
  warning: '--iris-warning',
  danger: '--iris-danger',
  neutral: '--iris-muted',
}

/**
 * Internal style resolver. Exported for unit tests (NOT in the package barrel)
 * so the source-order cascade — static subtle fallback BEFORE the color-mix
 * shorthand — can be asserted without CSSOM folding collapsing the longhand.
 */
export function badgeStyle(
  variant: IrisBadgeVariant,
  tone: IrisBadgeTone,
  size: IrisBadgeSize,
): JSX.CSSProperties {
  const v = `var(${TONE_TO_VAR[tone]})`
  const base: JSX.CSSProperties = {
    display: 'inline-flex',
    'align-items': 'center',
    gap: '4px',
    'border-radius': 'var(--iris-radius-sm, 4px)',
    'font-family': 'var(--iris-font-family, inherit)',
    'font-weight': 500,
    'line-height': 1,
    'white-space': 'nowrap',
    'font-size': 'var(--iris-font-size-xs, 12px)',
    padding: size === 'sm' ? '2px 6px' : '3px 8px',
  }
  if (variant === 'solid')
    return {
      ...base,
      background: v,
      color:
        tone === 'warning'
          ? 'var(--iris-warning-foreground, #451a03)'
          : tone === 'primary'
            ? 'var(--iris-primary-foreground, #fff)'
            : 'var(--iris-foreground, #0f172a)',
      border: '1px solid transparent',
    }
  if (variant === 'outline')
    return { ...base, background: 'transparent', color: v, border: `1px solid ${v}` }
  return {
    ...base,
    // Precomputed fallback first; color-mix shorthand overrides on modern engines.
    'background-color': `var(${TONE_TO_VAR[tone]}-subtle)`,
    background: `color-mix(in srgb, ${v} 12%, transparent)`,
    color: v,
    border: '1px solid transparent',
  }
}

export interface IrisBadgeProps extends Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'children'> {
  variant?: IrisBadgeVariant
  tone?: IrisBadgeTone
  size?: IrisBadgeSize
  children?: JSX.Element
}

/** Solid port of the React/Vue IrisBadge. Same visual model. */
export function IrisBadge(props: IrisBadgeProps): JSX.Element {
  const merged = mergeProps(
    {
      variant: 'subtle' as IrisBadgeVariant,
      tone: 'primary' as IrisBadgeTone,
      size: 'md' as IrisBadgeSize,
    },
    props,
  )
  const [local, others] = splitProps(merged, ['variant', 'tone', 'size', 'style', 'children'])
  return (
    <span
      {...others}
      data-iris-badge=""
      data-iris-badge-variant={local.variant}
      data-iris-badge-tone={local.tone}
      data-iris-badge-size={local.size}
      style={{
        ...badgeStyle(local.variant, local.tone, local.size),
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.children}
    </span>
  )
}
