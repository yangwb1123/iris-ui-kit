import * as React from 'react'

export type IrisScrollAreaAxis = 'vertical' | 'horizontal' | 'both'

export interface IrisScrollAreaProps {
  maxHeight?: number | string
  maxWidth?: number | string
  axis?: IrisScrollAreaAxis
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const OVERFLOW: Record<IrisScrollAreaAxis, React.CSSProperties> = {
  vertical: { overflowY: 'auto', overflowX: 'hidden' },
  horizontal: { overflowX: 'auto', overflowY: 'hidden' },
  both: { overflow: 'auto' },
}

/**
 * Scroll area: a keyboard-focusable scroll container that constrains its
 * content via `maxHeight` / `maxWidth` and scrolls on the chosen `axis`. A
 * lightweight alternative to ad-hoc overflow styling.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisScrollArea}.
 */
export function IrisScrollArea({
  maxHeight,
  maxWidth,
  axis = 'vertical',
  children,
  style,
  className,
}: IrisScrollAreaProps): React.ReactElement {
  return (
    <div
      data-iris-scroll-area=""
      data-axis={axis}
      tabIndex={0}
      className={className}
      style={{ ...OVERFLOW[axis], maxHeight, maxWidth, outline: 'none', ...style }}
    >
      {children}
    </div>
  )
}
