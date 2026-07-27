import * as React from 'react'

export type IrisResultStatus = 'success' | 'error' | 'info' | 'warning'

export interface IrisResultProps {
  status?: IrisResultStatus
  title?: React.ReactNode
  subtitle?: React.ReactNode
  /** Override the default status glyph/icon. */
  icon?: React.ReactNode
  /** Action area (e.g. buttons) below the text. */
  extra?: React.ReactNode
  /** Additional content (e.g. error details). */
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const STATUS: Record<IrisResultStatus, { color: string; glyph: string }> = {
  success: { color: 'var(--iris-success, #16a34a)', glyph: '✓' },
  error: { color: 'var(--iris-danger)', glyph: '✕' },
  info: { color: 'var(--iris-info, #0ea5e9)', glyph: 'i' },
  warning: { color: 'var(--iris-warning, #f59e0b)', glyph: '!' },
}

/**
 * Result: a centered outcome page for an operation — a status icon, title,
 * subtitle, action area, and optional content. Use for success / error / 404 /
 * 403 / 500 screens. Pure presentation; the status glyph is decorative.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisResult}.
 */
export function IrisResult({
  status = 'info',
  title,
  subtitle,
  icon,
  extra,
  children,
  style,
  className,
  ...rest
}: IrisResultProps): React.ReactElement {
  const s = STATUS[status]
  return (
    <div
      data-iris-result=""
      data-status={status}
      className={className}
      {...rest}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 8,
        padding: '32px 16px',
        ...style,
      }}
    >
      <div
        data-iris-result-icon=""
        aria-hidden="true"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 30,
          fontWeight: 700,
          color: '#fff',
          background: s.color,
          marginBlockEnd: 8,
        }}
      >
        {icon ?? s.glyph}
      </div>
      {title != null ? (
        <div
          data-iris-result-title=""
          style={{ fontSize: 20, fontWeight: 600, color: 'var(--iris-foreground)' }}
        >
          {title}
        </div>
      ) : null}
      {subtitle != null ? (
        <div
          data-iris-result-subtitle=""
          style={{ fontSize: 14, color: 'var(--iris-muted)', maxWidth: 480 }}
        >
          {subtitle}
        </div>
      ) : null}
      {children != null ? (
        <div data-iris-result-content="" style={{ marginBlockStart: 8, width: '100%' }}>
          {children}
        </div>
      ) : null}
      {extra != null ? (
        <div
          data-iris-result-extra=""
          style={{
            marginBlockStart: 8,
            display: 'inline-flex',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {extra}
        </div>
      ) : null}
    </div>
  )
}
