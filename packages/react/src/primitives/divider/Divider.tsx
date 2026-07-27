import * as React from 'react'

export type IrisDividerOrientation = 'horizontal' | 'vertical'
export type IrisDividerSpacing = 'sm' | 'md' | 'lg'

const SPACING_MAP: Record<IrisDividerSpacing, string> = {
  sm: '8px',
  md: '16px',
  lg: '24px',
}

export interface IrisDividerProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  orientation?: IrisDividerOrientation
  label?: React.ReactNode
  spacing?: IrisDividerSpacing
  children?: React.ReactNode
}

/** React port of {@link import('@iris-ui-kit/vue').IrisDivider}. */
export function IrisDivider({
  orientation = 'horizontal',
  label,
  spacing = 'md',
  children,
  style,
  ...rest
}: IrisDividerProps): React.ReactElement {
  const isHorizontal = orientation === 'horizontal'
  const hasLabel = Boolean(label || children)

  if (isHorizontal && !hasLabel) {
    return (
      <hr
        {...rest}
        data-iris-divider=""
        data-iris-divider-orientation="horizontal"
        style={{
          border: 'none',
          borderTop: '1px solid var(--iris-border)',
          margin: `${SPACING_MAP[spacing]} 0`,
          width: '100%',
          ...style,
        }}
      />
    )
  }

  if (!isHorizontal) {
    return (
      <div
        {...rest}
        role="separator"
        aria-orientation="vertical"
        data-iris-divider=""
        data-iris-divider-orientation="vertical"
        style={{
          display: 'inline-block',
          width: 1,
          alignSelf: 'stretch',
          background: 'var(--iris-border)',
          margin: `0 ${SPACING_MAP[spacing]}`,
          ...style,
        }}
      />
    )
  }

  return (
    <div
      {...rest}
      role="separator"
      aria-orientation="horizontal"
      data-iris-divider=""
      data-iris-divider-orientation="horizontal"
      data-iris-divider-has-label="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: `${SPACING_MAP[spacing]} 0`,
        color: 'var(--iris-muted)',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        ...style,
      }}
    >
      <span data-iris-divider-line="before" style={lineStyle} />
      <span data-iris-divider-label="">{children ?? label}</span>
      <span data-iris-divider-line="after" style={lineStyle} />
    </div>
  )
}

const lineStyle: React.CSSProperties = {
  flex: 1,
  height: 1,
  background: 'var(--iris-border)',
}
