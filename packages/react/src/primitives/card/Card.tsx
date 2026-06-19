import * as React from 'react'

export type IrisCardVariant = 'elevated' | 'outline' | 'subtle'
export type IrisCardPadding = 'none' | 'sm' | 'md' | 'lg'

const PADDING_MAP: Record<IrisCardPadding, string> = {
  none: '0',
  sm: '12px',
  md: 'var(--iris-padding-md, 16px)',
  lg: '24px',
}

function variantStyle(variant: IrisCardVariant): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--iris-background)',
    color: 'var(--iris-foreground)',
    borderRadius: 'var(--iris-radius-md, 8px)',
    overflow: 'hidden',
  }
  switch (variant) {
    case 'elevated':
      return { ...base, boxShadow: '0 1px 2px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.06)' }
    case 'outline':
      return { ...base, border: '1px solid var(--iris-border)' }
    case 'subtle':
      return { ...base, background: 'var(--iris-surface)' }
  }
}

export interface IrisCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: IrisCardVariant
  padding?: IrisCardPadding
  hover?: boolean
  header?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
}

/**
 * React port of {@link import('@iris-ui/vue').IrisCard}.
 *
 * @example
 *   <IrisCard variant="elevated" header={<h3>Title</h3>}>
 *     Card body content.
 *   </IrisCard>
 */
export function IrisCard({
  variant = 'elevated',
  padding = 'md',
  hover = false,
  header,
  footer,
  children,
  style,
  ...rest
}: IrisCardProps): React.ReactElement {
  const sectionPadding = PADDING_MAP[padding]
  const containerStyle: React.CSSProperties = {
    ...variantStyle(variant),
    transition: hover ? 'transform 160ms ease, box-shadow 160ms ease' : 'none',
    ...style,
  }

  return (
    <div
      {...rest}
      data-iris-card=""
      data-iris-card-variant={variant}
      data-iris-card-padding={padding}
      data-iris-card-hover={hover ? 'true' : undefined}
      style={containerStyle}
    >
      {header !== undefined && header !== null ? (
        <div
          data-iris-card-header=""
          style={{
            padding: sectionPadding,
            borderBottom: '1px solid var(--iris-border)',
            fontWeight: 600,
          }}
        >
          {header}
        </div>
      ) : null}
      {children !== undefined && children !== null ? (
        <div data-iris-card-body="" style={{ padding: sectionPadding, flex: 1 }}>
          {children}
        </div>
      ) : null}
      {footer !== undefined && footer !== null ? (
        <div
          data-iris-card-footer=""
          style={{ padding: sectionPadding, borderTop: '1px solid var(--iris-border)' }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  )
}
