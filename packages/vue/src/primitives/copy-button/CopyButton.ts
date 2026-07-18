import { defineComponent, h, onBeforeUnmount, ref, type PropType } from 'vue'
import { copyText } from '@iris-ui/core'
import { useI18n } from '../../i18n'

export type IrisCopyButtonSize = 'sm' | 'md' | 'lg'

const SIZE_MAP: Record<IrisCopyButtonSize, { padding: string; fontSize: string }> = {
  sm: { padding: '4px 8px', fontSize: '12px' },
  md: { padding: '6px 12px', fontSize: '14px' },
  lg: { padding: '8px 16px', fontSize: '16px' },
}

/**
 * Copy-to-clipboard button: writes `text` to the clipboard and flips to a
 * "Copied" state for `timeout` ms. The clipboard write is best-effort (guarded
 * for unsupported environments) and the copied state still reflects intent.
 */
export const IrisCopyButton = defineComponent({
  name: 'IrisCopyButton',
  inheritAttrs: false,
  props: {
    text: { type: String, required: true },
    /** Content shown briefly after copying (default: localized "Copied"). */
    copiedLabel: { type: String, default: undefined },
    /** How long the copied state lasts (ms). */
    timeout: { type: Number, default: 2000 },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<IrisCopyButtonSize>, default: 'md' },
  },
  emits: {
    copy: (_text: string) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const { t } = useI18n()
    const copied = ref(false)
    let timer: ReturnType<typeof setTimeout> | undefined

    const copy = async () => {
      if (props.disabled) return
      try {
        // A host clipboard handler (setClipboardHandler) wins — needed where
        // navigator.clipboard is unavailable (Cordova file://, custom protocols).
        if (!(await copyText(props.text))) {
          // writeText returns a Promise; swallow async rejection (permission denied).
          void navigator.clipboard?.writeText?.(props.text)?.catch(() => {})
        }
      } catch {
        /* host handler / clipboard unavailable — still surface the copied state */
      }
      copied.value = true
      emit('copy', props.text)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        copied.value = false
      }, props.timeout)
    }
    onBeforeUnmount(() => {
      if (timer) clearTimeout(timer)
    })

    return () => {
      const sz = SIZE_MAP[props.size]
      const label = copied.value
        ? (props.copiedLabel ?? t('copyButton.copied'))
        : slots.default
          ? slots.default()
          : t('copyButton.copy')
      return h(
        'button',
        {
          ...attrs,
          type: 'button',
          'data-iris-copy-button': '',
          'data-copied': copied.value ? 'true' : undefined,
          disabled: props.disabled || undefined,
          onClick: copy,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: sz.padding,
            fontSize: sz.fontSize,
            fontFamily: 'inherit',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            background: copied.value ? 'var(--iris-success, #16a34a)' : 'var(--iris-surface)',
            color: copied.value ? '#fff' : 'var(--iris-foreground)',
            cursor: props.disabled ? 'not-allowed' : 'pointer',
            opacity: props.disabled ? '0.6' : '1',
            transition: 'background-color 120ms ease, color 120ms ease',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        label,
      )
    }
  },
})
