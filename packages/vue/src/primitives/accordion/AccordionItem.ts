import { computed, defineComponent, h, inject } from 'vue'
import { AccordionContextKey } from './context'

/**
 * A single accordion section: a button-styled header + a collapsible body.
 *
 * Wires the WAI-ARIA accordion pattern: `aria-expanded` on the trigger,
 * `aria-controls` pointing at the region, and the region has `role="region"`
 * + `aria-labelledby` referencing the trigger.
 */
export const IrisAccordionItem = defineComponent({
  name: 'IrisAccordionItem',
  inheritAttrs: false,
  props: {
    value: { type: String, required: true },
    /** Static title text. Overridden by the `title` slot when provided. */
    title: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(AccordionContextKey)
    if (!ctx) {
      throw new Error('IrisAccordionItem must be used inside <IrisAccordion>')
    }

    const open = computed(() => ctx.isOpen(props.value))
    const headerId = `${ctx.rootId}-h-${props.value}`
    const contentId = `${ctx.rootId}-c-${props.value}`

    const onTrigger = () => {
      if (props.disabled) return
      ctx.toggle(props.value)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (props.disabled) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        ctx.toggle(props.value)
      }
    }

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-accordion-item': '',
          'data-state': open.value ? 'open' : 'closed',
          'data-disabled': props.disabled ? 'true' : undefined,
          style: {
            borderBottom: '1px solid var(--iris-border)',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'button',
            {
              type: 'button',
              id: headerId,
              'data-iris-accordion-trigger': '',
              'aria-expanded': open.value ? 'true' : 'false',
              'aria-controls': contentId,
              disabled: props.disabled || undefined,
              onClick: onTrigger,
              onKeydown: onKeyDown,
              style: {
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: 'var(--iris-padding-md, 12px)',
                background: 'transparent',
                color: 'var(--iris-foreground)',
                border: 'none',
                cursor: props.disabled ? 'not-allowed' : 'pointer',
                opacity: props.disabled ? '0.6' : '1',
                font: 'inherit',
                textAlign: 'left',
              },
            },
            [
              h(
                'span',
                { 'data-iris-accordion-title': '', style: { flex: '1', minWidth: '0' } },
                slots.title?.() ?? props.title,
              ),
              h(
                'span',
                {
                  'aria-hidden': 'true',
                  'data-iris-accordion-chevron': '',
                  style: {
                    transition: 'transform 160ms ease',
                    transform: open.value ? 'rotate(180deg)' : 'rotate(0deg)',
                    color: 'var(--iris-muted)',
                  },
                },
                '⌄',
              ),
            ],
          ),
          open.value
            ? h(
                'div',
                {
                  role: 'region',
                  id: contentId,
                  'aria-labelledby': headerId,
                  'data-iris-accordion-content': '',
                  style: { padding: '0 var(--iris-padding-md, 12px) var(--iris-padding-md, 12px)' },
                },
                slots.default?.(),
              )
            : null,
        ],
      )
  },
})
