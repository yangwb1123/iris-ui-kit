import { mergeProps, Show, splitProps, type JSX } from 'solid-js'

export interface IrisEmptyStateProps extends JSX.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  icon?: JSX.Element
  action?: JSX.Element
  children?: JSX.Element
}

/**
 * Placeholder shown when a list / table / page has no content.
 * Centered column layout with optional icon, title, description, and action slot.
 */
export function IrisEmptyState(props: IrisEmptyStateProps): JSX.Element {
  const merged = mergeProps({ title: '', description: '' }, props)
  const [local, rest] = splitProps(merged, [
    'title',
    'description',
    'icon',
    'action',
    'style',
    'children',
  ])

  return (
    <div
      {...rest}
      role="status"
      data-iris-empty-state=""
      style={{
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        'justify-content': 'center',
        gap: '12px',
        padding: '32px 16px',
        'text-align': 'center',
        color: 'var(--iris-foreground)',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <Show when={local.icon}>
        <div
          data-iris-empty-state-icon=""
          style={{
            color: 'var(--iris-muted)',
            'font-size': 'var(--iris-font-size-4xl, 30px)',
            'line-height': '1',
          }}
        >
          {local.icon}
        </div>
      </Show>
      <Show when={local.title || local.children}>
        <div
          data-iris-empty-state-title=""
          style={{ 'font-weight': '600', 'font-size': 'var(--iris-font-size-lg, 16px)' }}
        >
          {local.children ?? local.title}
        </div>
      </Show>
      <Show when={local.description}>
        <div
          data-iris-empty-state-description=""
          style={{
            color: 'var(--iris-muted)',
            'font-size': 'var(--iris-font-size-md, 14px)',
            'max-width': '380px',
          }}
        >
          {local.description}
        </div>
      </Show>
      <Show when={local.action}>
        <div data-iris-empty-state-action="" style={{ 'margin-top': '4px' }}>
          {local.action}
        </div>
      </Show>
    </div>
  )
}
