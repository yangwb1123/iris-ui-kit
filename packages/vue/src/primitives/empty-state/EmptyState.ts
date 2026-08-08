import { defineComponent, h } from 'vue'

/**
 * Placeholder shown when a list / table / page has no content. Centered
 * column layout with optional icon, title, description, and an action slot
 * (typically a "Create new" button).
 */
export const IrisEmptyState = defineComponent({
  name: 'IrisEmptyState',
  inheritAttrs: false,
  props: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  setup(props, { slots, attrs }) {
    return () => {
      const icon = slots.icon?.()
      const action = slots.action?.()
      const titleNode = slots.title?.() ?? (props.title || null)
      const descNode = slots.description?.() ?? (props.description || null)

      return h(
        'div',
        {
          ...attrs,
          role: 'status',
          'data-iris-empty-state': '',
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '32px 16px',
            textAlign: 'center',
            color: 'var(--iris-foreground)',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          icon
            ? h(
                'div',
                {
                  'data-iris-empty-state-icon': '',
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--iris-radius-lg, 12px)',
                    background: 'var(--iris-surface)',
                    color: 'var(--iris-muted)',
                    opacity: '0.9',
                    fontSize: 'var(--iris-font-size-2xl, 20px)',
                    lineHeight: '1',
                  },
                },
                icon,
              )
            : null,
          titleNode
            ? h(
                'div',
                {
                  'data-iris-empty-state-title': '',
                  style: { fontWeight: '600', fontSize: 'var(--iris-font-size-lg, 16px)' },
                },
                titleNode,
              )
            : null,
          descNode
            ? h(
                'div',
                {
                  'data-iris-empty-state-description': '',
                  style: {
                    color: 'var(--iris-muted)',
                    fontSize: 'var(--iris-font-size-md, 14px)',
                    maxWidth: '380px',
                  },
                },
                descNode,
              )
            : null,
          action
            ? h('div', { 'data-iris-empty-state-action': '', style: { marginTop: '4px' } }, action)
            : null,
        ],
      )
    }
  },
})
