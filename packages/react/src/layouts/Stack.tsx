import * as React from 'react'

export type IrisStackDirection = 'row' | 'column'
export type IrisStackAlign = 'start' | 'center' | 'end' | 'stretch'
export type IrisStackJustify = 'start' | 'center' | 'end' | 'between' | 'around'

const ALIGN_MAP: Record<IrisStackAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const JUSTIFY_MAP: Record<IrisStackJustify, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
}

function toCssSpacing(spacing: string | number): string {
  if (typeof spacing === 'number') return `${spacing}px`
  if (spacing === 'sm' || spacing === 'md' || spacing === 'lg') {
    return `var(--iris-gap-${spacing})`
  }
  return spacing
}

export interface IrisStackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: IrisStackDirection
  spacing?: string | number
  align?: IrisStackAlign
  justify?: IrisStackJustify
  wrap?: boolean
  /** When true, renders as `inline-flex`. */
  inline?: boolean
}

/**
 * Flex container with token-driven spacing. The lightest possible layout
 * primitive — saves hand-writing `display: flex` everywhere.
 */
export const IrisStack = React.forwardRef<HTMLDivElement, IrisStackProps>(function IrisStack(
  {
    direction = 'column',
    spacing = 'md',
    align = 'stretch',
    justify = 'start',
    wrap = false,
    inline = false,
    style,
    children,
    ...rest
  },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      data-iris-stack=""
      data-iris-stack-direction={direction}
      style={{
        display: inline ? 'inline-flex' : 'flex',
        flexDirection: direction,
        gap: toCssSpacing(spacing),
        alignItems: ALIGN_MAP[align],
        justifyContent: JUSTIFY_MAP[justify],
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  )
})
