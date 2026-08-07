import * as React from 'react'

export type IrisTimelineVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface IrisTimelineItem {
  /** Stable key; falls back to the index. */
  key?: string | number
  title?: React.ReactNode
  description?: React.ReactNode
  /** Timestamp / meta line shown above the title. */
  time?: React.ReactNode
  /** Dot variant (maps to a theme color). */
  variant?: IrisTimelineVariant
  /** Explicit dot color, overriding `variant`. */
  color?: string
}

export interface IrisTimelineProps {
  items: IrisTimelineItem[]
  /** Replace the default content (time/title/description) for every item. */
  renderItem?: (item: IrisTimelineItem, index: number) => React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const VARIANT_COLOR: Record<IrisTimelineVariant, string> = {
  default: 'var(--iris-primary)',
  success: 'var(--iris-success, #10b981)',
  warning: 'var(--iris-warning, #f59e0b)',
  danger: 'var(--iris-danger)',
  info: 'var(--iris-info, #3b82f6)',
}

/**
 * Vertical event timeline: an ordered list of items, each with a colored dot,
 * a connector line (omitted on the last item), and time/title/description
 * content (or a custom `renderItem`). Semantic `<ol>` for assistive tech;
 * RTL-safe via logical properties.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisTimeline}.
 */
export function IrisTimeline({
  items,
  renderItem,
  style,
  className,
  ...rest
}: IrisTimelineProps): React.ReactElement {
  return (
    <ol
      data-iris-timeline=""
      className={className}
      {...rest}
      style={{ listStyle: 'none', margin: 0, padding: 0, ...style }}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        const variant = item.variant ?? 'default'
        const dotColor = item.color ?? VARIANT_COLOR[variant]
        return (
          <li
            key={item.key ?? i}
            data-iris-timeline-item=""
            data-variant={variant}
            style={{ display: 'flex', gap: 12, position: 'relative' }}
          >
            <div
              data-iris-timeline-marker=""
              aria-hidden="true"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                alignSelf: 'stretch',
              }}
            >
              <span
                data-iris-timeline-dot=""
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: dotColor,
                  flexShrink: 0,
                  marginBlockStart: 4,
                  boxShadow: '0 0 0 3px var(--iris-background)',
                }}
              />
              {!isLast ? (
                <span
                  data-iris-timeline-line=""
                  style={{
                    flex: 1,
                    width: 2,
                    background: 'var(--iris-border)',
                    marginBlockStart: 4,
                  }}
                />
              ) : null}
            </div>
            <div
              data-iris-timeline-content=""
              style={{ paddingBlockEnd: isLast ? 0 : 16, minWidth: 0 }}
            >
              {renderItem ? (
                renderItem(item, i)
              ) : (
                <>
                  {item.time != null ? (
                    <div
                      data-iris-timeline-time=""
                      style={{
                        fontSize: 'var(--iris-font-size-xs, 12px)',
                        color: 'var(--iris-muted)',
                      }}
                    >
                      {item.time}
                    </div>
                  ) : null}
                  {item.title != null ? (
                    <div
                      data-iris-timeline-title=""
                      style={{ fontWeight: 600, color: 'var(--iris-foreground)' }}
                    >
                      {item.title}
                    </div>
                  ) : null}
                  {item.description != null ? (
                    <div
                      data-iris-timeline-desc=""
                      style={{
                        fontSize: 'var(--iris-font-size-md, 14px)',
                        color: 'var(--iris-foreground)',
                      }}
                    >
                      {item.description}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
