import { computed, defineComponent, h, watch, type PropType } from 'vue'
import { createCalendarNav } from '@iris-ui-kit/core'
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
import { useStore } from '../../useStore'
import { useI18n } from '../../i18n'

/**
 * Month-view calendar. Single date selection only (range pickers are a
 * follow-up). Pure presentation + keyboard navigation; the trigger overlay
 * lives in `IrisDatePicker`.
 *
 * Keyboard:
 *   - Arrow keys move the focused date
 *   - Home / End jump to start/end of the focused week
 *   - PageUp / PageDown move by month
 *   - Enter / Space select the focused date
 */
export const IrisCalendar = defineComponent({
  name: 'IrisCalendar',
  inheritAttrs: false,
  props: {
    modelValue: { type: Date as unknown as PropType<Date | null>, default: null },
    /** Initial visible month (defaults to selected value or today). */
    defaultMonth: { type: Date as unknown as PropType<Date | null>, default: null },
    min: { type: Date as unknown as PropType<Date | undefined>, default: undefined },
    max: { type: Date as unknown as PropType<Date | undefined>, default: undefined },
    /** 0–6, 0 = Sunday. Default 0. */
    weekStartsOn: { type: Number, default: 0 },
    locale: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: Date | null) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    // Keyboard roving lives in the core `createCalendarNav` controller; this
    // adapter only renders and bridges. Options are captured at creation.
    const initialMonth = props.defaultMonth ?? props.modelValue ?? new Date()
    const nav = createCalendarNav({
      initialMonth: startOfMonth(initialMonth),
      initialFocusDate: clampDate(props.modelValue ?? new Date(), props.min, props.max),
      weekStartsOn: props.weekStartsOn,
      min: props.min,
      max: props.max,
    })
    const state = useStore(nav.store)

    // Sync visible month if controlled modelValue changes to a different month.
    watch(
      () => props.modelValue,
      (value) => {
        if (value && !isSameMonth(value, nav.getVisibleMonth())) {
          nav.setVisibleMonth(startOfMonth(value))
          nav.setFocusDate(clampDate(value, props.min, props.max))
        }
      },
    )

    const matrix = computed(() => buildMonthMatrix(state.value.visibleMonth, props.weekStartsOn))
    const weekdays = computed(() => getWeekdayNames(props.weekStartsOn, props.locale))
    const title = computed(() => formatMonthYear(state.value.visibleMonth, props.locale))
    // One memoized formatter for the full-date cell label (e.g. "Monday, June 9,
    // 2026") so screen readers announce the whole date, not just the day number.
    const dayLabelFmt = computed(
      () =>
        new Intl.DateTimeFormat(safeLocale(props.locale), {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
    )

    const goPrevMonth = () => {
      nav.goToMonth(-1)
    }
    const goNextMonth = () => {
      nav.goToMonth(1)
    }

    const selectDate = (date: Date) => {
      if (props.disabled) return
      if (isOutOfRange(date, props.min, props.max)) return
      emit('update:modelValue', startOfDay(date))
    }

    const onGridKeyDown = (event: KeyboardEvent) => {
      if (nav.handleKey(event.key)) {
        event.preventDefault()
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        selectDate(state.value.focusDate)
      }
    }

    const today = startOfDay(new Date())
    const prevDisabled = computed(() => {
      if (!props.min) return false
      return startOfMonth(state.value.visibleMonth) <= startOfMonth(props.min)
    })
    const nextDisabled = computed(() => {
      if (!props.max) return false
      const endOfVisible = endOfMonth(state.value.visibleMonth)
      return startOfMonth(endOfVisible) >= startOfMonth(props.max)
    })

    const navButtonStyle: Record<string, string> = {
      width: '28px',
      height: '28px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      border: 'none',
      color: 'var(--iris-foreground)',
      cursor: 'pointer',
      borderRadius: 'var(--iris-radius-sm, 4px)',
      font: 'inherit',
    }

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-calendar': '',
          'data-disabled': props.disabled ? '' : undefined,
          style: {
            display: 'inline-flex',
            flexDirection: 'column',
            gap: '8px',
            padding: 'var(--iris-padding-md, 12px)',
            background: 'var(--iris-surface)',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            minWidth: '260px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          // Header
          h(
            'div',
            {
              'data-iris-calendar-header': '',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '4px',
              },
            },
            [
              h(
                'button',
                {
                  type: 'button',
                  'aria-label': t('calendar.previousMonth'),
                  'data-iris-calendar-prev': '',
                  disabled: prevDisabled.value || undefined,
                  onClick: goPrevMonth,
                  style: {
                    ...navButtonStyle,
                    opacity: prevDisabled.value ? '0.4' : '1',
                    cursor: prevDisabled.value ? 'not-allowed' : 'pointer',
                  },
                },
                '‹',
              ),
              h(
                'div',
                {
                  'data-iris-calendar-title': '',
                  'aria-live': 'polite',
                  style: { fontWeight: '600', fontSize: 'var(--iris-font-size-md, 14px)' },
                },
                title.value,
              ),
              h(
                'button',
                {
                  type: 'button',
                  'aria-label': t('calendar.nextMonth'),
                  'data-iris-calendar-next': '',
                  disabled: nextDisabled.value || undefined,
                  onClick: goNextMonth,
                  style: {
                    ...navButtonStyle,
                    opacity: nextDisabled.value ? '0.4' : '1',
                    cursor: nextDisabled.value ? 'not-allowed' : 'pointer',
                  },
                },
                '›',
              ),
            ],
          ),
          // Weekday header
          h(
            'div',
            {
              'data-iris-calendar-weekdays': '',
              role: 'row',
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: 'var(--iris-space-xxs, 4px)',
                fontSize: 'var(--iris-font-size-xs, 12px)',
                color: 'var(--iris-muted)',
                textAlign: 'center',
              },
            },
            weekdays.value.map((name) =>
              h(
                'div',
                {
                  key: name,
                  role: 'columnheader',
                  style: { padding: 'var(--iris-space-xxs, 4px) 0' },
                },
                name,
              ),
            ),
          ),
          // Day grid
          h(
            'div',
            {
              'data-iris-calendar-grid': '',
              role: 'grid',
              'aria-label': title.value,
              onKeydown: onGridKeyDown,
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: 'var(--iris-space-xxs, 4px)',
              },
            },
            matrix.value.map((week, wi) =>
              // `display: contents` keeps the row in the accessibility tree (a
              // valid grid → row → gridcell structure) while letting its day cells
              // participate directly in the parent's 7-column CSS grid layout.
              h(
                'div',
                { key: `week-${wi}`, role: 'row', style: { display: 'contents' } },
                week.map((date) => {
                  const inMonth = isSameMonth(date, state.value.visibleMonth)
                  const selected = props.modelValue ? isSameDay(date, props.modelValue) : false
                  const focused = isSameDay(date, state.value.focusDate)
                  const isToday = isSameDay(date, today)
                  const oof = isOutOfRange(date, props.min, props.max)
                  const isDisabled = props.disabled || oof
                  return h(
                    'button',
                    {
                      key: date.toISOString(),
                      type: 'button',
                      role: 'gridcell',
                      'aria-label': dayLabelFmt.value.format(date),
                      tabindex: focused ? 0 : -1,
                      'aria-selected': selected ? 'true' : 'false',
                      'aria-disabled': isDisabled ? 'true' : undefined,
                      'aria-current': isToday ? 'date' : undefined,
                      'data-iris-calendar-day': '',
                      'data-iris-calendar-day-iso': formatLocalISO(date),
                      'data-state': selected
                        ? 'selected'
                        : focused
                          ? 'focused'
                          : isToday
                            ? 'today'
                            : 'idle',
                      'data-outside-month': !inMonth ? 'true' : undefined,
                      disabled: isDisabled || undefined,
                      onClick: () => {
                        nav.setFocusDate(date)
                        selectDate(date)
                      },
                      onFocus: () => {
                        nav.setFocusDate(date)
                      },
                      style: {
                        height: '32px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: selected
                          ? 'var(--iris-primary)'
                          : isToday
                            ? 'var(--iris-surface-hover)'
                            : 'transparent',
                        color: selected
                          ? 'var(--iris-primary-foreground, #fff)'
                          : inMonth
                            ? 'var(--iris-foreground)'
                            : 'var(--iris-muted)',
                        border: 'none',
                        borderRadius: 'var(--iris-radius-sm, 4px)',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? '0.45' : '1',
                        fontSize: 'var(--iris-font-size-sm, 13px)',
                        fontFamily: 'inherit',
                        outline: 'none',
                      },
                    },
                    String(date.getDate()),
                  )
                }),
              ),
            ),
          ),
        ],
      )
  },
})
