import * as React from 'react'

export type IrisAlertTone = 'info' | 'success' | 'warning' | 'danger'

const TONE_TO_VAR: Record<IrisAlertTone, string> = {
  info: '--iris-primary',
  success: '--iris-success',
  warning: '--iris-warning',
  danger: '--iris-danger',
}

export interface IrisAlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: IrisAlertTone
  title?: React.ReactNode
  closable?: boolean
  open?: boolean
  onClose?: () => void
  icon?: React.ReactNode
  children?: React.ReactNode
}

/** React port of {@link import('@iris-ui/vue').IrisAlert}. */
export function IrisAlert({
  tone = 'info',
  title,
  closable = false,
  open,
  onClose,
  icon,
  children,
  style,
  ...rest
}: IrisAlertProps): React.ReactElement | null {
  const [internalOpen, setInternalOpen] = React.useState(true)
  React.useEffect(() => {
    if (open !== undefined) setInternalOpen(open)
  }, [open])

  const isOpen = open !== undefined ? open : internalOpen
  if (!isOpen) return null

  const tonalVar = `var(${TONE_TO_VAR[tone]})`

  const handleClose = () => {
    if (open === undefined) setInternalOpen(false)
    onClose?.()
  }

  return (
    <div
      {...rest}
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      data-iris-alert=""
      data-iris-alert-tone={tone}
      style={{
        display: 'flex',
        gap: 'var(--iris-gap-md, 12px)',
        padding: 'var(--iris-padding-md, 12px)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        border: `1px solid ${tonalVar}`,
        background: `color-mix(in srgb, ${tonalVar} 10%, var(--iris-background))`,
        color: 'var(--iris-foreground)',
        alignItems: 'flex-start',
        ...style,
      }}
    >
      {icon ? (
        <span
          data-iris-alert-icon=""
          style={{ color: tonalVar, flexShrink: 0, display: 'inline-flex' }}
        >
          {icon}
        </span>
      ) : null}
      <div data-iris-alert-body="" style={{ flex: 1, minWidth: 0 }}>
        {title ? (
          <div
            data-iris-alert-title=""
            style={{ fontWeight: 600, marginBottom: 4, color: tonalVar }}
          >
            {title}
          </div>
        ) : null}
        <div data-iris-alert-content="">{children}</div>
      </div>
      {closable ? (
        <button
          type="button"
          data-iris-alert-close=""
          aria-label="Close"
          onClick={handleClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--iris-muted)',
            fontSize: 16,
            padding: 0,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      ) : null}
    </div>
  )
}
