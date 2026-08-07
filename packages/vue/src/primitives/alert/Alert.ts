import { computed, defineComponent, h, ref, watch, type PropType } from 'vue'
import { useI18n } from '../../i18n'

export type IrisAlertTone = 'info' | 'success' | 'warning' | 'danger'

const TONE_TO_VAR: Record<IrisAlertTone, string> = {
  info: '--iris-primary',
  success: '--iris-success',
  warning: '--iris-warning',
  danger: '--iris-danger',
}

/**
 * Inline status / feedback callout. Use for page- or section-level messages
 * that are part of the document flow (NOT transient — those use Toast).
 *
 * Composition:
 *
 * ```html
 * <IrisAlert tone="warning" closable @close="...">
 *   <template #title>Heads up</template>
 *   Storage is at 85 % of quota.
 * </IrisAlert>
 * ```
 *
 * Controlled (`v-model:open`) or uncontrolled (default visible). When closed
 * (uncontrolled), the component returns `null` from render rather than
 * leaving an empty wrapper in the tree.
 */
export const IrisAlert = defineComponent({
  name: 'IrisAlert',
  inheritAttrs: false,
  props: {
    tone: { type: String as PropType<IrisAlertTone>, default: 'info' },
    title: { type: String, default: '' },
    /** When true, a close button is rendered. */
    closable: { type: Boolean, default: false },
    /** Controlled visibility. Omit for uncontrolled (defaults to visible). */
    open: { type: Boolean, default: undefined },
  },
  emits: {
    'update:open': (_value: boolean) => true,
    close: () => true,
  },
  setup(props, { slots, attrs, emit }) {
    const { t } = useI18n()
    const internalOpen = ref(true)

    watch(
      () => props.open,
      (value) => {
        if (value !== undefined) internalOpen.value = value
      },
    )

    const isOpen = computed(() => (props.open !== undefined ? props.open : internalOpen.value))

    const onClose = () => {
      if (props.open === undefined) internalOpen.value = false
      emit('update:open', false)
      emit('close')
    }

    const tonalVar = computed(() => `var(${TONE_TO_VAR[props.tone]})`)

    const containerStyle = computed<Record<string, string>>(() => ({
      display: 'flex',
      gap: 'var(--iris-gap-md, 12px)',
      padding: 'var(--iris-padding-md, 12px)',
      borderRadius: 'var(--iris-radius-md, 6px)',
      border: `1px solid ${tonalVar.value}`,
      // `backgroundColor` is the precomputed fallback under color-mix (engines
      // without it); the `background` shorthand overrides with the exact mix.
      backgroundColor: `var(${TONE_TO_VAR[props.tone]}-subtle)`,
      background: `color-mix(in srgb, ${tonalVar.value} 10%, var(--iris-background))`,
      color: 'var(--iris-foreground)',
      alignItems: 'flex-start',
    }))

    return () => {
      if (!isOpen.value) return null
      return h(
        'div',
        {
          ...attrs,
          role: props.tone === 'danger' || props.tone === 'warning' ? 'alert' : 'status',
          'data-iris-alert': '',
          'data-iris-alert-tone': props.tone,
          style: { ...containerStyle.value, ...((attrs.style as Record<string, string>) ?? {}) },
        },
        [
          slots.icon
            ? h(
                'span',
                {
                  'data-iris-alert-icon': '',
                  style: { color: tonalVar.value, flexShrink: '0', display: 'inline-flex' },
                },
                slots.icon(),
              )
            : null,
          h('div', { 'data-iris-alert-body': '', style: { flex: '1', minWidth: '0' } }, [
            props.title || slots.title
              ? h(
                  'div',
                  {
                    'data-iris-alert-title': '',
                    style: { fontWeight: '600', marginBottom: '4px', color: tonalVar.value },
                  },
                  slots.title?.() ?? props.title,
                )
              : null,
            h('div', { 'data-iris-alert-content': '' }, slots.default?.()),
          ]),
          props.closable
            ? h(
                'button',
                {
                  type: 'button',
                  'data-iris-alert-close': '',
                  'aria-label': t('alert.close'),
                  onClick: onClose,
                  style: {
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--iris-muted)',
                    fontSize: 'var(--iris-font-size-lg, 16px)',
                    padding: '0',
                    lineHeight: '1',
                    flexShrink: '0',
                  },
                },
                '✕',
              )
            : null,
        ],
      )
    }
  },
})
