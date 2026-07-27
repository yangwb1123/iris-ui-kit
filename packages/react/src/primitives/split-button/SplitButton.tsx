import * as React from 'react'
import { useI18n } from '../../i18n'

export type IrisSplitButtonVariant = 'primary' | 'default'
export type IrisSplitButtonSize = 'sm' | 'md' | 'lg'

export interface IrisSplitButtonAction {
  key: string
  label: string
  disabled?: boolean
  onClick?: () => void
}

export interface IrisSplitButtonProps {
  children?: React.ReactNode
  onClick?: () => void
  actions?: IrisSplitButtonAction[]
  variant?: IrisSplitButtonVariant
  size?: IrisSplitButtonSize
  disabled?: boolean
  menuAriaLabel?: string
  style?: React.CSSProperties
  className?: string
}

const SIZE_MAP: Record<IrisSplitButtonSize, { padding: string; fontSize: number; height: number }> =
  {
    sm: { padding: '4px 10px', fontSize: 12, height: 28 },
    md: { padding: '6px 14px', fontSize: 14, height: 34 },
    lg: { padding: '8px 18px', fontSize: 16, height: 40 },
  }

/**
 * Split button: a primary action joined to a caret that opens a `role="menu"`
 * of secondary actions (dismissed by selection, Escape, or outside click).
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisSplitButton}.
 */
export function IrisSplitButton({
  children,
  onClick,
  actions,
  variant = 'primary',
  size = 'md',
  disabled = false,
  menuAriaLabel,
  style,
  className,
  ...rest
}: IrisSplitButtonProps): React.ReactElement {
  const { t } = useI18n()
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = React.useState(false)
  const hasActions = !!actions && actions.length > 0

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

  const sz = SIZE_MAP[size]
  const colors: React.CSSProperties =
    variant === 'primary'
      ? {
          background: 'var(--iris-primary)',
          color: '#fff',
          border: '1px solid var(--iris-primary)',
        }
      : {
          background: 'var(--iris-surface)',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
        }
  const label = menuAriaLabel ?? t('splitButton.more')

  const select = (a: IrisSplitButtonAction) => {
    if (a.disabled) return
    a.onClick?.()
    setOpen(false)
  }

  return (
    <div
      ref={rootRef}
      data-iris-split-button=""
      data-state={open ? 'open' : 'closed'}
      className={className}
      {...rest}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
    >
      <button
        type="button"
        data-iris-split-button-main=""
        disabled={disabled}
        onClick={() => !disabled && onClick?.()}
        style={{
          ...colors,
          padding: sz.padding,
          minHeight: sz.height,
          fontSize: sz.fontSize,
          fontFamily: 'inherit',
          borderStartStartRadius: 'var(--iris-radius-md, 6px)',
          borderEndStartRadius: 'var(--iris-radius-md, 6px)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {children}
      </button>
      {hasActions ? (
        <button
          type="button"
          data-iris-split-button-trigger=""
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={label}
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          style={{
            ...colors,
            borderInlineStart:
              variant === 'primary'
                ? '1px solid rgba(255,255,255,0.3)'
                : '1px solid var(--iris-border)',
            padding: '0 8px',
            minHeight: sz.height,
            fontSize: 10,
            borderStartEndRadius: 'var(--iris-radius-md, 6px)',
            borderEndEndRadius: 'var(--iris-radius-md, 6px)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          ▾
        </button>
      ) : null}
      {open && hasActions ? (
        <ul
          role="menu"
          aria-label={label}
          data-iris-split-button-menu=""
          style={{
            position: 'absolute',
            insetInlineEnd: 0,
            top: '100%',
            marginBlockStart: 4,
            minWidth: 140,
            listStyle: 'none',
            margin: 0,
            padding: 4,
            zIndex: 50,
            background: 'var(--iris-background)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          {actions!.map((a) => (
            <li
              key={a.key}
              role="menuitem"
              aria-disabled={a.disabled ? 'true' : undefined}
              data-iris-split-button-item=""
              data-key={a.key}
              onClick={() => select(a)}
              style={{
                padding: '6px 10px',
                fontSize: 14,
                borderRadius: 'var(--iris-radius-sm, 4px)',
                cursor: a.disabled ? 'not-allowed' : 'pointer',
                color: a.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
              }}
            >
              {a.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
