import { computed, defineComponent, h, ref, type PropType } from 'vue'
import type { Placement } from '@iris-ui-kit/core'
import { IrisPopover } from '../popover/Popover'
import { IrisPopoverTrigger } from '../popover/PopoverTrigger'
import { IrisPopoverContent } from '../popover/PopoverContent'
import { IrisCalendar } from '../calendar/Calendar'
import { addMonths, safeLocale, startOfDay, startOfMonth } from '../calendar/dateUtils'
import { useI18n } from '../../i18n'

export interface IrisDateRange {
  start: Date | null
  end: Date | null
}

function formatDisplay(d: Date | null, locale?: string): string {
  if (!d) return ''
  return new Intl.DateTimeFormat(safeLocale(locale), { dateStyle: 'medium' }).format(d)
}

/**
 * Range date picker. Renders a trigger that shows `start → end`; the popover
 * surface contains two month calendars (current + next month) so users can
 * select both endpoints without navigation.
 *
 * Click order:
 *   - First click → sets `start` (and clears `end`).
 *   - Second click → sets `end` (auto-swaps if before `start`).
 */
export const IrisDateRangePicker = defineComponent({
  name: 'IrisDateRangePicker',
  inheritAttrs: false,
  props: {
    modelValue: {
      type: Object as PropType<IrisDateRange | null>,
      default: () => ({ start: null, end: null }),
    },
    min: { type: Date as unknown as PropType<Date | undefined>, default: undefined },
    max: { type: Date as unknown as PropType<Date | undefined>, default: undefined },
    weekStartsOn: { type: Number, default: 0 },
    locale: { type: String, default: undefined },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    placement: { type: String as PropType<Placement>, default: 'bottom-start' },
    id: { type: String, default: undefined },
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: IrisDateRange) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const open = ref(false)
    const value = computed<IrisDateRange>(() => props.modelValue ?? { start: null, end: null })

    const leftMonth = ref<Date>(
      value.value.start ? startOfMonth(value.value.start) : startOfMonth(new Date()),
    )

    const display = computed(() => {
      const s = formatDisplay(value.value.start, props.locale)
      const e = formatDisplay(value.value.end, props.locale)
      if (s && e) return `${s}  →  ${e}`
      if (s) return `${s}  →  …`
      return ''
    })

    const handleSelect = (next: Date | null) => {
      if (!next) return
      const d = startOfDay(next)
      const v = value.value
      if (!v.start || (v.start && v.end)) {
        // Begin new range.
        emit('update:modelValue', { start: d, end: null })
        return
      }
      // Closing the range — swap if before start.
      let s = v.start
      let e = d
      if (e < s) {
        ;[s, e] = [e, s]
      }
      emit('update:modelValue', { start: s, end: e })
      // Close on completion.
      open.value = false
    }

    const previewSelected = computed(() => value.value.end ?? value.value.start)

    return () =>
      h(
        IrisPopover,
        {
          open: open.value,
          placement: props.placement,
          'onUpdate:open': (v: boolean) => (open.value = v),
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
                  'data-iris-date-range-picker-trigger': '',
                  'data-state': open.value ? 'open' : 'closed',
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    background: 'var(--iris-background)',
                    color: display.value ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                    border: `1px solid ${props.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
                    borderRadius: 'var(--iris-radius-md, 6px)',
                    cursor: props.disabled ? 'not-allowed' : 'pointer',
                    opacity: props.disabled ? '0.6' : '1',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    minHeight: '34px',
                    minWidth: '260px',
                    textAlign: 'start',
                    ...((attrs.style as Record<string, string> | undefined) ?? {}),
                  },
                },
                display.value || (props.placeholder ?? t('dateRangePicker.placeholder')),
              ),
            ]),
            h(IrisPopoverContent, { style: { padding: '0' } }, () =>
              h(
                'div',
                {
                  'data-iris-date-range-picker-pane': '',
                  style: { display: 'flex', gap: '8px' },
                },
                [
                  h(IrisCalendar, {
                    modelValue: previewSelected.value,
                    defaultMonth: leftMonth.value,
                    min: props.min,
                    max: props.max,
                    weekStartsOn: props.weekStartsOn,
                    locale: props.locale,
                    disabled: props.disabled,
                    'onUpdate:modelValue': handleSelect,
                    style: { border: 'none' },
                  }),
                  h(IrisCalendar, {
                    modelValue: previewSelected.value,
                    defaultMonth: addMonths(leftMonth.value, 1),
                    min: props.min,
                    max: props.max,
                    weekStartsOn: props.weekStartsOn,
                    locale: props.locale,
                    disabled: props.disabled,
                    'onUpdate:modelValue': handleSelect,
                    style: { border: 'none' },
                  }),
                ],
              ),
            ),
          ],
        },
      )
  },
})
