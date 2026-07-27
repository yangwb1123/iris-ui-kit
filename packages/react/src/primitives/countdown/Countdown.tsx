import * as React from 'react'

export type IrisCountdownSize = 'sm' | 'md' | 'lg'

export interface IrisCountdownProps {
  /** Target time as an epoch timestamp (ms). */
  value: number
  /** Token format: DD / HH / mm / ss / SSS. */
  format?: string
  title?: React.ReactNode
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  /** Fired once when the countdown reaches zero. */
  onFinish?: () => void
  size?: IrisCountdownSize
  style?: React.CSSProperties
  className?: string
}

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
 * and fires `onFinish` once at zero.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisCountdown}.
 */
export function IrisCountdown({
  value,
  format = 'HH:mm:ss',
  title,
  prefix,
  suffix,
  onFinish,
  size = 'md',
  style,
  className,
}: IrisCountdownProps): React.ReactElement {
  const [now, setNow] = React.useState(() => Date.now())
  const onFinishRef = React.useRef(onFinish)
  onFinishRef.current = onFinish
  const finishedRef = React.useRef(false)

  React.useEffect(() => {
    finishedRef.current = false
    const tick = format.includes('SSS') ? 100 : 1000
    const finishIfDue = (n: number, id?: ReturnType<typeof setInterval>) => {
      if (value - n <= 0 && !finishedRef.current) {
        finishedRef.current = true
        onFinishRef.current?.()
        if (id) clearInterval(id)
      }
    }
    setNow(Date.now())
    const id = setInterval(() => {
      const n = Date.now()
      setNow(n)
      finishIfDue(n, id)
    }, tick)
    finishIfDue(Date.now(), id)
    return () => clearInterval(id)
  }, [value, format])

  const remaining = Math.max(0, value - now)
  const finished = remaining <= 0
  const affix: React.CSSProperties = { fontSize: '0.6em', color: 'var(--iris-muted)' }

  return (
    <div
      data-iris-countdown=""
      data-finished={finished ? 'true' : undefined}
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}
    >
      {title != null ? (
        <div data-iris-countdown-title="" style={{ fontSize: 13, color: 'var(--iris-muted)' }}>
          {title}
        </div>
      ) : null}
      <div
        data-iris-countdown-value=""
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 4,
          fontSize: VALUE_FONT[size],
          fontWeight: 600,
          color: 'var(--iris-foreground)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {prefix != null ? <span style={affix}>{prefix}</span> : null}
        <span data-iris-countdown-time="">{formatRemaining(remaining, format)}</span>
        {suffix != null ? <span style={affix}>{suffix}</span> : null}
      </div>
    </div>
  )
}
