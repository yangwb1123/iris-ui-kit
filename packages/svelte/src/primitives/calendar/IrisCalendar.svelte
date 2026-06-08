<script lang="ts">
  import {
    addDays,
    addMonths,
    buildMonthMatrix,
    clampDate,
    endOfMonth,
    formatLocalISO,
    formatMonthYear,
    getWeekdayNames,
    isOutOfRange,
    isSameDay,
    isSameMonth,
    startOfDay,
    startOfMonth,
  } from './dateUtils'

  interface Props {
    value?: Date | null
    defaultMonth?: Date | null
    min?: Date
    max?: Date
    /** 0–6, 0 = Sunday */
    weekStartsOn?: number
    locale?: string
    disabled?: boolean
    onValueChange?: (date: Date | null) => void
    style?: string
    class?: string
  }

  let {
    value = null,
    defaultMonth = null,
    min,
    max,
    weekStartsOn = 0,
    locale,
    disabled = false,
    onValueChange,
    style,
    class: className,
    ...rest
  }: Props = $props()

  // svelte-ignore state_referenced_locally
  let visibleMonth = $state(startOfMonth(defaultMonth ?? value ?? new Date()))
  // svelte-ignore state_referenced_locally
  let focusDate = $state(clampDate(value ?? new Date(), min, max))

  $effect(() => {
    if (value && !isSameMonth(value, visibleMonth)) {
      visibleMonth = startOfMonth(value)
      focusDate = clampDate(value, min, max)
    }
  })

  const matrix = $derived(buildMonthMatrix(visibleMonth, weekStartsOn))
  const weekdays = $derived(getWeekdayNames(weekStartsOn, locale))
  const title = $derived(formatMonthYear(visibleMonth, locale))

  const prevDisabled = $derived(min ? startOfMonth(visibleMonth) <= startOfMonth(min) : false)
  const nextDisabled = $derived(max ? startOfMonth(endOfMonth(visibleMonth)) >= startOfMonth(max) : false)

  const today = startOfDay(new Date())

  function goPrevMonth() {
    visibleMonth = addMonths(visibleMonth, -1)
  }

  function goNextMonth() {
    visibleMonth = addMonths(visibleMonth, 1)
  }

  function moveFocus(delta: number) {
    const next = clampDate(addDays(focusDate, delta), min, max)
    focusDate = next
    if (!isSameMonth(next, visibleMonth)) {
      visibleMonth = startOfMonth(next)
    }
  }

  function selectDate(date: Date) {
    if (disabled) return
    if (isOutOfRange(date, min, max)) return
    onValueChange?.(startOfDay(date))
  }

  function onGridKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        moveFocus(-1)
        break
      case 'ArrowRight':
        event.preventDefault()
        moveFocus(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(-7)
        break
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(7)
        break
      case 'Home': {
        event.preventDefault()
        const offset = focusDate.getDay() - weekStartsOn
        moveFocus(-((offset + 7) % 7))
        break
      }
      case 'End': {
        event.preventDefault()
        const offset = (focusDate.getDay() - weekStartsOn + 7) % 7
        moveFocus(6 - offset)
        break
      }
      case 'PageUp':
        event.preventDefault()
        visibleMonth = addMonths(visibleMonth, -1)
        focusDate = clampDate(addMonths(focusDate, -1), min, max)
        break
      case 'PageDown':
        event.preventDefault()
        visibleMonth = addMonths(visibleMonth, 1)
        focusDate = clampDate(addMonths(focusDate, 1), min, max)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        selectDate(focusDate)
        break
    }
  }
</script>

<div
  data-iris-calendar
  data-disabled={disabled ? '' : undefined}
  style:display="inline-flex"
  style:flex-direction="column"
  style:gap="8px"
  style:padding="var(--iris-padding-md, 12px)"
  style:background="var(--iris-surface)"
  style:color="var(--iris-foreground)"
  style:border="1px solid var(--iris-border)"
  style:border-radius="var(--iris-radius-md, 6px)"
  style:min-width="260px"
  style={style}
  class={className}
  {...rest}
