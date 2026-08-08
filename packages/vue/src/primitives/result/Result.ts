import { defineComponent, h, type PropType } from 'vue'

export type IrisResultStatus = 'success' | 'error' | 'info' | 'warning'

const STATUS: Record<IrisResultStatus, { color: string; glyph: string }> = {
  success: { color: 'var(--iris-success, #10b981)', glyph: '✓' },
  error: { color: 'var(--iris-danger)', glyph: '✕' },
  info: { color: 'var(--iris-info, #0ea5e9)', glyph: 'i' },
  warning: { color: 'var(--iris-warning, #f59e0b)', glyph: '!' },
}

/**
 * Result: a centered outcome page for an operation — a status icon, title,
 * subtitle, action area (`#extra`), and optional content (default slot). Use
 * for success / error / 404 / 403 / 500 screens. Pass `#icon` to override the
 * status glyph. Pure presentation; the glyph is decorative.
 */
export const IrisResult = defineComponent({
  name: 'IrisResult',
  inheritAttrs: false,
  props: {
    status: { type: String as PropType<IrisResultStatus>, default: 'info' },
    title: { type: String, default: undefined },
    subtitle: { type: String, default: undefined },
  },
  setup(props, { attrs, slots }) {
    return () => {
      const s = STATUS[props.status]
      const children = [
        h(
          'div',
          {
            'data-iris-result-icon': '',
            'aria-hidden': 'true',
            style: {
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--iris-font-size-4xl, 30px)',
              fontWeight: '700',
              color: 'var(--iris-primary-foreground, #fff)',
              background: s.color,
              marginBlockEnd: '8px',
            },
          },
          slots.icon ? slots.icon() : s.glyph,
        ),
        props.title != null
          ? h(
              'div',
              {
                'data-iris-result-title': '',
                style: {
                  fontSize: 'var(--iris-font-size-2xl, 20px)',
                  fontWeight: '600',
                  color: 'var(--iris-foreground)',
                },
              },
              props.title,
            )
          : null,
        props.subtitle != null
          ? h(
              'div',
              {
                'data-iris-result-subtitle': '',
                style: {
                  fontSize: 'var(--iris-font-size-md, 14px)',
                  color: 'var(--iris-muted)',
                  maxWidth: '480px',
                },
              },
              props.subtitle,
            )
          : null,
        slots.default
          ? h(
              'div',
              { 'data-iris-result-content': '', style: { marginBlockStart: '8px', width: '100%' } },
              slots.default(),
            )
          : null,
        slots.extra
          ? h(
              'div',
              {
                'data-iris-result-extra': '',
                style: {
                  marginBlockStart: '8px',
                  display: 'inline-flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                },
              },
              slots.extra(),
            )
          : null,
      ]

      return h(
        'div',
        {
          ...attrs,
          'data-iris-result': '',
          'data-status': props.status,
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '8px',
            padding: '32px 16px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        children,
      )
    }
  },
})
