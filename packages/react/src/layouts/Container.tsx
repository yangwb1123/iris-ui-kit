import * as React from 'react'

export type IrisContainerMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full' | string

const WIDTH_MAP: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: '100%',
}

function resolveMaxWidth(input: IrisContainerMaxWidth): string {
  if (input === 'sm' || input === 'md' || input === 'lg' || input === 'xl' || input === 'full') {
    return WIDTH_MAP[input]
  }
  return input
}

function resolvePadding(input: string | number): string {
  if (typeof input === 'number') return `${input}px`
  if (input === 'sm' || input === 'md' || input === 'lg') {
    return `var(--iris-padding-${input})`
  }
  return input
}

export interface IrisContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: IrisContainerMaxWidth
  padding?: string | number
  center?: boolean
}

/**
 * Centered max-width wrapper. Use to bound content width on large screens
 * without rewriting flex/grid plumbing.
 */
export const IrisContainer = React.forwardRef<HTMLDivElement, IrisContainerProps>(
  function IrisContainer(
    { maxWidth = 'lg', padding = 'md', center = true, style, children, ...rest },
    ref,
  ) {
    return (
      <div
        {...rest}
        ref={ref}
        data-iris-container=""
        data-iris-container-max-width={maxWidth}
        style={{
          width: '100%',
          maxWidth: resolveMaxWidth(maxWidth),
          padding: `0 ${resolvePadding(padding)}`,
          ...(center ? { marginLeft: 'auto', marginRight: 'auto' } : {}),
          ...style,
        }}
      >
        {children}
      </div>
    )
  },
)
