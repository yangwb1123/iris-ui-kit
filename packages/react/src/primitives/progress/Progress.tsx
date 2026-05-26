import * as React from 'react'
import { installProgressStyles } from './styles'

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

export interface IrisProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  value?: number | null
  max?: number
  indeterminate?: boolean
  tone?: IrisProgressTone
  size?: IrisProgressSize
}

export function IrisProgress({
  value = null,
  max = 100,
  indeterminate = false,
  tone = 'primary',
  size = 'md',
  style,
  ...rest
}: IrisProgressProps): React.ReactElement {
  React.useEffect(installProgressStyles, [])
  const isIndeterminate = indeterminate || value === null || value === undefined
  const clamped = !isIndeterminate && value !== null ? Math.max(0, Math.min(max, value)) : 0
  const percent = isIndeterminate ? 0 : (clamped / Math.max(1, max)) * 100

  return (
    <div
      {...rest}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={isIndeterminate ? undefined : clamped}
      data-iris-progress=""
      data-state={isIndeterminate ? 'indeterminate' : 'determinate'}
      data-iris-progress-tone={tone}
      data-iris-progress-size={size}
      style={{ width: '100%', height: HEIGHT_MAP[size], ...style }}
    >
      <div
        data-iris-progress-bar=""
        style={{
          background: `var(${TONE_TO_VAR[tone]})`,
          width: isIndeterminate ? 'auto' : `${percent}%`,
        }}
      />
    </div>
  )
}
