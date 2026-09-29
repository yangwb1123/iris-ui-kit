import {
  createEffect,
  createSignal,
  mergeProps,
  on,
  onCleanup,
  onMount,
  splitProps,
  type JSX,
} from 'solid-js'

export type IrisCountdownSize = 'sm' | 'md' | 'lg'

const VALUE_FONT: Record<IrisCountdownSize, number> = { sm: 18, md: 24, lg: 30 }

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0')
}

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

export interface IrisCountdownProps {
  /** Target epoch timestamp (ms). */
  value: number
  /** Optional epoch snapshot for the first render; otherwise text waits for mount. */
  now?: number
  format?: string
  title?: string | number
  prefix?: string | number
  suffix?: string | number
  size?: IrisCountdownSize
  onFinish?: () => void
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Live countdown timer. Solid port of the Vue/React IrisCountdown.
 */
export function IrisCountdown(props: IrisCountdownProps): JSX.Element {
  const merged = mergeProps({ format: 'HH:mm:ss', size: 'md' as IrisCountdownSize }, props)
  const [local, rest] = splitProps(merged, [
    'value',
    'now',
    'format',
    'title',
    'prefix',
    'suffix',
    'size',
    'onFinish',
  ])

  const [currentTime, setCurrentTime] = createSignal<number | null>(local.now ?? null)
  let timer: ReturnType<typeof setInterval> | undefined

  const stop = (): void => {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  const start = (): void => {
    stop()
    let finished = false
    const target = local.value
    const fmt = local.format
    const check = (n: number): void => {
      if (target - n <= 0 && !finished) {
        finished = true
        local.onFinish?.()
      }
    }

    const initial = local.now ?? Date.now()
    setCurrentTime(initial)
    const tick = fmt.includes('SSS') ? 100 : 1000
    timer = setInterval(() => {
      const n = Date.now()
      setCurrentTime(n)
      check(n)
      if (finished) stop()
    }, tick)
    check(initial)
    if (finished) stop()
  }

  onMount(start)
  createEffect(
    on(
      () => [local.value, local.format, local.now],
      () => start(),
      { defer: true },
    ),
  )
  onCleanup(stop)

  const remaining = (): number | null => {
    const current = currentTime()
    return current === null ? null : Math.max(0, local.value - current)
  }

  const isFinished = (): boolean => {
    const current = remaining()
    return current !== null && current <= 0
  }
  const displayTime = (): string => {
    const current = remaining()
    return current === null ? '' : formatRemaining(current, local.format)
  }
  const affix: JSX.CSSProperties = { 'font-size': '0.6em', color: 'var(--iris-muted)' }

  return (
    <div
      {...rest}
      data-iris-countdown=""
      data-finished={isFinished() ? 'true' : undefined}
      style={{
        display: 'flex',
        'flex-direction': 'column',
        gap: '4px',
        ...((rest.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.title != null && (
        <div
          data-iris-countdown-title=""
          style={{ 'font-size': 'var(--iris-font-size-sm, 13px)', color: 'var(--iris-muted)' }}
        >
          {String(local.title)}
        </div>
      )}
      <div
        data-iris-countdown-value=""
        style={{
          display: 'inline-flex',
          'align-items': 'baseline',
          gap: '4px',
          'font-size': `${VALUE_FONT[local.size]}px`,
          'font-weight': '600',
          color: 'var(--iris-foreground)',
          'font-variant-numeric': 'tabular-nums',
        }}
      >
        {local.prefix != null && <span style={affix}>{String(local.prefix)}</span>}
        <span data-iris-countdown-time="">{displayTime()}</span>
        {local.suffix != null && <span style={affix}>{String(local.suffix)}</span>}
      </div>
    </div>
  )
}
