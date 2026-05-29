import { defineComponent, h } from 'vue'

/**
 * Fieldset: a semantic `<fieldset>` / `<legend>` form grouping. `disabled` uses
 * the native fieldset behavior that cascades to every nested form control —
 * accessible by construction. Pass `#legend` for a rich legend.
 */
export const IrisFieldset = defineComponent({
  name: 'IrisFieldset',
  inheritAttrs: false,
  props: {
    legend: { type: String, default: undefined },
    /** Disables the whole group (native fieldset disabling propagates). */
    disabled: { type: Boolean, default: false },
    hint: { type: String, default: undefined },
  },
  setup(props, { attrs, slots }) {
    return () => {
      const legendNode =
        slots.legend || props.legend != null
          ? h(
              'legend',
              {
                'data-iris-fieldset-legend': '',
                style: {
                  padding: '0 6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--iris-foreground)',
                },
              },
              slots.legend ? slots.legend() : props.legend,
            )
          : null
      const hintNode =
        props.hint != null
          ? h(
              'div',
              {
                'data-iris-fieldset-hint': '',
                style: { fontSize: '12px', color: 'var(--iris-muted)', marginBlockEnd: '8px' },
              },
              props.hint,
            )
          : null

      return h(
        'fieldset',
        {
          ...attrs,
          'data-iris-fieldset': '',
          disabled: props.disabled || undefined,
          style: {
            minInlineSize: '0',
            margin: '0',
            padding: '16px',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            opacity: props.disabled ? '0.6' : '1',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [legendNode, hintNode, slots.default?.()],
      )
    }
  },
})
