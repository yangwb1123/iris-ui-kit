<script lang="ts">
  import {
    createCalendar,
    buildMonthMatrix,
    formatMonthYear,
    getWeekdayNames,
    formatLocalISO,
    type CalendarConfig,
    type CalendarEvent,
  } from '../core'

  let {
    config,
    class: klass = '',
    style = '',
  }: {
    config: CalendarConfig
    class?: string
    style?: string
  } = $props()

  // Create the calendar store ONCE (props are read at construction only).
  // NB: do not name this `state` — Svelte 5 reads `$state` as a rune.
  // svelte-ignore state_referenced_locally
  const store = createCalendar(config)

  let calendarState = $state(store.getState())

  $effect(() => store.subscribe((s) => (calendarState = s)))

  const today = formatLocalISO(new Date())

  const rootStyle = $derived(`font-family:inherit;${style}`)

  function currentDate() {
    return new Date(calendarState.year, calendarState.month, 1)
  }

  function eventsForDate(iso: string): CalendarEvent[] {
    return calendarState.events.filter((e) => e.date === iso)
  }
</script>

<div data-iris-event-calendar class={klass} style={rootStyle}>
  <!-- Header -->
  <div
    data-iris-event-cal-header
    style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"
  >
    <button
      data-iris-event-cal-prev
      aria-label="Previous month"
      onclick={() => store.prevMonth()}
      style="cursor:pointer;background:none;border:none;font-size:1.2em">‹</button
    >
    <span data-iris-event-cal-title style="font-weight:600">
      {formatMonthYear(currentDate())}
    </span>
    <button
      data-iris-event-cal-next
      aria-label="Next month"
      onclick={() => store.nextMonth()}
      style="cursor:pointer;background:none;border:none;font-size:1.2em">›</button
    >
  </div>

  <!-- 7-column grid -->
  <div
    data-iris-event-cal-grid
    style="display:grid;grid-template-columns:repeat(7,1fr);gap:var(--iris-cal-grid-gap,1px)"
  >
    <!-- Weekday headers -->
    {#each getWeekdayNames(0) as name (name)}
      <div
        data-iris-event-cal-weekday
        style="text-align:center;font-weight:600;font-size:0.75em;padding:4px 0;color:var(--iris-muted,#6b7280)"
      >
        {name}
      </div>
    {/each}

    <!-- Day cells -->
    {#each buildMonthMatrix(currentDate(), 0).flat() as date (formatLocalISO(date))}
      {@const iso = formatLocalISO(date)}
      {@const isCurrentMonth = date.getMonth() === calendarState.month}
      {@const isToday = iso === today}
      {@const dayEvents = eventsForDate(iso)}
      <div
        data-iris-event-cal-day={iso}
        style="min-height:64px;padding:4px;border:1px solid var(--iris-border,#e5e7eb);border-radius:4px;cursor:{isCurrentMonth
          ? 'pointer'
          : 'default'};opacity:{isCurrentMonth
          ? '1'
          : '0.4'};background:transparent;display:flex;flex-direction:column;gap:2px"
        onclick={() => {
          if (isCurrentMonth) config.onDateClick?.(iso)
        }}
      >
        <!-- Day number -->
        <span
          data-iris-event-cal-day-num
          style="align-self:flex-start;font-size:0.8em;font-weight:{isToday
            ? '700'
            : '400'};background:{isToday
            ? 'var(--iris-cal-today-bg,#6366f1)'
            : 'transparent'};color:{isToday ? '#fff' : 'inherit'};border-radius:{isToday
            ? '50%'
            : '0'};width:22px;height:22px;display:flex;align-items:center;justify-content:center"
          >{date.getDate()}</span
        >

        <!-- Event chips -->
        {#each dayEvents as event (event.id)}
          <span
            data-iris-event-cal-chip={event.id}
            title={event.title}
            style="font-size:0.7em;background:{event.color
              ? event.color
              : 'var(--iris-cal-event-bg,rgba(99,102,241,0.15))'};color:{event.color
              ? '#fff'
              : 'var(--iris-primary,#6366f1)'};border-radius:3px;padding:1px 4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer;display:block"
            onclick={(e) => {
              e.stopPropagation()
              config.onEventClick?.(event)
            }}>{event.title}</span
          >
        {/each}
      </div>
    {/each}
  </div>
</div>
