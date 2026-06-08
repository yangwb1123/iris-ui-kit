import { mergeProps, Show, splitProps, type JSX } from 'solid-js'

export type IrisResultStatus = 'success' | 'error' | 'info' | 'warning'

const STATUS: Record<IrisResultStatus, { color: string; glyph: string }> = {
  success: { color: 'var(--iris-success, #16a34a)', glyph: '✓' },
  error: { color: 'var(--iris-danger)', glyph: '✕' },
  info: { color: 'var(--iris-info, #0ea5e9)', glyph: 'i' },
  warning: { color: 'var(--iris-warning, #f59e0b)', glyph: '!' },
}

export interface IrisResultProps extends JSX.HTMLAttributes<HTMLDivElement> {
  status?: IrisResultStatus
  title?: string
  subtitle?: string
  icon?: JSX.Element
  extra?: JSX.Element
  children?: JSX.Element
}

/**
 * Result: a centered outcome page for an operation — a status icon, title,
 * subtitle, action area (extra prop), and optional content. Use for
 * success / error / 404 / 403 / 500 screens.
 */
export function IrisResult(props: IrisResultProps): JSX.Element {
  const merged = mergeProps({ status: 'info' as IrisResultStatus }, props)
  const [local, rest] = splitProps(merged, [
    'status',
    'title',
    'subtitle',
    'icon',
    'extra',
    'style',
    'children',
  ])

  const s = () => STATUS[local.status]

  return (
    <div
      {...rest}
      data-iris-result=""
      data-status={local.status}
      style={{
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        'text-align': 'center',
        gap: '8px',
        padding: '32px 16px',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <div
        data-iris-result-icon=""
        aria-hidden="true"
        style={{
          width: '56px',
          height: '56px',
          'border-radius': '50%',
          display: 'inline-flex',
          'align-items': 'center',
          'justify-content': 'center',
          'font-size': '30px',
          'font-weight': '700',
          color: '#fff',
          background: s().color,
          'margin-block-end': '8px',
        }}
      >
        {local.icon ?? s().glyph}
      </div>
      <Show when={local.title != null}>
        <div
          data-iris-result-title=""
          style={{ 'font-size': '20px', 'font-weight': '600', color: 'var(--iris-foreground)' }}
        >
          {local.title}
        </div>
      </Show>
      <Show when={local.subtitle != null}>
        <div
          data-iris-result-subtitle=""
          style={{ 'font-size': '14px', color: 'var(--iris-muted)', 'max-width': '480px' }}
        >
          {local.subtitle}
        </div>
      </Show>
      <Show when={local.children}>
        <div data-iris-result-content="" style={{ 'margin-block-start': '8px', width: '100%' }}>
          {local.children}
        </div>
      </Show>
      <Show when={local.extra}>
        <div
          data-iris-result-extra=""
          style={{
            'margin-block-start': '8px',
            display: 'inline-flex',
            gap: '8px',
            'flex-wrap': 'wrap',
            'justify-content': 'center',
          }}
        >
          {local.extra}
        </div>
      </Show>
    </div>
  )
}