>
  <!-- Header -->
  <div
    data-iris-calendar-header
    style:display="flex"
    style:align-items="center"
    style:justify-content="space-between"
    style:gap="4px"
  >
    <button
      type="button"
      aria-label="Previous month"
      data-iris-calendar-prev
      disabled={prevDisabled || undefined}
      onclick={goPrevMonth}
      style:width="28px"
      style:height="28px"
      style:display="inline-flex"
      style:align-items="center"
      style:justify-content="center"
      style:background="transparent"
      style:border="none"
      style:color="var(--iris-foreground)"
      style:cursor={prevDisabled ? 'not-allowed' : 'pointer'}
      style:border-radius="var(--iris-radius-sm, 4px)"
      style:font="inherit"
      style:opacity={prevDisabled ? '0.4' : '1'}
    >&#8249;</button>

    <div
      data-iris-calendar-title
      aria-live="polite"
      style:font-weight="600"
      style:font-size="14px"
    >{title}</div>

    <button
      type="button"
      aria-label="Next month"
      data-iris-calendar-next
      disabled={nextDisabled || undefined}
      onclick={goNextMonth}
      style:width="28px"
      style:height="28px"
      style:display="inline-flex"
      style:align-items="center"
      style:justify-content="center"
      style:background="transparent"
      style:border="none"
      style:color="var(--iris-foreground)"
      style:cursor={nextDisabled ? 'not-allowed' : 'pointer'}
      style:border-radius="var(--iris-radius-sm, 4px)"
      style:font="inherit"
      style:opacity={nextDisabled ? '0.4' : '1'}
    >&#8250;</button>
  </div>

  <!-- Weekday names -->
  <div
    data-iris-calendar-weekdays
    role="row"
    style:display="grid"
    style:grid-template-columns="repeat(7, minmax(0, 1fr))"
    style:gap="2px"
    style:font-size="12px"
    style:color="var(--iris-muted)"
    style:text-align="center"
  >
    {#each weekdays as name (name)}
      <div role="columnheader" style:padding="2px 0">{name}</div>
    {/each}
  </div>

  <!-- Day grid -->
  <div
    data-iris-calendar-grid
    role="grid"
    aria-label={title}
    onkeydown={onGridKeyDown}
    style:display="grid"
    style:grid-template-columns="repeat(7, minmax(0, 1fr))"
    style:gap="2px"
  >
    {#each matrix as row}
      {#each row as date (date.toISOString())}
        {@const inMonth = isSameMonth(date, visibleMonth)}
        {@const selected = value ? isSameDay(date, value) : false}
        {@const focused = isSameDay(date, focusDate)}
        {@const isToday = isSameDay(date, today)}
        {@const oof = isOutOfRange(date, min, max)}
        {@const isDisabled = disabled || oof}
        <button
          type="button"
          role="gridcell"
          tabindex={focused ? 0 : -1}
          aria-selected={selected ? 'true' : 'false'}
          aria-disabled={isDisabled ? 'true' : undefined}
          aria-current={isToday ? 'date' : undefined}
          data-iris-calendar-day
          data-iris-calendar-day-iso={formatLocalISO(date)}
          data-state={selected ? 'selected' : focused ? 'focused' : isToday ? 'today' : 'idle'}
          data-outside-month={!inMonth ? 'true' : undefined}
          disabled={isDisabled || undefined}
          onclick={() => {
            focusDate = date
            selectDate(date)
          }}
          onfocus={() => { focusDate = date }}
          style:height="32px"
          style:display="inline-flex"
          style:align-items="center"
          style:justify-content="center"
          style:background={selected ? 'var(--iris-primary)' : isToday ? 'var(--iris-surface-hover)' : 'transparent'}
          style:color={selected ? 'var(--iris-primary-foreground, #fff)' : inMonth ? 'var(--iris-foreground)' : 'var(--iris-muted)'}
          style:border="none"
          style:border-radius="var(--iris-radius-sm, 4px)"
          style:cursor={isDisabled ? 'not-allowed' : 'pointer'}
          style:opacity={isDisabled ? '0.45' : '1'}
          style:font-size="13px"
          style:font-family="inherit"
          style:outline="none"
        >{date.getDate()}</button>
      {/each}
    {/each}
  </div>
</div>
