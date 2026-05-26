import * as React from 'react'

export type IrisChipVariant = 'solid' | 'outline' | 'subtle'
export type IrisChipTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
export type IrisChipSize = 'sm' | 'md'

const TONE_TO_VAR: Record<IrisChipTone, string> = {
  primary: '--iris-primary',
  success: '--iris-success',
  warning: '--iris-warning',
  danger: '--iris-danger',
  neutral: '--iris-muted',
}

function chipStyle(
  variant: IrisChipVariant,
  tone: IrisChipTone,
  size: IrisChipSize,
  clickable: boolean,
  disabled: boolean,
): React.CSSProperties {
  const v = `var(${TONE_TO_VAR[tone]})`
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9999,
    fontFamily: 'var(--iris-font-family, inherit)',
    fontWeight: 500,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : clickable ? 'pointer' : 'default',
    opacity: disabled ? 0.6 : 1,
    transition: 'background-color 120ms ease, box-shadow 120ms ease',
    fontSize: size === 'sm' ? 11 : 12,
    padding: size === 'sm' ? '3px 8px' : '4px 10px',
    userSelect: 'none',
  }
  switch (variant) {
    case 'solid':
      return { ...base, background: v, color: 'var(--iris-primary-foreground, #fff)', border: '1px solid transparent' }
    case 'outline':
      return { ...base, background: 'transparent', color: v, border: `1px solid ${v}` }
    case 'subtle':
      return {
        ...base,
        background: `color-mix(in srgb, ${v} 14%, transparent)`,
        color: v,
        border: '1px solid transparent',
      }
  }
}

export interface IrisChipProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick' | 'children'> {
  variant?: IrisChipVariant
  tone?: IrisChipTone
  size?: IrisChipSize
  closable?: boolean
  clickable?: boolean
  disabled?: boolean
  onClose?: () => void
  onClick?: (event: React.MouseEvent<HTMLElement>) => void
  icon?: React.ReactNode
  children?: React.ReactNode
}

/** React port of {@link import('@iris-ui/vue').IrisChip}. */
export function IrisChip({
  variant = 'subtle',
  tone = 'neutral',
  size = 'md',
  closable = false,
  clickable = false,
  disabled = false,
  onClose,
  onClick,
  icon,
  children,
  style,
  ...rest
}: IrisChipProps): React.ReactElement {
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (disabled) return
    onClick?.(event)
  }
  const handleCloseClick = (event: React.MouseEvent) => {
    if (disabled) return
    event.stopPropagation()
    onClose?.()
  }

  const sharedProps = {
    ...rest,
    'data-iris-chip': '',
    'data-iris-chip-variant': variant,
    'data-iris-chip-tone': tone,
    'data-iris-chip-size': size,
    style: { ...chipStyle(variant, tone, size, clickable, disabled), ...style },
  }

  const content = (
    <>
      {icon ? (
        <span
          data-iris-chip-icon=""
          style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
        >
          {icon}
        </span>
      ) : null}
      <span data-iris-chip-label="">{children}</span>
      {closable ? (
        <button
          type="button"
          data-iris-chip-close=""
          aria-label="Remove"
          disabled={disabled}
          onClick={handleCloseClick}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: 'inherit',
            padding: 0,
            marginLeft: 2,
            fontSize: 12,
            lineHeight: 1,
            flexShrink: 0,
            opacity: 0.7,
          }}
        >
          ✕
        </button>
      ) : null}
    </>
  )

  if (clickable) {
    return (
      <button type="button" {...sharedProps} disabled={disabled} onClick={handleClick}>
        {content}
      </button>
    )
  }
  return <span {...sharedProps}>{content}</span>
}
