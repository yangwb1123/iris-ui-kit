import { For, mergeProps, Show, splitProps, type JSX } from 'solid-js'

export type IrisTimelineVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface IrisTimelineItem {
  key?: string | number
  title?: string
  description?: string
  time?: string
  variant?: IrisTimelineVariant
  color?: string
}

const VARIANT_COLOR: Record<IrisTimelineVariant, string> = {
  default: 'var(--iris-primary)',
  success: 'var(--iris-success, #10b981)',
  warning: 'var(--iris-warning, #f59e0b)',
  danger: 'var(--iris-danger)',
  info: 'var(--iris-info, #3b82f6)',
}

export interface IrisTimelineProps {
  items?: IrisTimelineItem[]
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Vertical event timeline. Solid port of the Vue/React IrisTimeline.
 */
export function IrisTimeline(props: IrisTimelineProps): JSX.Element {
  const merged = mergeProps({ items: [] as IrisTimelineItem[] }, props)
  const [local, rest] = splitProps(merged, ['items'])

  return (
    <ol
      {...rest}
      data-iris-timeline=""
      style={{
        'list-style': 'none',
        margin: '0',
        padding: '0',
        ...((rest.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <For each={local.items}>
        {(item, i) => {
          const isLast = (): boolean => i() === local.items.length - 1
          const variant = item.variant ?? 'default'
          const dotColor = item.color ?? VARIANT_COLOR[variant]

          return (
            <li
              data-iris-timeline-item=""
              data-variant={variant}
              style={{ display: 'flex', gap: '12px', position: 'relative' }}
            >
              <div
                data-iris-timeline-marker=""
                aria-hidden="true"
                style={{
                  display: 'flex',
                  'flex-direction': 'column',
                  'align-items': 'center',
                  'align-self': 'stretch',
                }}
              >
                <span
                  data-iris-timeline-dot=""
                  style={{
                    width: '12px',
                    height: '12px',
                    'border-radius': '50%',
                    background: dotColor,
                    'flex-shrink': '0',
                    'margin-block-start': '4px',
                    'box-shadow': '0 0 0 3px var(--iris-background)',
                  }}
                />
                <Show when={!isLast()}>
                  <span
                    data-iris-timeline-line=""
                    style={{
                      flex: '1',
                      width: '2px',
                      background: 'var(--iris-border)',
                      'margin-block-start': '4px',
                    }}
                  />
                </Show>
              </div>
              <div
                data-iris-timeline-content=""
                style={{ 'padding-block-end': isLast() ? '0' : '16px', 'min-width': '0' }}
              >
                {item.time != null && (
                  <div
                    data-iris-timeline-time=""
                    style={{
                      'font-size': 'var(--iris-font-size-xs, 12px)',
                      color: 'var(--iris-muted)',
                    }}
                  >
                    {item.time}
                  </div>
                )}
                {item.title != null && (
                  <div
                    data-iris-timeline-title=""
                    style={{ 'font-weight': '600', color: 'var(--iris-foreground)' }}
                  >
                    {item.title}
                  </div>
                )}
                {item.description != null && (
                  <div
                    data-iris-timeline-desc=""
                    style={{
                      'font-size': 'var(--iris-font-size-md, 14px)',
                      color: 'var(--iris-foreground)',
                    }}
                  >
                    {item.description}
                  </div>
                )}
              </div>
            </li>
          )
        }}
      </For>
    </ol>
  )
}
