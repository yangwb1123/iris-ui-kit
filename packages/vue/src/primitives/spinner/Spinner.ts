import { computed, defineComponent, h, onMounted, type PropType } from 'vue'
import { installSpinnerStyles } from './styles'
import { useI18n } from '../../i18n'

export type IrisSpinnerSize = 'sm' | 'md' | 'lg' | number

const SIZE_MAP: Record<Exclude<IrisSpinnerSize, number>, number> = {
  sm: 14,
  md: 18,
  lg: 24,
}

function resolveSize(size: IrisSpinnerSize): number {
  return typeof size === 'number' ? size : SIZE_MAP[size]
}

/**
 * Activity indicator. Pure SVG + a single keyframes rule injected once
 * (idempotent, SSR-safe). Honors `prefers-reduced-motion`.
 *
 * Accessibility: defaults to `role="status"` + an `aria-label` so screen
 * readers announce the loading state. Pass an empty `label` only if the
 * surrounding context already announces the activity.
 */
export const IrisSpinner = defineComponent({
  name: 'IrisSpinner',
  inheritAttrs: false,
  props: {
    size: { type: [String, Number] as PropType<IrisSpinnerSize>, default: 'md' },
    /** CSS color value. Defaults to the primary tone. */
    color: { type: String, default: 'var(--iris-primary)' },
    /** SVG stroke width in px. Auto-scaled by size when not specified. */
    strokeWidth: { type: Number, default: 0 },
    /** Visually-hidden screen reader label. */
    label: { type: String, default: undefined },
  },
  setup(props, { attrs }) {
    const { t } = useI18n()
    onMounted(installSpinnerStyles)
    const px = computed(() => resolveSize(props.size))
    const sw = computed(() => props.strokeWidth || Math.max(1.5, Math.round(px.value * 0.12)))

    return () => {
      const label = props.label ?? t('spinner.loading')
      return h(
        'span',
        {
          ...attrs,
          role: 'status',
          'aria-live': 'polite',
          'data-iris-spinner-wrap': '',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            ...((attrs.style as Record<string, string>) ?? {}),
          },
        },
        [
          h(
            'svg',
            {
              'data-iris-spinner': '',
              width: px.value,
              height: px.value,
              viewBox: '0 0 50 50',
              'aria-hidden': 'true',
              focusable: 'false',
              style: { color: props.color },
            },
            h('circle', {
              cx: '25',
              cy: '25',
              r: '20',
              stroke: 'currentColor',
              'stroke-width': sw.value,
            }),
          ),
          label
            ? h(
                'span',
                {
                  style: {
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    padding: '0',
                    margin: '-1px',
                    overflow: 'hidden',
                    clip: 'rect(0,0,0,0)',
                    whiteSpace: 'nowrap',
                    border: '0',
                  },
                },
                label,
              )
            : null,
        ],
      )
    }
  },
})
