import { computed, defineComponent, h, type PropType } from 'vue'
import type { Size } from '@iris-ui-kit/core'

export type IrisCheckboxSize = Size
export type IrisCheckboxValue = boolean | 'indeterminate'

/**
 * Tri-state checkbox: `false` (unchecked), `true` (checked), or
 * `'indeterminate'`. The native checkbox is hidden but focusable; the
 * visible box is purely visual and mirrors the state via `data-state`.
 *
 * `v-model` emits `boolean` only — switching FROM indeterminate emits the
 * boolean the user chose by clicking (becomes `true`).
 */
export const IrisCheckbox = defineComponent({
  name: 'IrisCheckbox',
  inheritAttrs: false,
  props: {
    modelValue: {
      type: [Boolean, String] as PropType<IrisCheckboxValue>,
      default: false,
    },
    size: { type: String as PropType<IrisCheckboxSize>, default: 'md' },
    disabled: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    name: { type: String, default: undefined },
    value: { type: [String, Number] as PropType<string | number>, default: undefined },
    /** Forwarded as `aria-describedby` on the native checkbox input. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
    /**
     * Accessible name for the native checkbox input. Bound as `aria-label` on
     * the `<input>` itself (the element with the checkbox role), NOT the label
     * wrapper. Use when there is no visible label text.
     */
    ariaLabel: { type: String, default: undefined },
    /** Invalid state — sets aria-invalid. Set by IrisFormField. */
    invalid: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: boolean) => true,
    change: (_value: boolean) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const state = computed<'checked' | 'unchecked' | 'indeterminate'>(() => {
      if (props.modelValue === 'indeterminate') return 'indeterminate'
      return props.modelValue ? 'checked' : 'unchecked'
    })

    const dim = computed(() => {
      const map: Record<IrisCheckboxSize, string> = { sm: '14px', md: '18px', lg: '22px' }
      return map[props.size]
    })

    const boxStyle = computed<Record<string, string>>(() => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: dim.value,
      height: dim.value,
      borderRadius: 'var(--iris-radius-sm)',
      border: '1px solid var(--iris-border)',
      background: state.value === 'unchecked' ? 'var(--iris-background)' : 'var(--iris-primary)',
      borderColor: state.value === 'unchecked' ? 'var(--iris-border)' : 'var(--iris-primary)',
      color: 'var(--iris-primary-foreground)',
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      opacity: props.disabled ? '0.6' : '1',
      transition: 'background-color 120ms ease, border-color 120ms ease',
      verticalAlign: 'middle',
    }))

    const onChange = (event: Event) => {
      const next = (event.target as HTMLInputElement).checked
      emit('update:modelValue', next)
      emit('change', next)
    }

    const renderIndicator = () => {
      if (state.value === 'unchecked') return null
      if (state.value === 'indeterminate') {
        return h('span', {
          'aria-hidden': 'true',
          style: { width: '60%', height: '2px', background: 'currentColor', borderRadius: '1px' },
        })
      }
      return h(
        'svg',
        {
          'aria-hidden': 'true',
          viewBox: '0 0 16 16',
          width: '80%',
          height: '80%',
          fill: 'none',
        },
        [
          h('path', {
            d: 'M3 8.5 L6.5 12 L13 4.5',
            stroke: 'currentColor',
            'stroke-width': '2.4',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          }),
        ],
      )
    }

    return () =>
      h(
        'label',
        {
          ...attrs,
          'data-iris-checkbox': '',
          'data-iris-checkbox-size': props.size,
          'data-state': state.value,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--iris-gap-sm)',
            cursor: props.disabled ? 'not-allowed' : 'pointer',
            userSelect: 'none',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h('input', {
            type: 'checkbox',
            id: props.id,
            name: props.name,
            value: props.value,
            checked: props.modelValue === true,
            indeterminate: props.modelValue === 'indeterminate',
            disabled: props.disabled || undefined,
            'aria-checked':
              state.value === 'indeterminate'
                ? 'mixed'
                : state.value === 'checked'
                  ? 'true'
                  : 'false',
            'aria-describedby': props.ariaDescribedby,
            'aria-label': props.ariaLabel,
            'aria-invalid': props.invalid ? 'true' : undefined,
            style: {
              position: 'absolute',
              opacity: '0',
              width: '0',
              height: '0',
              pointerEvents: 'none',
            },
            onChange,
          }),
          h('span', { 'aria-hidden': 'true', style: boxStyle.value }, [renderIndicator()]),
          slots.default && h('span', null, slots.default()),
        ],
      )
  },
})
