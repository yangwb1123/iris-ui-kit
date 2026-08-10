import { mergeProps, splitProps, type JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { useI18n } from '../../i18n'

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
): JSX.CSSProperties {
  const v = `var(${TONE_TO_VAR[tone]})`
  const base: JSX.CSSProperties = {
    display: 'inline-flex',
    'align-items': 'center',
    gap: 'var(--iris-space-xs, 8px)',
    'border-radius': '9999px',
    'font-family': 'var(--iris-font-family, inherit)',
    'font-weight': '500',
    'line-height': '1',
    'white-space': 'nowrap',
    cursor: disabled ? 'not-allowed' : clickable ? 'pointer' : 'default',
    opacity: disabled ? 0.6 : 1,
    transition: 'background-color 120ms ease, box-shadow 120ms ease',
    'font-size': 'var(--iris-font-size-xs, 12px)',
    padding: size === 'sm' ? '3px 8px' : '4px 10px',
    'user-select': 'none',
  }
  switch (variant) {
    case 'solid':
      return {
        ...base,
        background: v,
        color: 'var(--iris-primary-foreground, #fff)',
        border: '1px solid transparent',
      }
    case 'outline':
      return { ...base, background: 'transparent', color: v, border: `1px solid ${v}` }
    case 'subtle':
    default:
      return {
        ...base,
        // Precomputed fallback first; color-mix shorthand overrides on modern engines.
        'background-color': `var(${TONE_TO_VAR[tone]}-subtle)`,
        background: `color-mix(in srgb, ${v} 14%, transparent)`,
        color: v,
        border: '1px solid transparent',
      }
  }
}

export interface IrisChipProps {
  variant?: IrisChipVariant
  tone?: IrisChipTone
  size?: IrisChipSize
  closable?: boolean
  clickable?: boolean
  disabled?: boolean
  onClose?: () => void
  onClick?: (event: MouseEvent) => void
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Tag/filter chip. Solid port of the Vue/React IrisChip.
 */
export function IrisChip(props: IrisChipProps): JSX.Element {
  const merged = mergeProps(
    {
      variant: 'subtle' as IrisChipVariant,
      tone: 'neutral' as IrisChipTone,
      size: 'md' as IrisChipSize,
      closable: false,
      clickable: false,
      disabled: false,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'variant',
    'tone',
    'size',
    'closable',
    'clickable',
    'disabled',
    'onClose',
    'onClick',
    'children',
    'style',
    'class',
  ])

  const { t } = useI18n()

  const handleClick = (event: MouseEvent): void => {
    if (local.disabled) return
    local.onClick?.(event)
  }

  const handleCloseClick = (event: MouseEvent): void => {
    if (local.disabled) return
    event.stopPropagation()
    local.onClose?.()
  }

  const combinedStyle = (): JSX.CSSProperties => ({
    ...chipStyle(local.variant, local.tone, local.size, local.clickable, local.disabled),
    ...((local.style as JSX.CSSProperties) ?? {}),
  })

  const tag = (): string => (local.clickable ? 'button' : 'span')

  const baseProps = (): Record<string, unknown> => ({
    ...rest,
    'data-iris-chip': '',
    'data-iris-chip-variant': local.variant,
    'data-iris-chip-tone': local.tone,
    'data-iris-chip-size': local.size,
    class: local.class,
    style: combinedStyle(),
    ...(local.clickable
      ? { type: 'button', disabled: local.disabled || undefined, onClick: handleClick }
      : {}),
  })

  return (
    <Dynamic component={tag()} {...baseProps()}>
      <span data-iris-chip-label="">{local.children}</span>
      {local.closable && (
        <button
          type="button"
          data-iris-chip-close=""
          aria-label={t('chip.remove')}
          disabled={local.disabled}
          onClick={handleCloseClick}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: local.disabled ? 'not-allowed' : 'pointer',
            color: 'inherit',
            padding: '0',
            'margin-inline-start': '2px',
            'font-size': 'var(--iris-font-size-xs, 12px)',
            'line-height': '1',
            'flex-shrink': '0',
            opacity: 0.7,
          }}
        >
          ✕
        </button>
      )}
    </Dynamic>
  )
}
