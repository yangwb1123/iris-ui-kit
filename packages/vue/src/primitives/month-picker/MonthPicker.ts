import { computed, defineComponent, h, nextTick, ref, watch, type PropType } from 'vue'
import type { Placement } from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { IrisPopover } from '../popover/Popover'
import { IrisPopoverContent } from '../popover/PopoverContent'
import { IrisPopoverTrigger } from '../popover/PopoverTrigger'
import {
  formatLocalYearMonth,
  isOutOfMonthRange,
  safeLocale,
  startOfMonth,
} from '../calendar/dateUtils'

interface MonthOption {
  date: Date
  index: number
  label: string
  value: string
}

type StyleMap = Record<string, string | number>

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime())
}

function monthAt(year: number, index: number): Date {
  return new Date(year, index, 1)
}

function formatMonthLabel(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(safeLocale(locale), { month: 'short' }).format(date)
}

function formatDisplay(date: Date | null, locale?: string): string {
  if (!isValidDate(date)) return ''
  return new Intl.DateTimeFormat(safeLocale(locale), {
    month: 'long',
    year: 'numeric',
  }).format(startOfMonth(date))
}

function yearHasSelectableMonth(year: number, min?: Date, max?: Date): boolean {
  for (let index = 0; index < 12; index += 1) {
    if (!isOutOfMonthRange(monthAt(year, index), min, max)) return true
  }
  return false
}

function nextEnabledIndex(
  current: number,
  delta: number,
  year: number,
  min?: Date,
  max?: Date,
): number {
  let next = current
  for (let attempts = 0; attempts < 12; attempts += 1) {
    next = Math.max(0, Math.min(11, next + delta))
    if (!isOutOfMonthRange(monthAt(year, next), min, max)) return next
    if (next === 0 || next === 11) return current
  }
  return current
}

const triggerBaseStyle: StyleMap = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
  background: 'var(--iris-background)',
  borderRadius: 'var(--iris-radius-md, 6px)',
  fontSize: 'var(--iris-font-size-md, 14px)',
  fontFamily: 'inherit',
  minHeight: 'var(--iris-control-height-md, 34px)',
  minWidth: '180px',
  textAlign: 'start',
}

const yearButtonStyle: StyleMap = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: '0',
  background: 'transparent',
  color: 'var(--iris-foreground)',
  border: '1px solid transparent',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  font: 'inherit',
  cursor: 'pointer',
}

const monthButtonStyle: StyleMap = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: 'var(--iris-control-height-sm, 28px)',
  padding: 'var(--iris-space-xs, 8px)',
  background: 'transparent',
  color: 'var(--iris-foreground)',
  border: '1px solid var(--iris-border)',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  font: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/**
 * Month-only picker composed from Iris Popover primitives.
 *
 * The public value is a local-time `Date` normalized to the first day of its
 * month. The panel intentionally offers a 12-month grid rather than a native
 * month input, select, or day-level calendar.
 *
 * @example
 * <IrisMonthPicker v-model="month" locale="en-US" />
 */
