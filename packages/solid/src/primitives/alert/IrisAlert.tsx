import { createSignal, mergeProps, Show, splitProps, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

export type IrisAlertTone = 'info' | 'success' | 'warning' | 'danger'

const TONE_TO_VAR: Record<IrisAlertTone, string> = {
  info: '--iris-primary',
  success: '--iris-success',
  warning: '--iris-warning',
  danger: '--iris-danger',
}

export interface IrisAlertProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: IrisAlertTone
  title?: string
  /** When true, a close button is rendered. */
  closable?: boolean
  /** Controlled visibility. Omit for uncontrolled. */
  open?: boolean
  onClose?: () => void
  'onUpdate:open'?: (value: boolean) => void
  icon?: JSX.Element
  children?: JSX.Element
}

/**
 * Inline status / feedback callout. Use for page- or section-level messages
 * in the document flow. Controlled (`open` prop) or uncontrolled.
 */
export function IrisAlert(props: IrisAlertProps): JSX.Element {
  const merged = mergeProps({ tone: 'info' as IrisAlertTone, closable: false }, props)
  const [local, rest] = splitProps(merged, [
    'tone',
    'title',
    'closable',
    'open',
    'onClose',
    'onUpdate:open',
    'icon',
    'style',
    'children',
  ])

  const { t } = useI18n()

  const [internalOpen, setInternalOpen] = createSignal(true)
  const isControlled = () => local.open !== undefined
  const isOpen = () => (isControlled() ? local.open : internalOpen())

  const onClose = () => {
    if (!isControlled()) setInternalOpen(false)
    local['onUpdate:open']?.(false)
    local.onClose?.()
  }

  const tonalVar = () => `var(${TONE_TO_VAR[local.tone]})`

  return (
    <Show when={isOpen()}>
      <div
        {...rest}
        role={local.tone === 'danger' || local.tone === 'warning' ? 'alert' : 'status'}
        data-iris-alert=""
        data-iris-alert-tone={local.tone}
        style={{
          display: 'flex',
          gap: 'var(--iris-gap-md, 12px)',
          padding: 'var(--iris-padding-md, 12px)',
          'border-radius': 'var(--iris-radius-md, 6px)',
          border: `1px solid ${tonalVar()}`,
          // `background-color` is the precomputed fallback under color-mix (engines
          // without it); the `background` shorthand overrides with the exact mix.
          'background-color': `var(${TONE_TO_VAR[local.tone]}-subtle)`,
          background: `color-mix(in srgb, ${tonalVar()} 10%, var(--iris-background))`,
          color: 'var(--iris-foreground)',
          'align-items': 'flex-start',
          ...((local.style as JSX.CSSProperties) ?? {}),
        }}
      >
        <Show when={local.icon}>
          <span
            data-iris-alert-icon=""
            style={{ color: tonalVar(), 'flex-shrink': '0', display: 'inline-flex' }}
          >
            {local.icon}
          </span>
        </Show>
        <div data-iris-alert-body="" style={{ flex: '1', 'min-width': '0' }}>
          <Show when={local.title}>
            <div
              data-iris-alert-title=""
              style={{ 'font-weight': '600', 'margin-bottom': '4px', color: tonalVar() }}
            >
              {local.title}
            </div>
          </Show>
          <div data-iris-alert-content="">{local.children}</div>
        </div>
        <Show when={local.closable}>
          <button
            type="button"
            data-iris-alert-close=""
            aria-label={t('alert.close')}
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--iris-muted)',
              'font-size': '16px',
              padding: '0',
              'line-height': '1',
              'flex-shrink': '0',
            }}
          >
            ✕
          </button>
        </Show>
      </div>
    </Show>
  )
}
