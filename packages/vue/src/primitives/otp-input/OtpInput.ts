import { computed, defineComponent, h, onMounted, ref, type PropType } from 'vue'
import { useI18n } from '../../i18n'

export type IrisOtpInputSize = 'sm' | 'md' | 'lg'
export type IrisOtpInputType = 'numeric' | 'alphanumeric'

const SIZE_MAP: Record<IrisOtpInputSize, { box: string; height: string; fontSize: string }> = {
  sm: { box: '32px', height: '36px', fontSize: 'var(--iris-font-size-md, 14px)' },
  md: { box: '38px', height: '44px', fontSize: 'var(--iris-font-size-xl, 18px)' },
  lg: { box: '44px', height: '52px', fontSize: 'var(--iris-font-size-2xl, 20px)' },
}

const PATTERNS: Record<IrisOtpInputType, RegExp> = {
  numeric: /[0-9]/,
  alphanumeric: /[0-9a-zA-Z]/,
}

/** Keep only characters allowed by `type`. */
function sanitize(str: string, type: IrisOtpInputType): string {
  const re = PATTERNS[type]
  let out = ''
  for (const ch of str) if (re.test(ch)) out += ch
  return out
}

/**
 * One-time-code / PIN entry: a row of single-character cells with smart focus
 * movement, paste-to-fill, and keyboard editing. The value (`v-model`) is kept
 * contiguous (no interior gaps) and optionally masked; `complete` fires when
 * every cell is filled. Drop it inside `IrisFormField` — the injected `id`
 * lands on the first cell so the label focuses it.
 */
