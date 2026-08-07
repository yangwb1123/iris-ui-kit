import { defineComponent, h, ref, type PropType } from 'vue'
import { useI18n } from '../../i18n'

/**
 * Tag / token input: a field where typed text becomes removable chips. Commit
 * a tag with Enter or a comma (pasted comma lists split too); Backspace on an
 * empty input removes the last tag; each chip has a remove button.
 */
export const IrisTagInput = defineComponent({
  name: 'IrisTagInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: Array as PropType<string[]>, default: () => [] },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    /** Max number of tags. 0 / undefined = unlimited. */
    max: { type: Number, default: undefined },
    allowDuplicates: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_tags: string[]) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const input = ref('')
    const focused = ref(false)

    const canAdd = (txt: string, list: string[]) =>
      !!txt &&
      (props.allowDuplicates || !list.includes(txt)) &&
      (!props.max || list.length < props.max)

    const addTag = () => {
      const txt = input.value.trim()
      if (txt && canAdd(txt, props.modelValue))
        emit('update:modelValue', [...props.modelValue, txt])
      input.value = ''
    }
    const removeAt = (i: number) => {
      if (props.disabled) return
      emit(
        'update:modelValue',
        props.modelValue.filter((_, k) => k !== i),
      )
    }

    const onInput = (e: Event) => {
      const raw = (e.target as HTMLInputElement).value
      if (raw.includes(',')) {
        const parts = raw.split(',')
        const last = parts.pop() ?? ''
        let next = props.modelValue
        for (const p of parts) {
          const txt = p.trim()
          if (canAdd(txt, next)) next = [...next, txt]
        }
        if (next !== props.modelValue) emit('update:modelValue', next)
        input.value = last
      } else {
        input.value = raw
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        addTag()
      } else if (e.key === 'Backspace' && input.value === '' && props.modelValue.length > 0) {
        e.preventDefault()
        removeAt(props.modelValue.length - 1)
      }
    }

    return () => {
      const borderColor = props.invalid
        ? 'var(--iris-danger)'
        : focused.value
          ? 'var(--iris-primary)'
          : 'var(--iris-border)'
      const children = props.modelValue.map((tag, i) =>
        h(
          'span',
          {
            key: `${tag}-${i}`,
            'data-iris-tag-input-tag': '',
            'data-value': tag,
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--iris-space-xxs, 4px)',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
              fontSize: 'var(--iris-font-size-sm, 13px)',
              background: 'var(--iris-surface)',
              border: '1px solid var(--iris-border)',
              borderRadius: 'var(--iris-radius-sm, 4px)',
              color: 'var(--iris-foreground)',
            },
          },
          [
            tag,
            h(
              'button',
              {
                type: 'button',
                'data-iris-tag-input-remove': '',
                'aria-label': t('tagInput.remove', { tag }),
                disabled: props.disabled || undefined,
                onClick: () => removeAt(i),
                style: {
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--iris-muted)',
                  cursor: props.disabled ? 'not-allowed' : 'pointer',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                  lineHeight: '1',
                  padding: '0',
                },
              },
              '×',
            ),
          ],
        ),
      )

      children.push(
        h('input', {
          id: props.id,
          type: 'text',
          'data-iris-tag-input-field': '',
          value: input.value,
          placeholder: props.modelValue.length === 0 ? props.placeholder : undefined,
          disabled: props.disabled || undefined,
          'aria-invalid': props.invalid ? 'true' : undefined,
          'aria-describedby': props.ariaDescribedby,
          onInput,
          onKeydown: onKeyDown,
          onFocus: () => {
            focused.value = true
          },
          onBlur: () => {
            focused.value = false
          },
          style: {
            flex: '1',
            minWidth: '80px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--iris-foreground)',
            fontFamily: 'inherit',
            fontSize: 'var(--iris-font-size-md, 14px)',
            padding: 'var(--iris-space-xxs, 4px) 0',
          },
        }),
      )

      return h(
        'div',
        {
          ...attrs,
          'data-iris-tag-input': '',
          'data-state': props.invalid ? 'invalid' : focused.value ? 'focused' : 'idle',
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'var(--iris-space-xs, 8px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
            minHeight: '34px',
            background: 'var(--iris-background)',
            border: `1px solid ${borderColor}`,
            borderRadius: 'var(--iris-radius-md, 6px)',
            opacity: props.disabled ? '0.6' : '1',
            boxShadow: focused.value ? '0 0 0 3px rgba(99, 102, 241, 0.18)' : 'none',
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        children,
      )
    }
  },
})
