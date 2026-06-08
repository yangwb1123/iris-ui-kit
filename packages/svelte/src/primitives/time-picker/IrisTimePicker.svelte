<script lang="ts">
  interface TimeValue {
    hour: number
    minute: number
    second: number
  }

  interface Props {
    value?: TimeValue
    showSeconds?: boolean
    disabled?: boolean
    onValueChange?: (value: TimeValue) => void
    style?: string
    class?: string
  }

  let {
    value = { hour: 0, minute: 0, second: 0 },
    showSeconds = false,
    disabled = false,
    onValueChange,
    style,
    class: className,
    ...rest
  }: Props = $props()

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 60 }, (_, i) => i)
  const seconds = Array.from({ length: 60 }, (_, i) => i)

  function pad(n: number): string {
    return String(n).padStart(2, '0')
  }

  function setHour(h: number) {
    if (disabled) return
    onValueChange?.({ ...value, hour: h })
  }

  function setMinute(m: number) {
    if (disabled) return
    onValueChange?.({ ...value, minute: m })
  }

  function setSecond(s: number) {
    if (disabled) return
    onValueChange?.({ ...value, second: s })
  }

  const colStyle = 'display:flex;flex-direction:column;overflow-y:auto;height:200px;width:52px;scrollbar-width:thin;'
  const itemBase = 'padding:4px 8px;cursor:pointer;text-align:center;font-size:13px;font-family:inherit;border:none;background:transparent;width:100%;'
</script>

<div
  data-iris-time-picker
  data-disabled={disabled ? '' : undefined}
  style:display="inline-flex"
  style:align-items="stretch"
  style:border="1px solid var(--iris-border)"
  style:border-radius="var(--iris-radius-md, 6px)"
  style:background="var(--iris-background)"
  style:color="var(--iris-foreground)"
  style:overflow="hidden"
  style={style}
  class={className}
  {...rest}
>
  <!-- Hours column -->
  <div
    data-iris-time-picker-hours
    role="listbox"
    aria-label="Hours"
    style={colStyle}
  >
    {#each hours as h (h)}
      <button
        type="button"
        role="option"
        aria-selected={value.hour === h}
        data-state={value.hour === h ? 'selected' : 'idle'}
        onclick={() => setHour(h)}
        style={itemBase}
        style:background={value.hour === h ? 'var(--iris-primary)' : 'transparent'}
        style:color={value.hour === h ? 'var(--iris-primary-foreground, #fff)' : 'var(--iris-foreground)'}
        style:opacity={disabled ? '0.5' : '1'}
        style:cursor={disabled ? 'not-allowed' : 'pointer'}
      >{pad(h)}</button>
    {/each}
  </div>

  <div style:width="1px" style:background="var(--iris-border)"></div>

  <!-- Minutes column -->
  <div
    data-iris-time-picker-minutes
    role="listbox"
    aria-label="Minutes"
    style={colStyle}
  >
    {#each minutes as m (m)}
      <button
        type="button"
        role="option"
        aria-selected={value.minute === m}
        data-state={value.minute === m ? 'selected' : 'idle'}
        onclick={() => setMinute(m)}
        style={itemBase}
        style:background={value.minute === m ? 'var(--iris-primary)' : 'transparent'}
        style:color={value.minute === m ? 'var(--iris-primary-foreground, #fff)' : 'var(--iris-foreground)'}
        style:opacity={disabled ? '0.5' : '1'}
        style:cursor={disabled ? 'not-allowed' : 'pointer'}
      >{pad(m)}</button>
    {/each}
  </div>

  {#if showSeconds}
    <div style:width="1px" style:background="var(--iris-border)"></div>

    <!-- Seconds column -->
    <div
      data-iris-time-picker-seconds
      role="listbox"
      aria-label="Seconds"
      style={colStyle}
    >
      {#each seconds as s (s)}
        <button
          type="button"
          role="option"
          aria-selected={value.second === s}
          data-state={value.second === s ? 'selected' : 'idle'}
          onclick={() => setSecond(s)}
          style={itemBase}
          style:background={value.second === s ? 'var(--iris-primary)' : 'transparent'}
          style:color={value.second === s ? 'var(--iris-primary-foreground, #fff)' : 'var(--iris-foreground)'}
          style:opacity={disabled ? '0.5' : '1'}
          style:cursor={disabled ? 'not-allowed' : 'pointer'}
        >{pad(s)}</button>
      {/each}
    </div>
  {/if}
</div>
