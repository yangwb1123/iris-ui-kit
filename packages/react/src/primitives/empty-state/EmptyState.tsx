import * as React from 'react'

export interface IrisEmptyStateProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'title' | 'children'
> {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
}

/** React port of {@link import('@iris-ui-kit/vue').IrisEmptyState}. */
export function IrisEmptyState({
  title,
  description,
  icon,
  action,
  children,
  style,
  ...rest
}: IrisEmptyStateProps): React.ReactElement {
  return (
    <div
      {...rest}
      role="status"
      data-iris-empty-state=""
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '32px 16px',
        textAlign: 'center',
        color: 'var(--iris-foreground)',
        ...style,
      }}
    >
      {icon ? (
        <div
          data-iris-empty-state-icon=""
          style={{
            color: 'var(--iris-muted)',
            fontSize: 'var(--iris-font-size-4xl, 30px)',
            lineHeight: 1,
          }}
        >
          {icon}
        </div>
      ) : null}
      {title ? (
        <div
          data-iris-empty-state-title=""
          style={{ fontWeight: 600, fontSize: 'var(--iris-font-size-lg, 16px)' }}
        >
          {title}
        </div>
      ) : null}
      {description || children ? (
        <div
          data-iris-empty-state-description=""
          style={{
            color: 'var(--iris-muted)',
            fontSize: 'var(--iris-font-size-md, 14px)',
            maxWidth: 380,
          }}
        >
          {description ?? children}
        </div>
      ) : null}
      {action ? (
        <div data-iris-empty-state-action="" style={{ marginTop: 4 }}>
          {action}
        </div>
      ) : null}
    </div>
  )
}
