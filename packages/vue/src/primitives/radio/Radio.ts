import {
  computed,
  defineComponent,
  h,
  inject,
  provide,
  useId,
  type ComputedRef,
  type InjectionKey,
  type PropType,
} from 'vue'
import { type Size } from '@iris-ui/core'

export type IrisRadioSize = Size

interface RadioGroupContext {
  name: string
  value: ComputedRef<string | number | boolean | null>
  setValue: (value: string | number | boolean) => void
  size: ComputedRef<IrisRadioSize>
  disabled: ComputedRef<boolean>
}

const RadioGroupKey: InjectionKey<RadioGroupContext> = Symbol('IrisRadioGroup')

/**
 * Container for a set of mutually exclusive `IrisRadio` choices. Provides
 * `name` for native form grouping and routes selection via context.
 */
export const IrisRadioGroup = defineComponent({
  name: 'IrisRadioGroup',
  props: {
    modelValue: {
      type: [String, Number, Boolean] as PropType<string | number | boolean | null>,
      default: null,
    },
    name: { type: String, default: undefined },
    size: { type: String as PropType<IrisRadioSize>, default: 'md' },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: string | number | boolean) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const fallbackName = useId()
    const groupName = props.name ?? fallbackName
    provide(RadioGroupKey, {
      name: groupName,
      value: computed(() => props.modelValue),
      setValue: (v) => emit('update:modelValue', v),
      size: computed(() => props.size),
      disabled: computed(() => props.disabled),
    })
    return () =>
      h(
        'div',
        {
          ...attrs,
          role: 'radiogroup',
          'data-iris-radio-group': '',
          style: {
            display: 'inline-flex',
            flexDirection: 'column',
            gap: 'var(--iris-gap-sm)',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
  },
})

/**
 * A single radio button. Lives inside an `IrisRadioGroup`. Native `<input
 * type="radio">` is hidden but receives focus; the visible dot mirrors the
 * group's value. Standalone usage (no group) is also supported by passing
 * `v-model` directly — the radio then behaves like a single boolean choice.
 */
export const IrisRadio = defineComponent({
  name: 'IrisRadio',
  inheritAttrs: false,
  props: {
    /** Value emitted to the group when this radio is selected. */
    value: {
      type: [String, Number, Boolean] as PropType<string | number | boolean>,
      required: true,
    },
    /** Standalone mode only: two-way binding without a group. */
    modelValue: {
      type: [String, Number, Boolean] as PropType<string | number | boolean | null>,
      default: undefined,
    },
    size: { type: String as PropType<IrisRadioSize>, default: undefined },
    disabled: { type: Boolean, default: false },
    id: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: string | number | boolean) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const group = inject(RadioGroupKey, null)
    const size = computed<IrisRadioSize>(() => props.size ?? group?.size.value ?? 'md')
    const disabled = computed(() => props.disabled || Boolean(group?.disabled.value))
    const checked = computed(() => {
      if (group) return group.value.value === props.value
      return props.modelValue === props.value
    })

    const dim = computed(() => {
      const map: Record<IrisRadioSize, string> = { sm: '14px', md: '18px', lg: '22px' }
      return map[size.value]
    })

    const boxStyle = computed<Record<string, string>>(() => ({
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: dim.value,
      height: dim.value,
      borderRadius: '999px',
      border: `1px solid ${checked.value ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
      background: 'var(--iris-background)',
      cursor: disabled.value ? 'not-allowed' : 'pointer',
      opacity: disabled.value ? '0.6' : '1',
      transition: 'border-color 120ms ease',
    }))

    const dotStyle = computed<Record<string, string>>(() => ({
      width: '50%',
      height: '50%',
      borderRadius: '999px',
      background: 'var(--iris-primary)',
      transform: checked.value ? 'scale(1)' : 'scale(0)',
      transition: 'transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    }))

    const onChange = () => {
      if (disabled.value) return
      if (group) group.setValue(props.value)
      else emit('update:modelValue', props.value)
    }

    return () =>
      h(
        'label',
        {
          ...attrs,
          'data-iris-radio': '',
          'data-iris-radio-size': size.value,
          'data-state': checked.value ? 'checked' : 'unchecked',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--iris-gap-sm)',
            cursor: disabled.value ? 'not-allowed' : 'pointer',
            userSelect: 'none',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h('input', {
            type: 'radio',
            id: props.id,
            name: group?.name,
            value: String(props.value),
            checked: checked.value,
            disabled: disabled.value || undefined,
            style: {
              position: 'absolute',
              opacity: '0',
              width: '0',
              height: '0',
              pointerEvents: 'none',
            },
            onChange,
          }),
          h('span', { 'aria-hidden': 'true', style: boxStyle.value }, [
            h('span', { style: dotStyle.value }),
          ]),
          slots.default && h('span', null, slots.default()),
        ],
      )
  },
})
