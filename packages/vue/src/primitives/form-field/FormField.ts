import {
  Fragment,
  cloneVNode,
  computed,
  defineComponent,
  h,
  useId,
  type PropType,
  type VNode,
} from 'vue'
import { resolveFormFieldLayout, type FormFieldLabelPlacement } from '@iris-ui-kit/core'
import { normalizeHostStyle } from '../../internal/control-attrs'

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
 *
 * Layout is declarative — `labelPlacement`, `labelWidth`, `controlWidth` and
 * `fullWidth` exist in all four adapters and the decisions live in core
 * (`resolveFormFieldLayout`). Horizontal fields group the control with its
 * hint/error in a `data-iris-form-field-control` wrapper; that wrapper is only
 * emitted when a layout prop asks for it, so a plain field keeps its DOM.
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
    /** Label above the control (default) or beside it. */
    labelPlacement: { type: String as () => FormFieldLabelPlacement, default: 'top' },
    /** Width of the label column — a number is read as px. Labels wrap inside it. */
    labelWidth: { type: [String, Number] as PropType<string | number>, default: undefined },
    /** Width of the control area (control + hint/error); a number is read as px. */
    controlWidth: { type: [String, Number] as PropType<string | number>, default: undefined },
    /** Stretch the field (and its control area) to the container width. */
    fullWidth: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const baseId = useId()
    const controlId = computed(() => props.labelFor || `${baseId}-control`)
    const hintId = `${baseId}-hint`
    const errorId = `${baseId}-error`

    const describedBy = computed(() => {
      const ids: string[] = []
      // The hint node is only rendered when there is no error (the error
      // replaces it), so referencing it while an error is showing would point
      // aria-describedby at an element that does not exist. Mirrors React.
      if (props.hint && !props.error) ids.push(hintId)
      if (props.error) ids.push(errorId)
      return ids.length > 0 ? ids.join(' ') : undefined
    })

    const layout = computed(() =>
      resolveFormFieldLayout({
        labelPlacement: props.labelPlacement,
        labelWidth: props.labelWidth,
        controlWidth: props.controlWidth,
        fullWidth: props.fullWidth,
      }),
    )

    const labelStyle = computed<Record<string, string>>(() => ({
      fontSize:
        props.size === 'sm' ? 'var(--iris-font-size-xs, 12px)' : 'var(--iris-font-size-md, 14px)',
      fontWeight: '500',
      color: props.error ? 'var(--iris-danger)' : 'var(--iris-foreground)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      ...layout.value.label,
    }))

    const hintNode = () =>
      props.hint && !props.error
        ? h(
            'div',
            {
              id: hintId,
              'data-iris-form-field-hint': '',
              style: {
                fontSize: 'var(--iris-font-size-xs, 12px)',
                color: 'var(--iris-muted)',
              },
            },
            props.hint,
          )
        : null

    const errorNode = () =>
      props.error
        ? h(
            'div',
            {
              id: errorId,
              'data-iris-form-field-error': '',
              role: 'alert',
              style: { fontSize: 'var(--iris-font-size-xs, 12px)', color: 'var(--iris-danger)' },
            },
            props.error,
          )
        : null

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
          ...(layout.value.placement === 'top'
            ? {}
            : { 'data-iris-form-field-placement': layout.value.placement }),
          style: {
            ...layout.value.root,
            ...normalizeHostStyle(attrs.style),
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
          // The control area: grouped under its own wrapper when a layout prop
          // asks for one (horizontal fields keep help/error under the control).
          layout.value.grouped
            ? h('div', { 'data-iris-form-field-control': '', style: { ...layout.value.control } }, [
                // The wrapped control + any trailing siblings.
                h(Fragment, null, [injected, ...restChildren]),
                hintNode(),
                errorNode(),
              ])
            : h(Fragment, null, [
                // The wrapped control + any trailing siblings.
                h(Fragment, null, [injected, ...restChildren]),
                hintNode(),
                errorNode(),
              ]),
        ],
      )
    }
  },
})