export const IrisOtpInput = defineComponent({
  name: 'IrisOtpInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
    /** Number of cells. */
    length: { type: Number, default: 6 },
    /** Allowed characters: digits only, or digits + letters. */
    type: { type: String as PropType<IrisOtpInputType>, default: 'numeric' },
    /** Mask entered characters (renders password cells). */
    mask: { type: Boolean, default: false },
    size: { type: String as PropType<IrisOtpInputSize>, default: 'md' },
    disabled: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    autofocus: { type: Boolean, default: false },
    /** Placeholder glyph shown in empty cells. */
    placeholder: { type: String, default: '' },
    /** id forwarded to the first cell. Set by IrisFormField. */
    id: { type: String, default: undefined },
    /** Forwarded as `aria-describedby` on every cell. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
    /** Fired once the code fills every cell. */
    complete: (_value: string) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const focusedIndex = ref(-1)
    const cellEls: (HTMLInputElement | null)[] = []

    const value = computed(() =>
      sanitize(props.modelValue ?? '', props.type).slice(0, props.length),
    )

    const focusCell = (i: number) => {
      const el = cellEls[Math.max(0, Math.min(props.length - 1, i))]
      if (el) {
        el.focus()
        el.select()
      }
    }

    const commit = (next: string) => {
      const v = sanitize(next, props.type).slice(0, props.length)
      if (v === value.value) return
      emit('update:modelValue', v)
      if (v.length === props.length) emit('complete', v)
    }

    // Overwrite from `startIndex`, clamped to ≤ current length so no interior
    // gap can form. Used by both typing (one char) and paste (many).
    const writeFrom = (startIndex: number, chars: string) => {
      const clean = sanitize(chars, props.type)
      if (!clean) return
      const start = Math.min(startIndex, value.value.length)
      const arr = value.value.split('')
      for (let k = 0; k < clean.length && start + k < props.length; k++)
        arr[start + k] = clean.charAt(k)
      commit(arr.join('').slice(0, props.length))
      focusCell(start + clean.length)
    }

    const onInput = (i: number, event: Event) => {
      // One char when typing; a longer value means OTP autofill — distribute it.
      const clean = sanitize((event.target as HTMLInputElement).value, props.type)
      if (clean) writeFrom(i, clean)
    }

    const onKeyDown = (i: number, event: KeyboardEvent) => {
      if (props.disabled) return
      const key = event.key
      const v = value.value
      if (key === 'Backspace') {
        event.preventDefault()
        if (v[i]) {
          commit(v.slice(0, i) + v.slice(i + 1))
          focusCell(i - 1)
        } else if (i > 0) {
          commit(v.slice(0, i - 1) + v.slice(i))
          focusCell(i - 1)
        }
      } else if (key === 'Delete') {
        event.preventDefault()
        if (v[i]) commit(v.slice(0, i) + v.slice(i + 1))
      } else if (key === 'ArrowLeft') {
        event.preventDefault()
        focusCell(i - 1)
      } else if (key === 'ArrowRight') {
        event.preventDefault()
        focusCell(i + 1)
      } else if (key === 'Home') {
        event.preventDefault()
        focusCell(0)
      } else if (key === 'End') {
        event.preventDefault()
        focusCell(v.length)
      } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (!PATTERNS[props.type].test(key)) event.preventDefault()
      }
    }

    const onPaste = (i: number, event: ClipboardEvent) => {
      event.preventDefault()
      if (props.disabled) return
      writeFrom(i, event.clipboardData?.getData('text') ?? '')
    }

    onMounted(() => {
      if (props.autofocus) cellEls[0]?.focus()
    })

    return () => {
      const sz = SIZE_MAP[props.size]
      return h(
        'div',
        {
          ...attrs,
          'data-iris-otp-input': '',
          'data-iris-otp-input-size': props.size,
          'data-state': props.invalid ? 'invalid' : 'idle',
          role: 'group',
          'aria-disabled': props.disabled ? 'true' : undefined,
          style: {
            display: 'inline-flex',
            gap: '8px',
            direction: 'inherit',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        Array.from({ length: props.length }, (_unused, i) => {
          const char = value.value.charAt(i)
          const focused = focusedIndex.value === i
          const borderColor = props.invalid
            ? 'var(--iris-danger)'
            : focused
              ? 'var(--iris-primary)'
              : 'var(--iris-border)'
          return h('input', {
            key: i,
            ref: (el: unknown) => {
              cellEls[i] = (el ?? null) as HTMLInputElement | null
            },
            id: i === 0 ? props.id : undefined,
            type: props.mask ? 'password' : 'text',
            inputmode: props.type === 'numeric' ? 'numeric' : 'text',
            autocomplete: i === 0 ? 'one-time-code' : 'off',
            maxlength: 1,
            value: char,
            placeholder: props.placeholder || undefined,
            disabled: props.disabled || undefined,
            'aria-label': t('otpInput.cell', { index: i + 1, total: props.length }),
            'aria-invalid': props.invalid ? 'true' : undefined,
            'aria-describedby': props.ariaDescribedby,
            'data-iris-otp-input-cell': '',
            'data-filled': char ? 'true' : undefined,
            onInput: (e: Event) => onInput(i, e),
            onKeydown: (e: KeyboardEvent) => onKeyDown(i, e),
            onPaste: (e: ClipboardEvent) => onPaste(i, e),
            onFocus: (e: FocusEvent) => {
              focusedIndex.value = i
              ;(e.target as HTMLInputElement).select()
            },
            onBlur: () => {
              focusedIndex.value = -1
            },
            style: {
              width: sz.box,
              height: sz.height,
              textAlign: 'center',
              fontSize: sz.fontSize,
              fontFamily: 'inherit',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--iris-foreground)',
              background: 'var(--iris-background)',
              border: `1px solid ${borderColor}`,
              borderRadius: 'var(--iris-radius-md, 6px)',
              outline: 'none',
              opacity: props.disabled ? '0.6' : '1',
              boxShadow: focused
                ? `0 0 0 3px ${props.invalid ? 'rgba(239, 68, 68, 0.18)' : 'rgba(99, 102, 241, 0.18)'}`
                : 'none',
              transition: 'border-color 120ms ease, box-shadow 120ms ease',
            },
          })
        }),
      )
    }
  },
})
