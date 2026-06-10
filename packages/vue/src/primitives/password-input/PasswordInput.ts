import { defineComponent, h, ref, type PropType } from 'vue'
import { IrisInput } from '../input/Input'
import { useI18n } from '../../i18n'
import type { Size } from '@iris-ui/core'

export type IrisPasswordInputSize = Size

/**
 * Password field wrapping {@link IrisInput}. Adds a visibility toggle as
 * the input's suffix slot — clicking it flips the input type between
 * `password` and `text`.
 */
export const IrisPasswordInput = defineComponent({
  name: 'IrisPasswordInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
    size: { type: String as PropType<IrisPasswordInputSize>, default: 'md' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    /** Allow the user to toggle visibility. Default `true`. */
    showToggle: { type: Boolean, default: true },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
    focus: (_event: FocusEvent) => true,
    blur: (_event: FocusEvent) => true,
  },
  setup(props, { attrs, emit, slots }) {
    const { t } = useI18n()
    const visible = ref(false)

    const onUpdate = (value: string) => emit('update:modelValue', value)
    const onFocus = (e: FocusEvent) => emit('focus', e)
    const onBlur = (e: FocusEvent) => emit('blur', e)

    const toggle = () => {
      if (props.disabled || props.readonly) return
      visible.value = !visible.value
    }

    return () =>
      h(
        IrisInput,
        {
          ...attrs,
          modelValue: props.modelValue,
          type: visible.value ? 'text' : 'password',
          size: props.size,
          placeholder: props.placeholder,
          disabled: props.disabled,
          readonly: props.readonly,
          invalid: props.invalid,
          id: props.id,
          'data-iris-password-input': '',
          'onUpdate:modelValue': onUpdate,
          onFocus,
          onBlur,
        },
        {
          prefix: slots.prefix,
          suffix: () => [
            slots.suffix?.(),
            props.showToggle
              ? h(
                  'button',
                  {
                    type: 'button',
                    'data-iris-password-input-toggle': '',
                    'aria-label': visible.value ? t('passwordInput.hide') : t('passwordInput.show'),
                    'aria-pressed': visible.value ? 'true' : 'false',
                    onClick: toggle,
                    style: {
                      background: 'transparent',
                      border: 'none',
                      cursor: props.disabled ? 'not-allowed' : 'pointer',
                      color: 'var(--iris-muted)',
                      padding: '0 2px',
                      fontSize: '13px',
                      lineHeight: '1',
                    },
                  },
                  visible.value ? '🙈' : '👁',
                )
              : null,
          ],
        },
      )
  },
})
