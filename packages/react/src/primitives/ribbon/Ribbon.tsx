import * as React from 'react'

export type IrisRibbonPlacement = 'start' | 'end'

export interface IrisRibbonProps {
  text: React.ReactNode
  /** Corner: 'end' = top inline-end (default), 'start' = top inline-start. */
  placement?: IrisRibbonPlacement
  /** Badge background (defaults to the primary color). */
  color?: string
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

/**
 * Ribbon: a corner badge ("New", "Sale", …) anchored to the top corner of its
 * content. RTL-safe via logical insets/radii.
 *
 * React port of {@link import('@iris-ui/vue').IrisRibbon}.
 */
export function IrisRibbon({
  text,
  placement = 'end',
  color,
  children,
  style,
  className,
  ...rest
}: IrisRibbonProps): React.ReactElement {
  const side: React.CSSProperties =
    placement === 'end'
      ? {
          insetInlineEnd: 0,
          borderStartStartRadius: 'var(--iris-radius-sm, 4px)',
          borderEndStartRadius: 'var(--iris-radius-sm, 4px)',
        }
      : {
          insetInlineStart: 0,
          borderStartEndRadius: 'var(--iris-radius-sm, 4px)',
          borderEndEndRadius: 'var(--iris-radius-sm, 4px)',
        }

  return (
    <div
      data-iris-ribbon=""
      data-placement={placement}
      className={className}
      {...rest}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      {children}
      <span
        data-iris-ribbon-badge=""
        style={{
          position: 'absolute',
          insetBlockStart: 8,
          background: color ?? 'var(--iris-primary)',
          color: '#fff',
          padding: '2px 10px',
          fontSize: 12,
          fontWeight: 600,
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap',
          ...side,
        }}
      >
        {text}
      </span>
    </div>
  )
}
