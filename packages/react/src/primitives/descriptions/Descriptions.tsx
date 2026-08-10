import * as React from 'react'

export type IrisDescriptionsLayout = 'horizontal' | 'vertical'

export interface IrisDescriptionsItem {
  key?: string | number
  label: React.ReactNode
  value: React.ReactNode
}

export interface IrisDescriptionsProps {
  items: IrisDescriptionsItem[]
  /** Number of label/value pairs per row. Default 1. */
  columns?: number
  /** `horizontal` = label beside value; `vertical` = label above value. */
  layout?: IrisDescriptionsLayout
  /** Boxed style with cell separators. */
  bordered?: boolean
  style?: React.CSSProperties
  className?: string
}

/**
 * Description list: a semantic `<dl>` rendering label/value pairs in a grid.
 * `columns` controls pairs-per-row, `layout` places the label beside or above
 * the value, and `bordered` draws a boxed style with separators. RTL-safe via
 * logical properties.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisDescriptions}.
 */
export function IrisDescriptions({
  items,
  columns = 1,
  layout = 'horizontal',
  bordered = false,
  style,
  className,
  ...rest
}: IrisDescriptionsProps): React.ReactElement {
  const horizontal = layout === 'horizontal'
  const pad = bordered ? '8px 12px' : undefined

  const labelStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--iris-font-size-sm, 13px)',
    fontWeight: 500,
    color: 'var(--iris-muted)',
    padding: pad,
    ...(bordered ? { background: 'var(--iris-surface)' } : null),
  }
  const valueStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--iris-font-size-md, 14px)',
    color: 'var(--iris-foreground)',
    padding: pad,
  }

  return (
    <dl
      data-iris-descriptions=""
      data-layout={layout}
      className={className}
      {...rest}
      style={{
        display: 'grid',
        gridTemplateColumns: horizontal
          ? `repeat(${columns}, max-content 1fr)`
          : `repeat(${columns}, 1fr)`,
        gap: bordered ? 0 : horizontal ? '8px 16px' : 12,
        margin: 0,
        ...(bordered
          ? {
              border: '1px solid var(--iris-border)',
              borderRadius: 'var(--iris-radius-md, 6px)',
              overflow: 'hidden',
            }
          : null),
        ...style,
      }}
    >
      {items.map((item, i) => {
        const rowBorder = bordered && i >= columns ? '1px solid var(--iris-border)' : undefined
        if (horizontal) {
          return (
            <React.Fragment key={item.key ?? i}>
              <dt
                data-iris-descriptions-label=""
                style={{
                  ...labelStyle,
                  borderBlockStart: rowBorder,
                  borderInlineEnd: bordered ? '1px solid var(--iris-border)' : undefined,
                }}
              >
                {item.label}
              </dt>
              <dd
                data-iris-descriptions-value=""
                style={{ ...valueStyle, borderBlockStart: rowBorder }}
              >
                {item.value}
              </dd>
            </React.Fragment>
          )
        }
        return (
          <div
            key={item.key ?? i}
            data-iris-descriptions-item=""
            style={{
              borderBlockStart: rowBorder,
              borderInlineStart:
                bordered && i % columns !== 0 ? '1px solid var(--iris-border)' : undefined,
            }}
          >
            <dt data-iris-descriptions-label="" style={labelStyle}>
              {item.label}
            </dt>
            <dd data-iris-descriptions-value="" style={valueStyle}>
              {item.value}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
