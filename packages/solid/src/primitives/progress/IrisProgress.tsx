import { mergeProps, splitProps, type JSX } from 'solid-js'

export type IrisProgressTone = 'primary' | 'success' | 'warning' | 'danger'
export type IrisProgressSize = 'sm' | 'md'

const TONE_TO_VAR: Record<IrisProgressTone, string> = {
  primary: '--iris-primary',
  success: '--iris-success',
  warning: '--iris-warning',
  danger: '--iris-danger',
}

const HEIGHT_MAP: Record<IrisProgressSize, string> = {
  sm: '4px',
  md: '8px',
}

export interface IrisProgressProps {
  value?: number | null
  max?: number
  indeterminate?: boolean
  tone?: IrisProgressTone
  size?: IrisProgressSize
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Linear progress bar. Determinate (value 0-max) or indeterminate.
 * Solid port of the Vue/React IrisProgress.
 */
export function IrisProgress(props: IrisProgressProps): JSX.Element {
  const merged = mergeProps(
    {
      max: 100,
      indeterminate: false,
      tone: 'primary' as IrisProgressTone,
      size: 'md' as IrisProgressSize,
    },
    props,
  )
  const [local, rest] = splitProps(merged, ['value', 'max', 'indeterminate', 'tone', 'size'])

  const isIndeterminate = (): boolean =>
    local.indeterminate || local.value === null || local.value === undefined

  const clamped = (): number => {
    if (isIndeterminate()) return 0
    return Math.max(0, Math.min(local.max, local.value as number))
  }

  const percent = (): number => (isIndeterminate() ? 0 : (clamped() / Math.max(1, local.max)) * 100)

  return (
    <div
      {...rest}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={local.max}
      aria-valuenow={isIndeterminate() ? undefined : clamped()}
      data-iris-progress=""
      data-state={isIndeterminate() ? 'indeterminate' : 'determinate'}
      data-iris-progress-tone={local.tone}
      data-iris-progress-size={local.size}
      style={{
        width: '100%',
        height: HEIGHT_MAP[local.size],
        background: 'var(--iris-border)',
        'border-radius': '999px',
        overflow: 'hidden',
        ...((rest.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <div
        data-iris-progress-bar=""
        style={{
          height: '100%',
          background: `var(${TONE_TO_VAR[local.tone]})`,
          width: isIndeterminate() ? '50%' : `${percent()}%`,
          transition: isIndeterminate() ? undefined : 'width 200ms ease',
          'border-radius': '999px',
          ...(isIndeterminate()
            ? { animation: 'iris-progress-slide 1.4s ease-in-out infinite' }
            : {}),
        }}
      />
    </div>
  )
}
