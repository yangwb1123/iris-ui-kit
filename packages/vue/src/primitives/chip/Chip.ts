import { computed, defineComponent, h, type PropType } from 'vue'
import { useI18n } from '../../i18n'

export type IrisChipVariant = 'solid' | 'outline' | 'subtle'
export type IrisChipTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
export type IrisChipSize = 'sm' | 'md'

const TONE_TO_VAR: Record<IrisChipTone, string> = {
  primary: '--iris-primary',
  success: '--iris-success',
  warning: '--iris-warning',
  danger: '--iris-danger',
  neutral: '--iris-muted',
}

function chipStyle(
  variant: IrisChipVariant,
  tone: IrisChipTone,
  size: IrisChipSize,
  clickable: boolean,
  disabled: boolean,
): Record<string, string> {
  const v = `var(${TONE_TO_VAR[tone]})`
  const base: Record<string, string> = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--iris-space-xs, 8px)',
    borderRadius: '9999px',
    fontFamily: 'var(--iris-font-family, inherit)',
    fontWeight: '500',
    lineHeight: '1',
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : clickable ? 'pointer' : 'default',
    opacity: disabled ? '0.6' : '1',
    transition: 'background-color 120ms ease, box-shadow 120ms ease',
    fontSize: size === 'sm' ? '11px' : '12px',
    padding: size === 'sm' ? '3px 8px' : '4px 10px',
    userSelect: 'none',
  }
  switch (variant) {
    case 'solid':
      return {
        ...base,
        background: v,
        color: 'var(--iris-primary-foreground, #fff)',
        border: '1px solid transparent',
      }
    case 'outline':
      return {
        ...base,
        background: 'transparent',
        color: v,
        border: `1px solid ${v}`,
      }
    case 'subtle':
      return {
        ...base,
        // Precomputed fallback first; color-mix shorthand overrides on modern engines.
        backgroundColor: `var(${TONE_TO_VAR[tone]}-subtle)`,
        background: `color-mix(in srgb, ${v} 14%, transparent)`,
        color: v,
        border: '1px solid transparent',
      }
  }
}

/**
 * Tag / filter chip. Three variants × five tones. Three modes:
 *
 *   - Pure display (default): renders a `<span>`.
 *   - Closable (`closable=true`): adds an "×" button that emits `@close`.
 *   - Clickable (`clickable=true`): renders a `<button>` so the whole chip
 *     becomes a control. Emits `@click`.
 *
 * Closable + clickable can combine; the close button's click is stopped
 * from propagating so the parent click still fires only for chip-body
 * clicks.
 */
export const IrisChip = defineComponent({
  name: 'IrisChip',
  inheritAttrs: false,
  props: {
    variant: { type: String as PropType<IrisChipVariant>, default: 'subtle' },
    tone: { type: String as PropType<IrisChipTone>, default: 'neutral' },
    size: { type: String as PropType<IrisChipSize>, default: 'md' },
    closable: { type: Boolean, default: false },
    clickable: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    close: () => true,
    click: (_event: MouseEvent) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const { t } = useI18n()
    const style = computed(() =>
      chipStyle(props.variant, props.tone, props.size, props.clickable, props.disabled),
    )

    const onClick = (event: MouseEvent) => {
      if (props.disabled) return
      emit('click', event)
    }

    const onCloseClick = (event: MouseEvent) => {
      if (props.disabled) return
      event.stopPropagation()
      emit('close')
    }

    return () => {
      const baseProps: Record<string, unknown> = {
        ...attrs,
        'data-iris-chip': '',
        'data-iris-chip-variant': props.variant,
        'data-iris-chip-tone': props.tone,
        'data-iris-chip-size': props.size,
        style: { ...style.value, ...((attrs.style as Record<string, string>) ?? {}) },
      }

      const children = [
        slots.icon
          ? h(
              'span',
              {
                'data-iris-chip-icon': '',
                style: { display: 'inline-flex', alignItems: 'center', flexShrink: '0' },
              },
              slots.icon(),
            )
          : null,
        h('span', { 'data-iris-chip-label': '' }, slots.default?.()),
        props.closable
          ? h(
              'button',
              {
                type: 'button',
                'data-iris-chip-close': '',
                'aria-label': t('chip.remove'),
                disabled: props.disabled || undefined,
                onClick: onCloseClick,
                style: {
                  background: 'transparent',
                  border: 'none',
                  cursor: props.disabled ? 'not-allowed' : 'pointer',
                  color: 'inherit',
                  padding: '0',
                  marginInlineStart: 'var(--iris-space-xxs, 4px)',
                  fontSize: 'var(--iris-font-size-xs, 12px)',
                  lineHeight: '1',
                  flexShrink: '0',
                  opacity: '0.7',
                },
              },
              '✕',
            )
          : null,
      ]

      if (props.clickable) {
        return h(
          'button',
          {
            ...baseProps,
            type: 'button',
            disabled: props.disabled || undefined,
            onClick,
          },
          children,
        )
      }
      return h('span', baseProps, children)
    }
  },
})
