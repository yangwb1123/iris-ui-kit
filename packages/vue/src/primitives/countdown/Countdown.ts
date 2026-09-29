import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from 'vue'

export type IrisCountdownSize = 'sm' | 'md' | 'lg'

const VALUE_FONT: Record<IrisCountdownSize, number> = { sm: 18, md: 24, lg: 30 }

const pad = (n: number, len: number) => String(n).padStart(len, '0')

/** Render remaining milliseconds via DD/HH/mm/ss/SSS tokens. */
export function formatRemaining(ms: number, format: string): string {
  const total = Math.max(0, ms)
  const days = Math.floor(total / 86400000)
  const hours = Math.floor((total % 86400000) / 3600000)
  const minutes = Math.floor((total % 3600000) / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  const millis = Math.floor(total % 1000)
  return format
    .replace(/DD/g, pad(days, 2))
    .replace(/HH/g, pad(hours, 2))
    .replace(/mm/g, pad(minutes, 2))
    .replace(/ss/g, pad(seconds, 2))
    .replace(/SSS/g, pad(millis, 3))
}

/**
 * Live countdown to a target timestamp. Ticks every second (or every 100ms
 * when the format shows milliseconds), formats the remaining time via tokens,
 * and emits `finish` once at zero.
 */
export const IrisCountdown = defineComponent({
  name: 'IrisCountdown',
  inheritAttrs: false,
  props: {
    /** Target time as an epoch timestamp (ms). */
    value: { type: Number, required: true },
    /** Optional epoch snapshot for the first render; otherwise text waits for mount. */
    now: { type: Number, default: undefined },
    /** Token format: DD / HH / mm / ss / SSS. */
    format: { type: String, default: 'HH:mm:ss' },
    title: { type: [String, Number], default: undefined },
    prefix: { type: [String, Number], default: undefined },
    suffix: { type: [String, Number], default: undefined },
    size: { type: String as PropType<IrisCountdownSize>, default: 'md' },
  },
  emits: {
    finish: () => true,
  },
  setup(props, { attrs, emit }) {
    const currentTime = ref<number | null>(props.now ?? null)
    let finished = false
    let timer: ReturnType<typeof setInterval> | undefined
    let mounted = false

    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
    }
    const due = (n: number) => {
      if (props.value - n <= 0 && !finished) {
        finished = true
        emit('finish')
        stop()
      }
    }
    const start = () => {
      stop()
      finished = false
      const initial = props.now ?? Date.now()
      currentTime.value = initial
      const tick = props.format.includes('SSS') ? 100 : 1000
      timer = setInterval(() => {
        const n = Date.now()
        currentTime.value = n
        due(n)
      }, tick)
      due(initial)
    }
    onMounted(() => {
      mounted = true
      start()
    })
    watch(
      () => [props.value, props.format, props.now],
      () => {
        if (mounted) start()
      },
    )
    onBeforeUnmount(stop)

    const remaining = computed(() =>
      currentTime.value === null ? null : Math.max(0, props.value - currentTime.value),
    )

    return () => {
      const affix = { fontSize: '0.6em', color: 'var(--iris-muted)' }
      return h(
        'div',
        {
          ...attrs,
          'data-iris-countdown': '',
          'data-finished': remaining.value !== null && remaining.value <= 0 ? 'true' : undefined,
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          props.title != null
            ? h(
                'div',
                {
                  'data-iris-countdown-title': '',
                  style: { fontSize: 'var(--iris-font-size-sm, 13px)', color: 'var(--iris-muted)' },
                },
                String(props.title),
              )
            : null,
          h(
            'div',
            {
              'data-iris-countdown-value': '',
              style: {
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: '4px',
                fontSize: `${VALUE_FONT[props.size]}px`,
                fontWeight: '600',
                color: 'var(--iris-foreground)',
                fontVariantNumeric: 'tabular-nums',
              },
            },
            [
              props.prefix != null ? h('span', { style: affix }, String(props.prefix)) : null,
              h(
                'span',
                { 'data-iris-countdown-time': '' },
                remaining.value === null ? '' : formatRemaining(remaining.value, props.format),
              ),
              props.suffix != null ? h('span', { style: affix }, String(props.suffix)) : null,
            ],
          ),
        ],
      )
    }
  },
})
