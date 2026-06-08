<script lang="ts">
  import IrisCalendar from '../calendar/IrisCalendar.svelte'
  import { startOfDay } from '../calendar/dateUtils'

  interface DateRange {
    start: Date | null
    end: Date | null
  }

  interface Props {
    value?: DateRange
    min?: Date
    max?: Date
    weekStartsOn?: number
    locale?: string
    disabled?: boolean
    invalid?: boolean
    startPlaceholder?: string
    endPlaceholder?: string
    onValueChange?: (range: DateRange) => void
    style?: string
    class?: string
  }

  let {
    value = { start: null, end: null },
    min,
    max,
    weekStartsOn = 0,
    locale,
    disabled = false,
    invalid = false,
    startPlaceholder = 'Start date',
    endPlaceholder = 'End date',
    onValueChange,
    style,
    class: className,
    ...rest
  }: Props = $props()

  let open = $state(false)
  // picking = 'start' | 'end'
  let picking = $state<'start' | 'end'>('start')
  let containerEl = $state<HTMLElement | undefined>(undefined)

  function fmt(d: Date | null): string {
    if (!d) return ''
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d)
  }

  function openPicker(side: 'start' | 'end') {
    if (disabled) return
    picking = side
    open = true
  }

  function onSelect(date: Date | null) {
    if (!date) return
    const d = startOfDay(date)
    if (picking === 'start') {
      const newRange: DateRange = { start: d, end: value.end }
      // If start > end, clear end
      if (newRange.end && d > newRange.end) newRange.end = null
      onValueChange?.(newRange)
      picking = 'end'
    } else {
      let newRange: DateRange
      if (value.start && d < value.start) {
        // Swap
        newRange = { start: d, end: value.start }
      } else {
        newRange = { start: value.start, end: d }
      }
      onValueChange?.(newRange)
      open = false
    }
  }

  function onDocDown(e: MouseEvent) {
    if (open && containerEl && !containerEl.contains(e.target as Node)) open = false
  }

  $effect(() => {
    if (open) {
      document.addEventListener('mousedown', onDocDown)
    } else {
      document.removeEventListener('mousedown', onDocDown)
    }
    return () => document.removeEventListener('mousedown', onDocDown)
  })
</script>

<div
  bind:this={containerEl}
  data-iris-date-range-picker
  style:position="relative"
  style:display="inline-flex"
  style:align-items="center"
  style:gap="4px"
  style={style}
  class={className}
  {...rest}
>
  <button
    type="button"
    data-iris-date-range-picker-start
    aria-label="Start date"
    {disabled}
    onclick={() => openPicker('start')}
    style:padding="6px 12px"
    style:background="var(--iris-background)"
    style:color={value.start ? 'var(--iris-foreground)' : 'var(--iris-muted)'}
    style:border={`1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`}
    style:border-radius="var(--iris-radius-md, 6px)"
    style:cursor={disabled ? 'not-allowed' : 'pointer'}
    style:font-size="14px"
    style:font-family="inherit"
    style:min-height="34px"
    style:min-width="140px"
  >{fmt(value.start) || startPlaceholder}</button>

  <span aria-hidden="true" style:color="var(--iris-muted)">–</span>

  <button
    type="button"
    data-iris-date-range-picker-end
    aria-label="End date"
    {disabled}
    onclick={() => openPicker('end')}
    style:padding="6px 12px"
    style:background="var(--iris-background)"
    style:color={value.end ? 'var(--iris-foreground)' : 'var(--iris-muted)'}
    style:border={`1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`}
    style:border-radius="var(--iris-radius-md, 6px)"
    style:cursor={disabled ? 'not-allowed' : 'pointer'}
    style:font-size="14px"
    style:font-family="inherit"
    style:min-height="34px"
    style:min-width="140px"
  >{fmt(value.end) || endPlaceholder}</button>

  {#if open}
    <div
      data-iris-date-range-picker-content
      role="dialog"
      aria-modal="true"
      style:position="absolute"
      style:top="calc(100% + 4px)"
      style:left="0"
      style:z-index="50"
    >
      <IrisCalendar
        value={picking === 'start' ? value.start : value.end}
        {min}
        {max}
        {weekStartsOn}
        {locale}
        {disabled}
        onValueChange={onSelect}
        style="border: none;"
      />
    </div>
  {/if}
</div>
