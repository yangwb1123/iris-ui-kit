import { createEffect, createSignal, mergeProps, onCleanup, Show, For, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

export type IrisSplitButtonVariant = 'primary' | 'default'
export type IrisSplitButtonSize = 'sm' | 'md' | 'lg'

export interface IrisSplitButtonAction {
  key: string
  label: string
  disabled?: boolean
  onClick?: () => void
}

const SIZE_MAP: Record<IrisSplitButtonSize, { padding: string; fontSize: string; height: string }> =
  {
    sm: { padding: '4px 10px', fontSize: '12px', height: '28px' },
    md: { padding: '6px 14px', fontSize: '14px', height: '34px' },
    lg: { padding: '8px 18px', fontSize: '16px', height: '40px' },
  }

export interface IrisSplitButtonProps {
  actions?: IrisSplitButtonAction[]
  variant?: IrisSplitButtonVariant
  size?: IrisSplitButtonSize
  disabled?: boolean
  menuAriaLabel?: string
  onClick?: () => void
  children?: JSX.Element
  style?: JSX.CSSProperties
}

/**
 * Split button: a primary action joined to a caret that opens a `role="menu"`
 * of secondary actions. Solid port of the Vue IrisSplitButton.
 */
export function IrisSplitButton(props: IrisSplitButtonProps): JSX.Element {
  const merged = mergeProps(
    {
      variant: 'primary' as IrisSplitButtonVariant,
      size: 'md' as IrisSplitButtonSize,
      disabled: false,
    },
    props,
  )

  const { t } = useI18n()

  const [open, setOpen] = createSignal(false)
  let rootEl: HTMLDivElement | undefined

  const hasActions = (): boolean => !!merged.actions && merged.actions.length > 0

  const onDown = (e: MouseEvent): void => {
    if (open() && rootEl && !rootEl.contains(e.target as Node)) setOpen(false)
  }
  const onKey = (e: KeyboardEvent): void => {
    if (open() && e.key === 'Escape') setOpen(false)
  }

  createEffect(() => {
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    onCleanup(() => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    })
  })

  const select = (a: IrisSplitButtonAction): void => {
    if (a.disabled) return
    a.onClick?.()
    setOpen(false)
  }

  const sz = (): { padding: string; fontSize: string; height: string } => SIZE_MAP[merged.size]
  const colors = (): JSX.CSSProperties =>
    merged.variant === 'primary'
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

  const label = (): string => merged.menuAriaLabel ?? t('splitButton.more')

  return (
    <div
      ref={rootEl}
      data-iris-split-button=""
      data-state={open() ? 'open' : 'closed'}
      style={{
        position: 'relative',
        display: 'inline-flex',
        ...(merged.style ?? {}),
      }}
    >
      <button
        type="button"
        data-iris-split-button-main=""
        disabled={merged.disabled || undefined}
        onClick={() => {
          if (!merged.disabled) merged.onClick?.()
        }}
        style={{
          ...colors(),
          padding: sz().padding,
          'min-height': sz().height,
          'font-size': sz().fontSize,
          'font-family': 'inherit',
          'border-start-start-radius': 'var(--iris-radius-md, 6px)',
          'border-end-start-radius': 'var(--iris-radius-md, 6px)',
          cursor: merged.disabled ? 'not-allowed' : 'pointer',
          opacity: merged.disabled ? '0.6' : '1',
        }}
      >
        {merged.children}
      </button>
      <Show when={hasActions()}>
        <button
          type="button"
          data-iris-split-button-trigger=""
          aria-haspopup="menu"
          aria-expanded={open()}
          aria-label={label()}
          disabled={merged.disabled || undefined}
          onClick={() => {
            if (!merged.disabled) setOpen((v) => !v)
          }}
          style={{
            ...colors(),
            'border-inline-start':
              merged.variant === 'primary'
                ? '1px solid rgba(255,255,255,0.3)'
                : '1px solid var(--iris-border)',
            padding: '0 8px',
            'min-height': sz().height,
            'font-size': '10px',
            'border-start-end-radius': 'var(--iris-radius-md, 6px)',
            'border-end-end-radius': 'var(--iris-radius-md, 6px)',
            cursor: merged.disabled ? 'not-allowed' : 'pointer',
            opacity: merged.disabled ? '0.6' : '1',
            display: 'inline-flex',
            'align-items': 'center',
          }}
        >
          ▾
        </button>
      </Show>
      <Show when={open() && hasActions()}>
        <ul
          role="menu"
          aria-label={label()}
          data-iris-split-button-menu=""
          style={{
            position: 'absolute',
            'inset-inline-end': '0',
            top: '100%',
            'margin-block-start': '4px',
            'min-width': '140px',
            'list-style': 'none',
            margin: '0',
            padding: '4px',
            'z-index': 50,
            background: 'var(--iris-background)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            'box-shadow': '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          <For each={merged.actions}>
            {(a) => (
              <li
                role="menuitem"
                aria-disabled={a.disabled ? 'true' : undefined}
                data-iris-split-button-item=""
                data-key={a.key}
                onClick={() => select(a)}
                style={{
                  padding: '6px 10px',
                  'font-size': '14px',
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                  cursor: a.disabled ? 'not-allowed' : 'pointer',
                  color: a.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                }}
              >
                {a.label}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
