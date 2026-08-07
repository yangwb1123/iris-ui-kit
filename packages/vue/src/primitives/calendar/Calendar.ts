import { computed, defineComponent, h, ref, watch, type PropType } from 'vue'
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
  safeLocale,
  startOfDay,
  startOfMonth,
} from './dateUtils'
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
    const initialMonth = props.defaultMonth ?? props.modelValue ?? new Date()
    const visibleMonth = ref(startOfMonth(initialMonth))
    const focusDate = ref<Date>(clampDate(props.modelValue ?? new Date(), props.min, props.max))

    // Sync visible month if controlled modelValue changes to a different month.
    watch(
      () => props.modelValue,
      (value) => {
        if (value && !isSameMonth(value, visibleMonth.value)) {
          visibleMonth.value = startOfMonth(value)
          focusDate.value = clampDate(value, props.min, props.max)
        }
      },
    )

    const matrix = computed(() => buildMonthMatrix(visibleMonth.value, props.weekStartsOn))
    const weekdays = computed(() => getWeekdayNames(props.weekStartsOn, props.locale))
    const title = computed(() => formatMonthYear(visibleMonth.value, props.locale))
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
      visibleMonth.value = addMonths(visibleMonth.value, -1)
    }
    const goNextMonth = () => {
      visibleMonth.value = addMonths(visibleMonth.value, 1)
    }

    const moveFocus = (delta: number) => {
      const next = clampDate(addDays(focusDate.value, delta), props.min, props.max)
      focusDate.value = next
      if (!isSameMonth(next, visibleMonth.value)) {
        visibleMonth.value = startOfMonth(next)
      }
    }

    const selectDate = (date: Date) => {
      if (props.disabled) return
      if (isOutOfRange(date, props.min, props.max)) return
      emit('update:modelValue', startOfDay(date))
    }

    const onGridKeyDown = (event: KeyboardEvent) => {
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
          const offset = focusDate.value.getDay() - props.weekStartsOn
          moveFocus(-((offset + 7) % 7))
          break
        }
        case 'End': {
          event.preventDefault()
          const offset = (focusDate.value.getDay() - props.weekStartsOn + 7) % 7
          moveFocus(6 - offset)
          break
        }
        case 'PageUp':
          event.preventDefault()
          visibleMonth.value = addMonths(visibleMonth.value, -1)
          focusDate.value = clampDate(addMonths(focusDate.value, -1), props.min, props.max)
          break
        case 'PageDown':
          event.preventDefault()
          visibleMonth.value = addMonths(visibleMonth.value, 1)
          focusDate.value = clampDate(addMonths(focusDate.value, 1), props.min, props.max)
          break
        case 'Enter':
        case ' ':
          event.preventDefault()
          selectDate(focusDate.value)
          break
      }
    }

    const today = startOfDay(new Date())
    const prevDisabled = computed(() => {
      if (!props.min) return false
      return startOfMonth(visibleMonth.value) <= startOfMonth(props.min)
    })
    const nextDisabled = computed(() => {
      if (!props.max) return false
      const endOfVisible = endOfMonth(visibleMonth.value)
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
                  const inMonth = isSameMonth(date, visibleMonth.value)
                  const selected = props.modelValue ? isSameDay(date, props.modelValue) : false
                  const focused = isSameDay(date, focusDate.value)
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
                        focusDate.value = date
                        selectDate(date)
                      },
                      onFocus: () => {
                        focusDate.value = date
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
