import { Fragment, cloneVNode, computed, defineComponent, h, useId, type VNode } from 'vue'

/**
 * Form-field wrapper that handles the label / hint / error trio with the
 * right a11y plumbing. Works as a non-invasive wrapper around any input-like
 * primitive (`IrisInput`, `IrisTextarea`, `IrisSelect`, `IrisNumberInput`,
 * `IrisSwitch`, `IrisCheckbox`, …): it locates the first VNode in the
 * default slot and clones it with the generated `id`, `aria-describedby`,
 * and `aria-invalid` attributes.
 *
 * Composition:
 *
 * ```html
 * <IrisFormField label="Email" :error="errors.email" hint="We never share it.">
 *   <IrisInput v-model="email" />
 * </IrisFormField>
 * ```
 *
 * Pass `labelFor` if you want to pin the rendered `<label for>` to a
 * specific id (e.g. when the wrapped control is a custom non-`<input>`
 * widget).
 */
export const IrisFormField = defineComponent({
  name: 'IrisFormField',
  inheritAttrs: false,
  props: {
    label: { type: String, default: '' },
    hint: { type: String, default: '' },
    error: { type: String, default: '' },
    required: { type: Boolean, default: false },
    /** Override the auto-generated control id. */
    labelFor: { type: String, default: '' },
    /** Visual size of the label. */
    size: { type: String as () => 'sm' | 'md', default: 'md' },
  },
  setup(props, { slots, attrs }) {
    const baseId = useId()
    const controlId = computed(() => props.labelFor || `${baseId}-control`)
    const hintId = `${baseId}-hint`
    const errorId = `${baseId}-error`

    const describedBy = computed(() => {
      const ids: string[] = []
      if (props.hint) ids.push(hintId)
      if (props.error) ids.push(errorId)
      return ids.length > 0 ? ids.join(' ') : undefined
    })

    const labelStyle = computed<Record<string, string>>(() => ({
      fontSize: props.size === 'sm' ? '12px' : '14px',
      fontWeight: '500',
      color: props.error ? 'var(--iris-danger)' : 'var(--iris-foreground)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }))

    return () => {
      const children = (slots.default?.() ?? []) as VNode[]
      // Find the first non-text VNode and inject id + aria-*.
      let injected: VNode | null = null
      const restChildren: (VNode | null)[] = []
      let foundFirst = false
      children.forEach((child) => {
        if (!foundFirst && typeof child.type !== 'symbol' && typeof child.type !== 'string') {
          // Pass props that ALL Iris field primitives understand:
          //   - id          → forwarded to the native control
          //   - invalid     → flips aria-invalid + invalid styling
          //   - ariaDescribedby → forwarded as aria-describedby on the native control
          injected = cloneVNode(child, {
            id: controlId.value,
            invalid: props.error ? true : undefined,
            ariaDescribedby: describedBy.value,
          })
          foundFirst = true
        } else {
          restChildren.push(child)
        }
      })

      return h(
        'div',
        {
          ...attrs,
          'data-iris-form-field': '',
          'data-iris-form-field-state': props.error ? 'invalid' : 'valid',
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          props.label
            ? h(
                'label',
                {
                  for: controlId.value,
                  'data-iris-form-field-label': '',
                  style: labelStyle.value,
                },
                [
                  props.label,
                  props.required
                    ? h(
                        'span',
                        {
                          'aria-hidden': 'true',
                          'data-iris-form-field-required': '',
                          style: { color: 'var(--iris-danger)' },
                        },
                        '*',
                      )
                    : null,
                ],
              )
            : null,
          // The wrapped control + any trailing siblings.
          h(Fragment, null, [injected, ...restChildren]),
          props.hint && !props.error
            ? h(
                'div',
                {
                  id: hintId,
                  'data-iris-form-field-hint': '',
                  style: { fontSize: '12px', color: 'var(--iris-muted)' },
                },
                props.hint,
              )
            : null,
          props.error
            ? h(
                'div',
                {
                  id: errorId,
                  'data-iris-form-field-error': '',
                  role: 'alert',
                  style: { fontSize: '12px', color: 'var(--iris-danger)' },
                },
                props.error,
              )
            : null,
        ],
      )
    }
  },
})
