import { defineComponent, h, type PropType } from 'vue'

export type IrisTimelineVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface IrisTimelineItem {
  /** Stable key; falls back to the index. */
  key?: string | number
  title?: string
  description?: string
  /** Timestamp / meta line shown above the title. */
  time?: string
  /** Dot variant (maps to a theme color). */
  variant?: IrisTimelineVariant
  /** Explicit dot color, overriding `variant`. */
  color?: string
}

const VARIANT_COLOR: Record<IrisTimelineVariant, string> = {
  default: 'var(--iris-primary)',
  success: 'var(--iris-success, #10b981)',
  warning: 'var(--iris-warning, #f59e0b)',
  danger: 'var(--iris-danger)',
  info: 'var(--iris-info, #0ea5e9)',
}

/**
 * Vertical event timeline: an ordered list of items, each with a colored dot,
 * a connector line (omitted on the last item), and time/title/description
 * content. Pass `#item` for custom content. Semantic `<ol>` for assistive
 * tech; RTL-safe via logical properties.
 */
export const IrisTimeline = defineComponent({
  name: 'IrisTimeline',
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<IrisTimelineItem[]>, default: () => [] },
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        'ol',
        {
          ...attrs,
          'data-iris-timeline': '',
          style: {
            listStyle: 'none',
            margin: '0',
            padding: '0',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        props.items.map((item, i) => {
          const isLast = i === props.items.length - 1
          const variant = item.variant ?? 'default'
          const dotColor = item.color ?? VARIANT_COLOR[variant]
          return h(
            'li',
            {
              key: item.key ?? i,
              'data-iris-timeline-item': '',
              'data-variant': variant,
              style: { display: 'flex', gap: '12px', position: 'relative' },
            },
            [
              h(
                'div',
                {
                  'data-iris-timeline-marker': '',
                  'aria-hidden': 'true',
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    alignSelf: 'stretch',
                  },
                },
                [
                  h('span', {
                    'data-iris-timeline-dot': '',
                    style: {
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: dotColor,
                      flexShrink: '0',
                      marginBlockStart: '4px',
                      boxShadow: '0 0 0 3px var(--iris-background)',
                    },
                  }),
                  !isLast
                    ? h('span', {
                        'data-iris-timeline-line': '',
                        style: {
                          flex: '1',
                          width: '2px',
                          background: 'var(--iris-border)',
                          marginBlockStart: '4px',
                        },
                      })
                    : null,
                ],
              ),
              h(
                'div',
                {
                  'data-iris-timeline-content': '',
                  style: { paddingBlockEnd: isLast ? '0' : '16px', minWidth: '0' },
                },
                slots.item
                  ? slots.item({ item, index: i })
                  : [
                      item.time != null
                        ? h(
                            'div',
                            {
                              'data-iris-timeline-time': '',
                              style: {
                                fontSize: 'var(--iris-font-size-xs, 12px)',
                                color: 'var(--iris-muted)',
                              },
                            },
                            item.time,
                          )
                        : null,
                      item.title != null
                        ? h(
                            'div',
                            {
                              'data-iris-timeline-title': '',
                              style: { fontWeight: '600', color: 'var(--iris-foreground)' },
                            },
                            item.title,
                          )
                        : null,
                      item.description != null
                        ? h(
                            'div',
                            {
                              'data-iris-timeline-desc': '',
                              style: {
                                fontSize: 'var(--iris-font-size-md, 14px)',
                                color: 'var(--iris-foreground)',
                              },
                            },
                            item.description,
                          )
                        : null,
                    ],
              ),
            ],
          )
        }),
      )
  },
})
