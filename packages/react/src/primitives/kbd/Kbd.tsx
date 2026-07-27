import * as React from 'react'

export type IrisKbdSize = 'sm' | 'md'

const SIZE_MAP: Record<IrisKbdSize, { fontSize: string; padding: string }> = {
  sm: { fontSize: '10px', padding: '2px 5px' },
  md: { fontSize: '12px', padding: '3px 6px' },
}

export interface IrisKbdProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  keys?: string | string[]
  separator?: string
  size?: IrisKbdSize
  children?: React.ReactNode
}

/** React port of {@link import('@iris-ui-kit/vue').IrisKbd}. */
export function IrisKbd({
  keys = [],
  separator = '+',
  size = 'md',
  children,
  style,
  ...rest
}: IrisKbdProps): React.ReactElement | null {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontFamily: 'var(--iris-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
    fontSize: SIZE_MAP[size].fontSize,
    verticalAlign: 'middle',
    ...style,
  }
  const keyStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZE_MAP[size].padding,
    background: 'var(--iris-surface)',
    color: 'var(--iris-foreground)',
    border: '1px solid var(--iris-border)',
    borderRadius: 4,
    boxShadow: '0 1px 0 var(--iris-border)',
    lineHeight: 1,
    fontWeight: 500,
  }

  if (children !== undefined && children !== null) {
    return (
      <kbd {...rest} data-iris-kbd="" data-iris-kbd-size={size} style={baseStyle}>
        {children}
      </kbd>
    )
  }

  const list = typeof keys === 'string' ? (keys ? [keys] : []) : keys
  if (list.length === 0) return null

  const items: React.ReactNode[] = []
  list.forEach((k, i) => {
    items.push(
      <kbd key={`k-${i}`} data-iris-kbd-key="" style={keyStyle}>
        {k}
      </kbd>,
    )
    if (i < list.length - 1) {
      items.push(
        <span
          key={`s-${i}`}
          data-iris-kbd-separator=""
          aria-hidden="true"
          style={{ color: 'var(--iris-muted)' }}
        >
          {separator}
        </span>,
      )
    }
  })

  return (
    <span {...rest} data-iris-kbd="" data-iris-kbd-size={size} style={baseStyle}>
      {items}
    </span>
  )
}
