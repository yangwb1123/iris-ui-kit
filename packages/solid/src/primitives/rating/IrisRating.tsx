import { createSignal, For, mergeProps, splitProps, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

export type IrisRatingSize = 'sm' | 'md' | 'lg'

const SIZE_MAP: Record<IrisRatingSize, number> = { sm: 16, md: 22, lg: 28 }

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function snap(value: number, step: number): number {
  return Math.round(value / step) * step
}

export interface IrisRatingProps {
  value?: number
  defaultValue?: number
  max?: number
  allowHalf?: boolean
  readonly?: boolean
  disabled?: boolean
  clearable?: boolean
  size?: IrisRatingSize
  invalid?: boolean
  label?: string
  onChange?: (value: number) => void
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Star rating with optional half-star precision.
 * Solid port of the Vue/React IrisRating.
 */
export function IrisRating(props: IrisRatingProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultValue: 0,
      max: 5,
      allowHalf: false,
      readonly: false,
      disabled: false,
      clearable: true,
      size: 'md' as IrisRatingSize,
      invalid: false,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'max',
    'allowHalf',
    'readonly',
    'disabled',
    'clearable',
    'size',
    'invalid',
    'label',
    'onChange',
  ])

  const { t } = useI18n()

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal(local.defaultValue ?? 0)
  const [hover, setHover] = createSignal<number | null>(null)

  const step = (): number => (local.allowHalf ? 0.5 : 1)
  const currentValue = (): number =>
    clamp(isControlled() ? (local.value as number) : internal(), 0, local.max)
  const interactive = (): boolean => !local.readonly && !local.disabled
  const display = (): number => hover() ?? currentValue()

  const setValue = (next: number): void => {
    const v = clamp(snap(next, step()), 0, local.max)
    if (v === currentValue()) return
    if (!isControlled()) setInternal(v)
    local.onChange?.(v)
  }

  const valueAt = (i: number, event: MouseEvent): number => {
    if (!local.allowHalf) return i + 1
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const past = event.clientX - rect.left
    return past < rect.width / 2 ? i + 0.5 : i + 1
  }

  const onClick = (i: number, event: MouseEvent): void => {
    if (!interactive()) return
    let next = valueAt(i, event)
    if (local.clearable && next === currentValue()) next = 0
    setValue(next)
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!interactive()) return
    let next = currentValue()
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = currentValue() + step()
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        next = currentValue() - step()
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = local.max
        break
      default:
        return
    }
    event.preventDefault()
    setValue(next)
  }

  const px = (): number => SIZE_MAP[local.size]
  const fillColor = (): string =>
    local.invalid ? 'var(--iris-danger)' : 'var(--iris-warning, #f59e0b)'

  return (
    <div
      {...rest}
      data-iris-rating=""
      data-iris-rating-size={local.size}
      data-state={local.invalid ? 'invalid' : 'idle'}
      role="slider"
      tabindex={interactive() ? 0 : -1}
      aria-label={local.label ?? t('rating.label')}
      aria-valuemin={0}
      aria-valuemax={local.max}
      aria-valuenow={currentValue()}
      aria-valuetext={t('rating.value', { value: currentValue(), max: local.max })}
      aria-readonly={local.readonly ? 'true' : undefined}
      aria-disabled={local.disabled ? 'true' : undefined}
      aria-invalid={local.invalid ? 'true' : undefined}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setHover(null)}
      style={{
        display: 'inline-flex',
        gap: `${Math.round(px() * 0.18)}px`,
        'line-height': '1',
        color: 'var(--iris-border)',
        cursor: interactive() ? 'pointer' : 'default',
        opacity: local.disabled ? 0.6 : 1,
        outline: 'none',
        ...((rest.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <For each={Array.from({ length: local.max })}>
        {(_, i) => {
          const fill = (): number => clamp(display() - i(), 0, 1) * 100
          return (
            <span
              data-iris-rating-star=""
              data-filled={fill() >= 100 ? 'true' : fill() > 0 ? 'half' : undefined}
              onClick={(e) => onClick(i(), e)}
              onMouseMove={interactive() ? (e) => setHover(valueAt(i(), e)) : undefined}
              style={{
                position: 'relative',
                display: 'inline-block',
                width: `${px()}px`,
                height: `${px()}px`,
                'font-size': `${px()}px`,
              }}
            >
              <span aria-hidden="true">★</span>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  'inset-block-start': '0',
                  'inset-inline-start': '0',
                  overflow: 'hidden',
                  width: `${fill()}%`,
                  color: fillColor(),
                  'white-space': 'nowrap',
                }}
              >
                ★
              </span>
            </span>
          )
        }}
      </For>
    </div>
  )
}
