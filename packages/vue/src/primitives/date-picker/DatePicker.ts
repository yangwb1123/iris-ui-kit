import { computed, defineComponent, h, ref, type PropType } from 'vue'
import type { Placement } from '@iris-ui/core'
import { IrisPopover } from '../popover/Popover'
import { IrisPopoverTrigger } from '../popover/PopoverTrigger'
import { IrisPopoverContent } from '../popover/PopoverContent'
import { IrisCalendar } from '../calendar/Calendar'
import { safeLocale } from '../calendar/dateUtils'
import { useI18n } from '../../i18n'

function formatISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDisplay(date: Date | null, locale?: string): string {
  if (!date) return ''
  return new Intl.DateTimeFormat(safeLocale(locale), { dateStyle: 'medium' }).format(date)
}

/**
 * Date picker: Input-styled trigger + Popover + Calendar. Two-way binds
 * via `v-model`. On selection, the popover auto-closes.
 *
 * Use `IrisCalendar` directly when you want the calendar inline (no popover).
 */
export const IrisDatePicker = defineComponent({
  name: 'IrisDatePicker',
  inheritAttrs: false,
  props: {
    modelValue: { type: Date as unknown as PropType<Date | null>, default: null },
    min: { type: Date as unknown as PropType<Date | undefined>, default: undefined },
    max: { type: Date as unknown as PropType<Date | undefined>, default: undefined },
    weekStartsOn: { type: Number, default: 0 },
    locale: { type: String, default: undefined },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    placement: { type: String as PropType<Placement>, default: 'bottom-start' },
    /** id forwarded to the trigger. Set by IrisFormField. */
    id: { type: String, default: undefined },
    /** Forwarded as aria-describedby on the trigger. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: Date | null) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const open = ref(false)
    const display = computed(() => formatDisplay(props.modelValue, props.locale))

    const onSelect = (date: Date | null) => {
      emit('update:modelValue', date)
      if (date) open.value = false
    }

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
                  'data-iris-date-picker-trigger': '',
                  'data-iris-date-picker-iso': props.modelValue
                    ? formatISODate(props.modelValue)
                    : undefined,
                  'data-state': open.value ? 'open' : 'closed',
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: 'var(--iris-background)',
                    color: props.modelValue ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                    border: `1px solid ${props.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
                    borderRadius: 'var(--iris-radius-md, 6px)',
                    cursor: props.disabled ? 'not-allowed' : 'pointer',
                    opacity: props.disabled ? '0.6' : '1',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    minHeight: '34px',
                    minWidth: '180px',
                    textAlign: 'start',
                    ...((attrs.style as Record<string, string> | undefined) ?? {}),
                  },
                },
                display.value || (props.placeholder ?? t('datePicker.placeholder')),
              ),
            ]),
            h(IrisPopoverContent, { style: { padding: '0' } }, () =>
              h(IrisCalendar, {
                modelValue: props.modelValue,
                min: props.min,
                max: props.max,
                weekStartsOn: props.weekStartsOn,
                locale: props.locale,
                disabled: props.disabled,
                'onUpdate:modelValue': onSelect,
                style: { border: 'none', background: 'transparent' },
              }),
            ),
          ],
        },
      )
  },
})
