import * as React from 'react'
import { installSpinnerStyles } from './styles'

export type IrisSpinnerSize = 'sm' | 'md' | 'lg' | number

const SIZE_MAP: Record<Exclude<IrisSpinnerSize, number>, number> = {
  sm: 14,
  md: 18,
  lg: 24,
}

function resolveSize(size: IrisSpinnerSize): number {
  return typeof size === 'number' ? size : SIZE_MAP[size]
}

export interface IrisSpinnerProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  size?: IrisSpinnerSize
  color?: string
  strokeWidth?: number
  label?: string
}

/** React port of {@link import('@iris-ui/vue').IrisSpinner}. */
export function IrisSpinner({
  size = 'md',
  color = 'var(--iris-primary)',
  strokeWidth = 0,
  label = 'Loading',
  style,
  ...rest
}: IrisSpinnerProps): React.ReactElement {
  React.useEffect(installSpinnerStyles, [])
  const px = resolveSize(size)
  const sw = strokeWidth || Math.max(1.5, Math.round(px * 0.12))

  return (
    <span
      {...rest}
      role="status"
      aria-live="polite"
      data-iris-spinner-wrap=""
      style={{ display: 'inline-flex', alignItems: 'center', ...style }}
    >
      <svg
        data-iris-spinner=""
        width={px}
        height={px}
        viewBox="0 0 50 50"
        aria-hidden="true"
        focusable="false"
        style={{ color }}
      >
        <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth={sw} />
      </svg>
      {label ? (
        <span
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {label}
        </span>
      ) : null}
    </span>
  )
}
