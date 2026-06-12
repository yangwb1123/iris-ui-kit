import {
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  shallowRef,
  type PropType,
  type VNode,
} from 'vue'
import {
  createCalendar,
  buildMonthMatrix,
  formatMonthYear,
  getWeekdayNames,
  formatLocalISO,
  type CalendarConfig,
  type CalendarEvent,
} from '../core'

export type { CalendarEvent, CalendarConfig, CalendarState, CalendarStore } from '../core'

/**
 * Render a month-view events calendar from a declarative config (Vue, render-
 * function authored to match the `@iris-ui/vue` convention). Event chips are
 * clickable; day cells call `config.onDateClick`. Themed via CSS vars.
 */
export const IrisEventCalendar = defineComponent({
  name: 'IrisEventCalendar',
  props: {
    config: { type: Object as PropType<CalendarConfig>, required: true },
    class: { type: String, default: undefined },
    style: { type: Object as PropType<Record<string, string>>, default: undefined },
  },
  setup(props) {
    const store = createCalendar(props.config)
    const calendarState = shallowRef(store.getState())
    let unsub = () => {}
    onMounted(() => {
      unsub = store.subscribe((s) => {
        calendarState.value = s
      })
    })
    onUnmounted(() => unsub())

    return () => {
      const s = calendarState.value
      const currentDate = new Date(s.year, s.month, 1)
      const matrix = buildMonthMatrix(currentDate, 0)
      const weekdayNames = getWeekdayNames(0)
      const today = formatLocalISO(new Date())
      const monthLabel = formatMonthYear(currentDate)

      // Weekday headers
      const weekdayNodes: VNode[] = weekdayNames.map((name) =>
        h(
          'div',
          {
            'data-iris-event-cal-weekday': '',
            style: {
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '0.75em',
              padding: '4px 0',
              color: 'var(--iris-color-muted, #6b7280)',
            },
          },
          name,
        ),
      )

      // Day cells
      const dayCells: VNode[] = matrix.flat().map((date) => {
        const iso = formatLocalISO(date)
        const isCurrentMonth = date.getMonth() === s.month
        const isToday = iso === today
        const dayEvents = s.events.filter((e: CalendarEvent) => e.date === iso)

        const dayNumNode = h(
          'span',
          {
            'data-iris-event-cal-day-num': '',
            style: {
              alignSelf: 'flex-start',
              fontSize: '0.8em',
              fontWeight: isToday ? '700' : '400',
              background: isToday ? 'var(--iris-cal-today-bg, #6366f1)' : 'transparent',
              color: isToday ? '#fff' : 'inherit',
              borderRadius: isToday ? '50%' : '0',
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          },
          String(date.getDate()),
        )

        const chipNodes: VNode[] = dayEvents.map((event: CalendarEvent) =>
          h(
            'span',
            {
              key: event.id,
              'data-iris-event-cal-chip': event.id,
              title: event.title,
              style: {
                fontSize: '0.7em',
                background: event.color
                  ? event.color
                  : 'var(--iris-cal-event-bg, rgba(99,102,241,0.15))',
                color: event.color ? '#fff' : 'var(--iris-color-primary, #6366f1)',
                borderRadius: '3px',
                padding: '1px 4px',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                cursor: 'pointer',
                display: 'block',
              },
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                props.config.onEventClick?.(event)
              },
            },
            event.title,
          ),
        )

        return h(
          'div',
          {
            key: iso,
            'data-iris-event-cal-day': iso,
            style: {
              minHeight: '64px',
              padding: '4px',
              border: '1px solid var(--iris-color-border, #e5e7eb)',
              borderRadius: '4px',
              cursor: isCurrentMonth ? 'pointer' : 'default',
              opacity: isCurrentMonth ? '1' : '0.4',
              background: 'transparent',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            },
            onClick: () => {
              if (isCurrentMonth) props.config.onDateClick?.(iso)
            },
          },
          [dayNumNode, ...chipNodes],
        )
      })

      return h(
        'div',
        {
          'data-iris-event-calendar': '',
          class: props.class,
          style: { fontFamily: 'inherit', ...props.style },
        },
        [
          // Header
          h(
            'div',
            {
              'data-iris-event-cal-header': '',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              },
            },
            [
              h(
                'button',
                {
                  'data-iris-event-cal-prev': '',
                  'aria-label': 'Previous month',
                  style: {
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    fontSize: '1.2em',
                  },
                  onClick: () => store.prevMonth(),
                },
                '‹',
              ),
              h(
                'span',
                { 'data-iris-event-cal-title': '', style: { fontWeight: '600' } },
                monthLabel,
              ),
              h(
                'button',
                {
                  'data-iris-event-cal-next': '',
                  'aria-label': 'Next month',
                  style: {
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    fontSize: '1.2em',
                  },
                  onClick: () => store.nextMonth(),
                },
                '›',
              ),
            ],
          ),
          // Grid
          h(
            'div',
            {
              'data-iris-event-cal-grid': '',
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 'var(--iris-cal-grid-gap, 1px)',
              },
            },
            [...weekdayNodes, ...dayCells],
          ),
        ],
      )
    }
  },
})
