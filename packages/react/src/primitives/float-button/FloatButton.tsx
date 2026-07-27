import * as React from 'react'
import { useI18n } from '../../i18n'

export type IrisFloatButtonShape = 'circle' | 'square'

export interface IrisFloatButtonAction {
  key: string
  icon?: React.ReactNode
  label?: string
  ariaLabel?: string
  onClick?: () => void
}

export interface IrisFloatButtonProps {
  icon?: React.ReactNode
  children?: React.ReactNode
  ariaLabel?: string
  onClick?: () => void
  shape?: IrisFloatButtonShape
  /** Speed-dial actions; when present, the button toggles them instead of `onClick`. */
  actions?: IrisFloatButtonAction[]
  /** Corner offsets (logical: distance from block-end / inline-end). */
  offset?: { bottom?: number; right?: number }
  style?: React.CSSProperties
  className?: string
}

const fab = (size: number, primary: boolean): React.CSSProperties => ({
  width: size,
  height: size,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: primary ? 'none' : '1px solid var(--iris-border)',
  background: primary ? 'var(--iris-primary)' : 'var(--iris-background)',
  color: primary ? '#fff' : 'var(--iris-foreground)',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
  fontSize: size > 44 ? 22 : 16,
  lineHeight: 1,
})

/**
 * Floating action button: a fixed-position FAB. With `actions` it becomes a
 * speed-dial — click toggles a `role="menu"` stack of actions (dismissed by
 * selection, Escape, or outside click). Otherwise click runs `onClick`.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisFloatButton}.
 */
export function IrisFloatButton({
  icon,
  children,
  ariaLabel,
  onClick,
  shape = 'circle',
  actions,
  offset,
  style,
  className,
}: IrisFloatButtonProps): React.ReactElement {
  const { t } = useI18n()
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = React.useState(false)
  const hasActions = !!actions && actions.length > 0
  const content = children ?? icon ?? '+'
  const radius = shape === 'circle' ? '50%' : 'var(--iris-radius-md, 6px)'

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      data-iris-float-button-root=""
      className={className}
      style={{
        position: 'fixed',
        insetBlockEnd: offset?.bottom ?? 24,
        insetInlineEnd: offset?.right ?? 24,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        ...style,
      }}
    >
      {hasActions && open ? (
        <div
          data-iris-float-button-actions=""
          role="menu"
          style={{
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: 12,
            alignItems: 'center',
          }}
        >
          {actions!.map((a) => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              data-iris-float-button-action=""
              data-key={a.key}
              aria-label={a.ariaLabel ?? a.label}
              onClick={() => {
                a.onClick?.()
                setOpen(false)
              }}
              style={{ ...fab(40, false), borderRadius: radius }}
            >
              {a.icon ?? a.label}
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        data-iris-float-button=""
        aria-label={ariaLabel ?? (hasActions ? t('floatButton.actions') : undefined)}
        aria-haspopup={hasActions ? 'menu' : undefined}
        aria-expanded={hasActions ? open : undefined}
        onClick={() => {
          if (hasActions) setOpen((o) => !o)
          else onClick?.()
        }}
        style={{ ...fab(48, true), borderRadius: radius }}
      >
        {content}
      </button>
    </div>
  )
}
