import { computed, defineComponent, h, type PropType } from 'vue'
import type { Size } from '@iris-ui-kit/core'

export type IrisSwitchSize = Size

/**
 * Two-state toggle. Backed by a native checkbox for keyboard and form
 * compatibility; the visible markup is a styled pill driven by `checked`.
 *
 * The native checkbox is visually hidden but focusable — focus styles ride
 * on the wrapping label via `:focus-within`.
 */
export const IrisSwitch = defineComponent({
  name: 'IrisSwitch',
  inheritAttrs: false,
  props: {
    modelValue: { type: Boolean, default: false },
    size: { type: String as PropType<IrisSwitchSize>, default: 'md' },
    disabled: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    /** Optional name attribute on the underlying checkbox (for form submission). */
    name: { type: String, default: undefined },
    /** Forwarded as `aria-describedby` on the inner <input>. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
    /** Invalid state — sets aria-invalid. Set by IrisFormField. */
    invalid: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: boolean) => true,
    change: (_value: boolean) => true,
  },
  setup(props, { attrs, emit }) {
    const dims = computed(() => {
      const map: Record<IrisSwitchSize, { width: string; height: string; thumb: string }> = {
        sm: { width: '28px', height: '16px', thumb: '12px' },
        md: { width: '36px', height: '20px', thumb: '16px' },
        lg: { width: '44px', height: '24px', thumb: '20px' },
      }
      return map[props.size]
    })

    const trackStyle = computed<Record<string, string>>(() => ({
      position: 'relative',
      display: 'inline-block',
      width: dims.value.width,
      height: dims.value.height,
      background: props.modelValue ? 'var(--iris-primary)' : 'var(--iris-border)',
      borderRadius: '999px',
      transition: 'background-color var(--iris-transition-fast, 150ms) ease',
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      opacity: props.disabled ? '0.6' : '1',
      verticalAlign: 'middle',
    }))

    const thumbStyle = computed<Record<string, string>>(() => {
      const offset = props.modelValue
        ? `calc(${dims.value.width} - ${dims.value.thumb} - 2px)`
        : '2px'
      return {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        left: offset,
        width: dims.value.thumb,
        height: dims.value.thumb,
        background: 'var(--iris-background)',
        borderRadius: '999px',
        transition: 'left var(--iris-transition-fast, 150ms) ease',
        boxShadow: 'var(--iris-shadow-sm)',
      }
    })

    const onChange = (event: Event) => {
      const next = (event.target as HTMLInputElement).checked
      emit('update:modelValue', next)
      emit('change', next)
    }

    return () =>
      h(
        'label',
        {
          ...attrs,
          'data-iris-switch': '',
          'data-iris-switch-size': props.size,
          'data-state': props.modelValue ? 'checked' : 'unchecked',
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
            role: 'switch',
            id: props.id,
            name: props.name,
            checked: props.modelValue,
            disabled: props.disabled || undefined,
            'aria-checked': props.modelValue ? 'true' : 'false',
            'aria-describedby': props.ariaDescribedby,
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
          h('span', { 'aria-hidden': 'true', style: trackStyle.value }, [
            h('span', { style: thumbStyle.value }),
          ]),
        ],
      )
  },
})
