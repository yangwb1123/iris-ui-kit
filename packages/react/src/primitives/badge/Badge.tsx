import * as React from 'react'

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

function badgeStyle(
  variant: IrisBadgeVariant,
  tone: IrisBadgeTone,
  size: IrisBadgeSize,
): React.CSSProperties {
  const v = `var(${TONE_TO_VAR[tone]})`
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    borderRadius: 'var(--iris-radius-sm, 4px)',
    fontFamily: 'var(--iris-font-family, inherit)',
    fontWeight: 500,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    fontSize: size === 'sm' ? 'var(--iris-font-size-xs, 12px)' : '12px',
    padding: size === 'sm' ? '2px 6px' : '3px 8px',
  }
  switch (variant) {
    case 'solid':
      return {
        ...base,
        background: v,
        color:
          tone === 'warning'
            ? 'var(--iris-warning-foreground, #451a03)'
            : tone === 'primary'
              ? 'var(--iris-primary-foreground, #fff)'
              : tone === 'success'
                ? 'var(--iris-success-foreground, #0f172a)'
                : tone === 'danger'
                  ? 'var(--iris-danger-foreground, #0f172a)'
                  : 'var(--iris-foreground, #0f172a)',
        border: '1px solid transparent',
      }
    case 'outline':
      return { ...base, background: 'transparent', color: v, border: `1px solid ${v}` }
    case 'subtle':
      return {
        ...base,
        // Precomputed fallback first; color-mix shorthand overrides on modern engines.
        backgroundColor: `var(${TONE_TO_VAR[tone]}-subtle)`,
        background: `color-mix(in srgb, ${v} 12%, transparent)`,
        color: v,
        border: '1px solid transparent',
      }
  }
}

export interface IrisBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  variant?: IrisBadgeVariant
  tone?: IrisBadgeTone
  size?: IrisBadgeSize
  children?: React.ReactNode
}

/**
 * React port of {@link import('@iris-ui-kit/vue').IrisBadge}. Same visual model.
 *
 * @example
 *   <IrisBadge tone="success" variant="subtle">Active</IrisBadge>
 */
export function IrisBadge({
  variant = 'subtle',
  tone = 'primary',
  size = 'md',
  style,
  children,
  ...rest
}: IrisBadgeProps): React.ReactElement {
  return (
    <span
      {...rest}
      data-iris-badge=""
      data-iris-badge-variant={variant}
      data-iris-badge-tone={tone}
      data-iris-badge-size={size}
      style={{ ...badgeStyle(variant, tone, size), ...style }}
    >
      {children}
    </span>
  )
}