export const IrisMonthPicker = defineComponent({
  name: 'IrisMonthPicker',
  inheritAttrs: false,
  props: {
    modelValue: { type: Date as unknown as PropType<Date | null>, default: null },
    /** Initial visible year when `modelValue` is empty. */
    defaultMonth: { type: Date as unknown as PropType<Date | null>, default: null },
    /** Inclusive month bounds; individual days are ignored. */
    min: { type: Date as unknown as PropType<Date | undefined>, default: undefined },
    max: { type: Date as unknown as PropType<Date | undefined>, default: undefined },
    locale: { type: String, default: undefined },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    placement: { type: String as PropType<Placement>, default: 'bottom-start' },
    /** id forwarded to the trigger. Set by IrisFormField. */
    id: { type: String, default: undefined },
    /** Forwarded as aria-describedby on the trigger. */
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: Date | null) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const open = ref(false)
    const panelRef = ref<HTMLElement | null>(null)
    const initialMonth = isValidDate(props.modelValue)
      ? props.modelValue
      : isValidDate(props.defaultMonth)
        ? props.defaultMonth
        : new Date()
    const visibleYear = ref(initialMonth.getFullYear())
    const focusedIndex = ref(isValidDate(props.modelValue) ? props.modelValue.getMonth() : 0)

    watch(
      () => props.modelValue,
      (value) => {
        if (!isValidDate(value)) return
        visibleYear.value = value.getFullYear()
        focusedIndex.value = value.getMonth()
      },
    )

    const selectedValue = computed(() =>
      isValidDate(props.modelValue) ? formatLocalYearMonth(startOfMonth(props.modelValue)) : null,
    )
    const triggerLabel = computed(
      () =>
        formatDisplay(props.modelValue, props.locale) ||
        props.placeholder ||
        t('monthPicker.placeholder'),
    )
    const months = computed<MonthOption[]>(() =>
      Array.from({ length: 12 }, (_, index) => {
        const date = monthAt(visibleYear.value, index)
        return {
          date,
          index,
          label: formatMonthLabel(date, props.locale),
          value: formatLocalYearMonth(date),
        }
      }),
    )
    const previousYearDisabled = computed(
      () => !yearHasSelectableMonth(visibleYear.value - 1, props.min, props.max),
    )
    const nextYearDisabled = computed(
      () => !yearHasSelectableMonth(visibleYear.value + 1, props.min, props.max),
    )
    const focusMonth = (index: number): void => {
      focusedIndex.value = index
      void nextTick(() => {
        const button = panelRef.value?.querySelector<HTMLButtonElement>(
          `[data-iris-month-picker-month="${months.value[index]?.value ?? ''}"]`,
        )
        button?.focus()
      })
    }
    const selectMonth = (index: number): void => {
      if (props.disabled) return
      const date = monthAt(visibleYear.value, index)
      if (isOutOfMonthRange(date, props.min, props.max)) return
      emit('update:modelValue', date)
      open.value = false
    }
    const moveYear = (offset: number): void => {
      if (props.disabled) return
      const nextYear = visibleYear.value + offset
      if (!yearHasSelectableMonth(nextYear, props.min, props.max)) return
      visibleYear.value = nextYear
      const nextIndex = isOutOfMonthRange(
        monthAt(nextYear, focusedIndex.value),
        props.min,
        props.max,
      )
        ? months.value.findIndex((month) => !isOutOfMonthRange(month.date, props.min, props.max))
        : focusedIndex.value
      focusedIndex.value = nextIndex < 0 ? 0 : nextIndex
    }
    const handleMonthKeydown = (event: KeyboardEvent): void => {
      let delta = 0
      if (event.key === 'ArrowLeft') delta = -1
      if (event.key === 'ArrowRight') delta = 1
      if (event.key === 'ArrowUp') delta = -3
      if (event.key === 'ArrowDown') delta = 3
      if (event.key === 'Home') {
        event.preventDefault()
        const first = months.value.find(
          (month) => !isOutOfMonthRange(month.date, props.min, props.max),
        )
        if (first) focusMonth(first.index)
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        const last = [...months.value]
          .reverse()
          .find((month) => !isOutOfMonthRange(month.date, props.min, props.max))
        if (last) focusMonth(last.index)
        return
      }
      if (!delta) return
      const next = nextEnabledIndex(
        focusedIndex.value,
        delta,
        visibleYear.value,
        props.min,
        props.max,
      )
      if (next === focusedIndex.value) return
      event.preventDefault()
      focusMonth(next)
    }

    return () =>
      h(
        IrisPopover,
        {
          open: open.value,
          placement: props.placement,
          'onUpdate:open': (value: boolean) => (open.value = value),
        },
        {
          default: () => [
            h(IrisPopoverTrigger, { asChild: true }, () => [
              h(
                'button',
                {
                  ...attrs,
                  type: 'button',
                  id: props.id,
                  disabled: props.disabled || undefined,
                  'aria-invalid': props.invalid ? 'true' : undefined,
                  'aria-describedby': props.ariaDescribedby,
                  'data-iris-month-picker-trigger': '',
                  'data-iris-month-picker-value': selectedValue.value ?? undefined,
                  style: {
                    ...triggerBaseStyle,
                    color: selectedValue.value ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                    border: `1px solid ${props.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
                    cursor: props.disabled ? 'not-allowed' : 'pointer',
                    opacity: props.disabled ? '0.6' : '1',
                    ...((attrs.style as StyleMap | undefined) ?? {}),
                  },
                },
                triggerLabel.value,
              ),
            ]),
            h(IrisPopoverContent, { style: { padding: '0' } }, () =>
              h(
                'div',
                {
                  ref: (element: unknown) => {
                    panelRef.value = (element ?? null) as HTMLElement | null
                  },
                  'data-iris-month-picker-panel': '',
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--iris-space-sm, 12px)',
                    padding: 'var(--iris-padding-sm, 8px)',
                    minWidth: '18rem',
                  },
                },
                [
                  h(
                    'div',
                    {
                      'data-iris-month-picker-header': '',
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--iris-space-xs, 8px)',
                      },
                    },
                    [
                      h(
                        'button',
                        {
                          type: 'button',
                          'aria-label': t('monthPicker.previousYear'),
                          'data-iris-month-picker-prev': '',
                          disabled: props.disabled || previousYearDisabled.value || undefined,
                          onClick: () => moveYear(-1),
                          style: {
                            ...yearButtonStyle,
                            opacity: previousYearDisabled.value ? '0.4' : '1',
                            cursor:
                              props.disabled || previousYearDisabled.value
                                ? 'not-allowed'
                                : 'pointer',
                          },
                        },
                        '‹',
                      ),
                      h(
                        'strong',
                        {
                          'data-iris-month-picker-year': '',
                          'aria-live': 'polite',
                          style: {
                            color: 'var(--iris-foreground)',
                            fontSize: 'var(--iris-font-size-md, 14px)',
                            lineHeight: 'var(--iris-font-line-height-md, 1.5)',
                          },
                        },
                        String(visibleYear.value),
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          'aria-label': t('monthPicker.nextYear'),
                          'data-iris-month-picker-next': '',
                          disabled: props.disabled || nextYearDisabled.value || undefined,
                          onClick: () => moveYear(1),
                          style: {
                            ...yearButtonStyle,
                            opacity: nextYearDisabled.value ? '0.4' : '1',
                            cursor:
                              props.disabled || nextYearDisabled.value ? 'not-allowed' : 'pointer',
                          },
                        },
                        '›',
                      ),
                    ],
                  ),
                  h(
                    'div',
                    {
                      role: 'radiogroup',
                      'aria-label': t('monthPicker.months', { year: visibleYear.value }),
                      'data-iris-month-picker-grid': '',
                      style: {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 'var(--iris-space-xs, 8px)',
                      },
                    },
                    months.value.map((month) => {
                      const selected = month.value === selectedValue.value
                      const monthDisabled = isOutOfMonthRange(month.date, props.min, props.max)
                      return h(
                        'button',
                        {
                          key: month.value,
                          type: 'button',
                          role: 'radio',
                          'aria-checked': selected ? 'true' : 'false',
                          'aria-label': month.label,
                          'data-iris-month-picker-month': month.value,
                          disabled: props.disabled || monthDisabled || undefined,
                          tabindex: month.index === focusedIndex.value ? 0 : -1,
                          onFocus: () => (focusedIndex.value = month.index),
                          onKeydown: handleMonthKeydown,
                          onClick: () => selectMonth(month.index),
                          style: {
                            ...monthButtonStyle,
                            background: selected ? 'var(--iris-primary)' : 'transparent',
                            color: selected
                              ? 'var(--iris-primary-foreground)'
                              : 'var(--iris-foreground)',
                            cursor: props.disabled || monthDisabled ? 'not-allowed' : 'pointer',
                            opacity: monthDisabled ? '0.45' : '1',
                          },
                        },
                        month.label,
                      )
                    }),
                  ),
                ],
              ),
            ),
          ],
        },
      )
  },
})

/** Public prop surface inferred from the runtime Vue component. */
export type IrisMonthPickerProps = InstanceType<typeof IrisMonthPicker>['$props']

export default IrisMonthPicker
