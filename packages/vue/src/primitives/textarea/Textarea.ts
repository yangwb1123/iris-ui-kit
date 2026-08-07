import { computed, defineComponent, h, nextTick, onMounted, ref, watch, type PropType } from 'vue'
import type { Size } from '@iris-ui-kit/core'

export type IrisTextareaSize = Size

/**
 * Multi-line text input. Mirrors {@link IrisInput}'s visual + a11y model but
 * renders a native `<textarea>`. Adds `autosize` — the textarea grows with
 * its content up to `maxRows`.
 */
export const IrisTextarea = defineComponent({
  name: 'IrisTextarea',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
    size: { type: String as PropType<IrisTextareaSize>, default: 'md' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    rows: { type: Number, default: 3 },
    /** Grow with content. When true, `rows` is the minimum; `maxRows` is the cap. */
    autosize: { type: Boolean, default: false },
    /** Cap for autosize. 0 = no cap. */
    maxRows: { type: Number, default: 8 },
    maxLength: { type: Number, default: undefined },
    id: { type: String, default: undefined },
    /** Forwarded as `aria-describedby` on the inner <textarea>. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
    focus: (_event: FocusEvent) => true,
    blur: (_event: FocusEvent) => true,
  },
  setup(props, { attrs, emit }) {
    const focused = ref(false)
    const textareaRef = ref<HTMLTextAreaElement | null>(null)

    const sizeStyles = computed<{ padding: string; fontSize: string; lineHeight: string }>(() => {
      const map: Record<
        IrisTextareaSize,
        { padding: string; fontSize: string; lineHeight: string }
      > = {
        sm: {
          padding: 'var(--iris-space-xs, 8px) var(--iris-padding-sm)',
          fontSize: 'var(--iris-font-size-xs, 12px)',
          lineHeight: '1.5',
        },
        md: {
          padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md)',
          fontSize: 'var(--iris-font-size-md, 14px)',
          lineHeight: '1.5',
        },
        lg: {
          padding: 'var(--iris-space-sm, 12px) var(--iris-padding-md)',
          fontSize: 'var(--iris-font-size-lg, 16px)',
          lineHeight: '1.5',
        },
      }
      return map[props.size]
    })

    const wrapperStyle = computed<Record<string, string>>(() => {
      const borderColor = props.invalid
        ? 'var(--iris-danger)'
        : focused.value
          ? 'var(--iris-primary)'
          : 'var(--iris-border)'
      const boxShadow = focused.value
        ? `0 0 0 3px ${props.invalid ? 'rgba(239, 68, 68, 0.18)' : 'rgba(99, 102, 241, 0.18)'}`
        : 'none'
      return {
        display: 'flex',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--iris-radius-md)',
        opacity: props.disabled ? '0.6' : '1',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        boxShadow,
        ...sizeStyles.value,
      }
    })

    const textareaStyle: Record<string, string> = {
      width: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'inherit',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      padding: '0',
      resize: 'vertical',
    }

    const resize = () => {
      const el = textareaRef.value
      if (!el || !props.autosize) return
      // jsdom doesn't compute layout; guard for that — falls back to rows attr.
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight || '0') || 20
      el.style.height = 'auto'
      const maxPx = props.maxRows > 0 ? lineHeight * props.maxRows : Infinity
      el.style.height = `${Math.min(maxPx, el.scrollHeight)}px`
    }

    watch(
      () => props.modelValue,
      () => {
        if (props.autosize) nextTick(resize)
      },
    )
    onMounted(() => {
      if (props.autosize) nextTick(resize)
    })

    const onInput = (event: Event) => {
      const v = (event.target as HTMLTextAreaElement).value
      emit('update:modelValue', v)
    }
    const onFocus = (event: FocusEvent) => {
      focused.value = true
      emit('focus', event)
    }
    const onBlur = (event: FocusEvent) => {
      focused.value = false
      emit('blur', event)
    }

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-textarea': '',
          'data-iris-textarea-size': props.size,
          'data-state': props.invalid ? 'invalid' : focused.value ? 'focused' : 'idle',
          style: {
            ...wrapperStyle.value,
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        h('textarea', {
          ref: (el: unknown) => {
            textareaRef.value = (el ?? null) as HTMLTextAreaElement | null
          },
          id: props.id,
          rows: props.rows,
          value: props.modelValue,
          placeholder: props.placeholder,
          disabled: props.disabled || undefined,
          readonly: props.readonly || undefined,
          maxlength: props.maxLength,
          'aria-invalid': props.invalid ? 'true' : undefined,
          'aria-describedby': props.ariaDescribedby,
          style: textareaStyle,
          onInput,
          onFocus,
          onBlur,
        }),
      )
  },
})
