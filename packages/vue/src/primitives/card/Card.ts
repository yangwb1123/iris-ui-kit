import { computed, defineComponent, h, type PropType } from 'vue'

const STYLE_ID = 'iris-card-styles'
let installed = false
function installCardStyles() {
  if (installed || typeof document === 'undefined') return
  installed = true
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
[data-iris-card-hover="true"]:hover {
  transform: translateY(-2px);
  box-shadow: var(--iris-shadow-lg);
}
`
  document.head.appendChild(style)
}
export type IrisCardVariant = 'elevated' | 'outline' | 'subtle'
export type IrisCardPadding = 'none' | 'sm' | 'md' | 'lg'

const PADDING_MAP: Record<IrisCardPadding, string> = {
  none: '0',
  sm: '12px',
  md: 'var(--iris-padding-lg, 20px)',
  lg: 'var(--iris-space-xl, 24px)',
}

/**
 * Card surface with three visual variants:
 *   - `elevated` — soft drop-shadow, no border (default).
 *   - `outline`  — bordered, no shadow.
 *   - `subtle`   — tinted surface, no border, no shadow.
 *
 * Slots: `header`, default body, `footer`. Slots are only rendered when
 * supplied (no empty wrapper divs).
 */
export const IrisCard = defineComponent({
  name: 'IrisCard',
  inheritAttrs: false,
  props: {
    variant: { type: String as PropType<IrisCardVariant>, default: 'elevated' },
    padding: { type: String as PropType<IrisCardPadding>, default: 'md' },
    hover: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    installCardStyles()
    const containerStyle = computed<Record<string, string>>(() => {
      const base: Record<string, string> = {
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        borderRadius: 'var(--iris-radius-md, 8px)',
        overflow: 'hidden',
        transition: props.hover ? 'transform 160ms ease, box-shadow 160ms ease' : 'none',
      }
      switch (props.variant) {
        case 'elevated':
          return { ...base, boxShadow: 'var(--iris-shadow-md)' }
        case 'outline':
          return { ...base, border: '1px solid var(--iris-border)' }
        case 'subtle':
          return { ...base, background: 'var(--iris-surface)' }
      }
    })

    return () => {
      const header = slots.header?.()
      const footer = slots.footer?.()
      const body = slots.default?.()

      const sectionPadding = PADDING_MAP[props.padding]

      return h(
        'div',
        {
          ...attrs,
          'data-iris-card': '',
          'data-iris-card-variant': props.variant,
          'data-iris-card-padding': props.padding,
          'data-iris-card-hover': props.hover ? 'true' : undefined,
          style: {
            ...containerStyle.value,
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          header
            ? h(
                'div',
                {
                  'data-iris-card-header': '',
                  style: {
                    padding: sectionPadding,
                    borderBottom: '1px solid var(--iris-border)',
                    fontWeight: '600',
                  },
                },
                header,
              )
            : null,
          body
            ? h(
                'div',
                {
                  'data-iris-card-body': '',
                  style: { padding: sectionPadding, flex: '1' },
                },
                body,
              )
            : null,
          footer
            ? h(
                'div',
                {
                  'data-iris-card-footer': '',
                  style: {
                    padding: sectionPadding,
                    borderTop: '1px solid var(--iris-border)',
                  },
                },
                footer,
              )
            : null,
        ],
      )
    }
  },
})
