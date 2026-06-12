import { computed, defineComponent, h, type PropType } from 'vue'

export type IrisBadgeVariant = 'solid' | 'outline' | 'subtle'
export type IrisBadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
export type IrisBadgeSize = 'sm' | 'md'

const TONE_TO_VAR: Record<IrisBadgeTone, string> = {
  primary: '--iris-primary',
  success: '--iris-success',
  warning: '--iris-warning',
  danger: '--iris-danger',
  neutral: '--iris-muted',
}

function badgeStyle(
  variant: IrisBadgeVariant,
  tone: IrisBadgeTone,
  size: IrisBadgeSize,
): Record<string, string> {
  const v = `var(${TONE_TO_VAR[tone]})`
  const base: Record<string, string> = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    borderRadius: 'var(--iris-radius-sm, 4px)',
    fontFamily: 'var(--iris-font-family, inherit)',
    fontWeight: '500',
    lineHeight: '1',
    whiteSpace: 'nowrap',
    fontSize: size === 'sm' ? '11px' : '12px',
    padding: size === 'sm' ? '2px 6px' : '3px 8px',
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
        background: `color-mix(in srgb, ${v} 12%, transparent)`,
        color: v,
        border: '1px solid transparent',
      }
  }
}

/**
 * Inline status / tag indicator. Three visual variants (solid / outline /
 * subtle) × five semantic tones (primary / success / warning / danger /
 * neutral). All colors come from theme CSS variables.
 */
export const IrisBadge = defineComponent({
  name: 'IrisBadge',
  inheritAttrs: false,
  props: {
    variant: { type: String as PropType<IrisBadgeVariant>, default: 'subtle' },
    tone: { type: String as PropType<IrisBadgeTone>, default: 'primary' },
    size: { type: String as PropType<IrisBadgeSize>, default: 'md' },
  },
  setup(props, { slots, attrs }) {
    const style = computed(() => badgeStyle(props.variant, props.tone, props.size))
    return () =>
      h(
        'span',
        {
          ...attrs,
          'data-iris-badge': '',
          'data-iris-badge-variant': props.variant,
          'data-iris-badge-tone': props.tone,
          'data-iris-badge-size': props.size,
          style: { ...style.value, ...((attrs.style as Record<string, string>) ?? {}) },
        },
        slots.default?.(),
      )
  },
})
