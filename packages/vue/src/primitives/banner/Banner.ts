import { computed, defineComponent, h, ref, watch, type PropType } from 'vue'

export type IrisBannerTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

const TONE_TO_VAR: Record<IrisBannerTone, string> = {
  info: '--iris-primary',
  success: '--iris-success',
  warning: '--iris-warning',
  danger: '--iris-danger',
  neutral: '--iris-muted',
}

/**
 * Edge-to-edge announcement bar — typically pinned to the top of the layout.
 * Distinct from {@link IrisAlert} in three ways: (a) edge-to-edge layout,
 * (b) optional `sticky` positioning, (c) tighter vertical padding for a
 * smaller visual footprint.
 */
export const IrisBanner = defineComponent({
  name: 'IrisBanner',
  inheritAttrs: false,
  props: {
    tone: { type: String as PropType<IrisBannerTone>, default: 'info' },
    closable: { type: Boolean, default: false },
    open: { type: Boolean, default: undefined },
    /** Use `position: sticky; top: 0;`. */
    sticky: { type: Boolean, default: false },
  },
  emits: {
    'update:open': (_value: boolean) => true,
    close: () => true,
  },
  setup(props, { slots, attrs, emit }) {
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
      alignItems: 'center',
      gap: 'var(--iris-gap-md, 12px)',
      padding: '8px var(--iris-padding-md, 16px)',
      width: '100%',
      background: `color-mix(in srgb, ${tonalVar.value} 14%, var(--iris-background))`,
      color: 'var(--iris-foreground)',
      borderBottom: `1px solid color-mix(in srgb, ${tonalVar.value} 50%, transparent)`,
      ...(props.sticky ? { position: 'sticky' as const, top: '0', zIndex: '40' } : {}),
    }))

    return () => {
      if (!isOpen.value) return null
      return h(
        'div',
        {
          ...attrs,
          role: 'status',
          'data-iris-banner': '',
          'data-iris-banner-tone': props.tone,
          style: { ...containerStyle.value, ...((attrs.style as Record<string, string>) ?? {}) },
        },
        [
          slots.icon
            ? h(
                'span',
                {
                  'data-iris-banner-icon': '',
                  style: { color: tonalVar.value, display: 'inline-flex', flexShrink: '0' },
                },
                slots.icon(),
              )
            : null,
          h(
            'div',
            {
              'data-iris-banner-content': '',
              style: { flex: '1', minWidth: '0' },
            },
            slots.default?.(),
          ),
          slots.actions
            ? h(
                'div',
                {
                  'data-iris-banner-actions': '',
                  style: { display: 'inline-flex', gap: '8px', flexShrink: '0' },
                },
                slots.actions(),
              )
            : null,
          props.closable
            ? h(
                'button',
                {
                  type: 'button',
                  'data-iris-banner-close': '',
                  'aria-label': 'Close',
                  onClick: onClose,
                  style: {
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--iris-muted)',
                    fontSize: '16px',
                    padding: '0 4px',
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
