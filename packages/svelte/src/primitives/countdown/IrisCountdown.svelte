<script lang="ts">
  type CountdownSize = 'sm' | 'md' | 'lg'

  const VALUE_FONT: Record<CountdownSize, number> = { sm: 18, md: 24, lg: 30 }

  function pad(n: number, len: number): string {
    return String(n).padStart(len, '0')
  }

  function formatRemaining(ms: number, fmt: string): string {
    const total = Math.max(0, ms)
    const days = Math.floor(total / 86400000)
    const hours = Math.floor((total % 86400000) / 3600000)
    const minutes = Math.floor((total % 3600000) / 60000)
    const seconds = Math.floor((total % 60000) / 1000)
    const millis = Math.floor(total % 1000)
    return fmt
      .replace(/DD/g, pad(days, 2))
      .replace(/HH/g, pad(hours, 2))
      .replace(/mm/g, pad(minutes, 2))
      .replace(/ss/g, pad(seconds, 2))
      .replace(/SSS/g, pad(millis, 3))
  }

  let {
    value,
    format = 'HH:mm:ss',
    title,
    prefix,
    suffix,
    size = 'md',
    onfinish,
    style,
    ...rest
  }: {
    value: number
    format?: string
    title?: string | number
    prefix?: string | number
    suffix?: string | number
    size?: CountdownSize
    onfinish?: () => void
    style?: string
    [key: string]: unknown
  } = $props()

  let now = $state(Date.now())
  let finished = false
  let timer: ReturnType<typeof setInterval> | undefined

  const remaining = $derived(Math.max(0, value - now))

  function stop(): void {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
  }

  function checkDue(n: number): void {
    if (value - n <= 0 && !finished) {
      finished = true
      onfinish?.()
      stop()
    }
  }

  function start(): void {
    stop()
    finished = false
    now = Date.now()
    const tick = format.includes('SSS') ? 100 : 1000
    timer = setInterval(() => {
      const n = Date.now()
      now = n
      checkDue(n)
    }, tick)
    checkDue(Date.now())
  }

  $effect(() => {
    // Re-run whenever value or format changes
    void value
    void format
    start()
    return stop
  })
</script>

<div
  {...rest}
  data-iris-countdown
  data-finished={remaining <= 0 ? 'true' : undefined}
  style="display:flex; flex-direction:column; gap:4px;{style ? ' ' + style : ''}"
>
  {#if title != null}
    <div
      data-iris-countdown-title
      style="font-size:var(--iris-font-size-sm, 13px); color:var(--iris-muted);"
    >
      {String(title)}
    </div>
  {/if}
  <div
    data-iris-countdown-value
    style="display:inline-flex; align-items:baseline; gap:4px; font-size:{VALUE_FONT[
      size
    ]}px; font-weight:600; color:var(--iris-foreground); font-variant-numeric:tabular-nums;"
  >
    {#if prefix != null}
      <span style="font-size:0.6em; color:var(--iris-muted);">{String(prefix)}</span>
    {/if}
    <span data-iris-countdown-time>{formatRemaining(remaining, format)}</span>
    {#if suffix != null}
      <span style="font-size:0.6em; color:var(--iris-muted);">{String(suffix)}</span>
    {/if}
  </div>
</div>
