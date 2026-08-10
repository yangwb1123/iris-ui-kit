<script lang="ts">
  import {
    buildMonthMatrix,
    clampDate,
    endOfMonth,
    formatLocalISO,
    formatMonthYear,
    getWeekdayNames,
    isOutOfRange,
    isSameDay,
    isSameMonth,
    safeLocale,
    startOfDay,
    startOfMonth,
  } from './dateUtils'
  import { createCalendarNav } from '@iris-ui-kit/core'
  import { toStore } from '../../useStore'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

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

  // Keyboard roving lives in the core `createCalendarNav` controller; this
  // adapter only renders and bridges. Options are captured at creation
  // (svelte-ignore: intentional — the resource-controller precedent).
  // svelte-ignore state_referenced_locally
  const nav = createCalendarNav({
    initialMonth: startOfMonth(defaultMonth ?? value ?? new Date()),
    initialFocusDate: clampDate(value ?? new Date(), min, max),
    weekStartsOn,
    min,
    max,
  })
  const navState = toStore(nav.store)

  $effect(() => {
    // Sync ONLY on an external `value` change (never on internal month
    // navigation): `nav.getVisibleMonth()` is a plain read, not reactive, so
    // this effect re-runs just when `value` moves — matching React/Vue/Solid.
    // (The old $state version tracked the visible month and snapped the view
    // back after PageUp/PageDown when a controlled value was set.)
    if (value && !isSameMonth(value, nav.getVisibleMonth())) {
      nav.setVisibleMonth(startOfMonth(value))
      nav.setFocusDate(clampDate(value, min, max))
    }
  })

  const matrix = $derived(buildMonthMatrix($navState.visibleMonth, weekStartsOn))
  const weekdays = $derived(getWeekdayNames(weekStartsOn, locale))
  const title = $derived(formatMonthYear($navState.visibleMonth, locale))
  // One memoized formatter for the full-date cell label (e.g. "Monday, June 9,
  // 2026") so screen readers announce the whole date, not just the day number.
  const dayLabelFmt = $derived(
    new Intl.DateTimeFormat(safeLocale(locale), {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  )

  const prevDisabled = $derived(
    min ? startOfMonth($navState.visibleMonth) <= startOfMonth(min) : false,
  )
  const nextDisabled = $derived(
    max ? startOfMonth(endOfMonth($navState.visibleMonth)) >= startOfMonth(max) : false,
  )

  const today = startOfDay(new Date())

  function goPrevMonth() {
    nav.goToMonth(-1)
  }

  function goNextMonth() {
    nav.goToMonth(1)
  }

  function selectDate(date: Date) {
    if (disabled) return
    if (isOutOfRange(date, min, max)) return
    onValueChange?.(startOfDay(date))
  }

  function onGridKeyDown(event: KeyboardEvent) {
    if (nav.handleKey(event.key)) {
      event.preventDefault()
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectDate($navState.focusDate)
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->

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
  {style}
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
      aria-label={t('calendar.previousMonth')}
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
      style:opacity={prevDisabled ? '0.4' : '1'}>&#8249;</button
    >

    <div data-iris-calendar-title aria-live="polite" style:font-weight="600" style:font-size="14px">
      {title}
    </div>

    <button
      type="button"
      aria-label={t('calendar.nextMonth')}
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
      style:opacity={nextDisabled ? '0.4' : '1'}>&#8250;</button
    >
  </div>

  <!-- Weekday names -->
  <div
    data-iris-calendar-weekdays
    role="row"
    style:display="grid"
    style:grid-template-columns="repeat(7, minmax(0, 1fr))"
    style:gap="var(--iris-space-xxs, 4px)"
    style:font-size="var(--iris-font-size-xs, 12px)"
    style:color="var(--iris-muted)"
    style:text-align="center"
  >
    {#each weekdays as name (name)}
      <div role="columnheader" style:padding="var(--iris-space-xxs, 4px) 0">{name}</div>
    {/each}
  </div>

  <!-- Day grid -->
  <div
    data-iris-calendar-grid
    role="grid"
    tabindex="-1"
    aria-label={title}
    onkeydown={onGridKeyDown}
    style:display="grid"
    style:grid-template-columns="repeat(7, minmax(0, 1fr))"
    style:gap="var(--iris-space-xxs, 4px)"
  >
    {#each matrix as week}
      <!--
        `display: contents` keeps the row in the accessibility tree (a valid
        grid → row → gridcell structure) while letting its day cells participate
        directly in the parent's 7-column CSS grid layout.
      -->
      <div role="row" style:display="contents">
        {#each week as date (date.toISOString())}
          {@const inMonth = isSameMonth(date, $navState.visibleMonth)}
          {@const selected = value ? isSameDay(date, value) : false}
          {@const focused = isSameDay(date, $navState.focusDate)}
          {@const isToday = isSameDay(date, today)}
          {@const oof = isOutOfRange(date, min, max)}
          {@const isDisabled = disabled || oof}
          <button
            type="button"
            role="gridcell"
            aria-label={dayLabelFmt.format(date)}
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
              nav.setFocusDate(date)
              selectDate(date)
            }}
            onfocus={() => {
              nav.setFocusDate(date)
            }}
            style:height="32px"
            style:display="inline-flex"
            style:align-items="center"
            style:justify-content="center"
            style:background={selected
              ? 'var(--iris-primary)'
              : isToday
                ? 'var(--iris-surface-hover)'
                : 'transparent'}
            style:color={selected
              ? 'var(--iris-primary-foreground, #fff)'
              : inMonth
                ? 'var(--iris-foreground)'
                : 'var(--iris-muted)'}
            style:border="none"
            style:border-radius="var(--iris-radius-sm, 4px)"
            style:cursor={isDisabled ? 'not-allowed' : 'pointer'}
            style:opacity={isDisabled ? '0.45' : '1'}
            style:font-size="13px"
            style:font-family="inherit"
            style:outline="none">{date.getDate()}</button
          >
        {/each}
      </div>
    {/each}
  </div>
</div>
