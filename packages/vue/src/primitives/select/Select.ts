import { computed, defineComponent, h, ref, type PropType } from 'vue'
import type { Placement, Size } from '@iris-ui/core'
import { IrisPopover } from '../popover/Popover'
import { IrisPopoverTrigger } from '../popover/PopoverTrigger'
import { IrisPopoverContent } from '../popover/PopoverContent'
import { IrisList, type IrisListItem } from '../list/List'

export type IrisSelectSize = Size

/**
 * Single-select dropdown. Composes Popover (positioning + dismiss) with List
 * (keyboard nav + selection). Two-way binds via `v-model`.
 *
 * The trigger is a styled `<button>` showing the current item's `label` (or
 * `value` as fallback) or `placeholder` when empty. Pass `#trigger` to fully
 * customize the visible trigger element.
 */
export const IrisSelect = defineComponent({
  name: 'IrisSelect',
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<IrisListItem<unknown>[]>, required: true },
    modelValue: { type: null as unknown as PropType<unknown> },
    placeholder: { type: String, default: 'Select…' },
    size: { type: String as PropType<IrisSelectSize>, default: 'md' },
    disabled: { type: Boolean, default: false },
    placement: { type: String as PropType<Placement>, default: 'bottom-start' },
    /** Visual invalid state. */
    invalid: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    /** Forwarded as `aria-describedby` on the trigger button. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: unknown) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const open = ref(false)

    const selectedItem = computed(() =>
      props.items.find((item) => item.value === props.modelValue) ?? null,
    )

    const triggerLabel = computed(() => {
      const item = selectedItem.value
      if (!item) return props.placeholder
      return item.label ?? String(item.value)
    })

    const onSelect = (item: IrisListItem<unknown>) => {
      emit('update:modelValue', item.value)
      open.value = false
    }

    const sizeStyles = computed(() => {
      const map: Record<IrisSelectSize, { padding: string; fontSize: string; minHeight: string }> = {
        sm: { padding: '4px 24px 4px 8px', fontSize: '12px', minHeight: '28px' },
        md: { padding: '6px 28px 6px 12px', fontSize: '14px', minHeight: '34px' },
        lg: { padding: '8px 32px 8px 12px', fontSize: '16px', minHeight: '40px' },
      }
      return map[props.size]
    })

    const triggerStyle = computed<Record<string, string>>(() => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--iris-gap-sm)',
      background: 'var(--iris-background)',
      color: selectedItem.value ? 'var(--iris-foreground)' : 'var(--iris-muted)',
      border: `1px solid ${props.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
      borderRadius: 'var(--iris-radius-md)',
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      opacity: props.disabled ? '0.6' : '1',
      textAlign: 'left',
      fontFamily: 'inherit',
      position: 'relative',
      width: 'auto',
      minWidth: '140px',
      ...sizeStyles.value,
    }))

    const chevron = () =>
      h(
        'svg',
        {
          'aria-hidden': 'true',
          viewBox: '0 0 16 16',
          width: '14',
          height: '14',
          style: {
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--iris-muted)',
            pointerEvents: 'none',
          },
        },
        [
          h('path', {
            d: 'M4 6l4 4 4-4',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '1.5',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          }),
        ],
      )

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
            h(
              IrisPopoverTrigger,
              { asChild: true },
              () => [
                slots.trigger
                  ? slots.trigger({
                      value: props.modelValue,
                      label: triggerLabel.value,
                      open: open.value,
                    })
                  : h(
                      'button',
                      {
                        ...attrs,
                        type: 'button',
                        id: props.id,
                        disabled: props.disabled || undefined,
                        'data-iris-select-trigger': '',
                        'data-iris-select-size': props.size,
                        'data-state': open.value ? 'open' : 'closed',
                        'aria-invalid': props.invalid ? 'true' : undefined,
                        'aria-describedby': props.ariaDescribedby,
                        style: {
                          ...triggerStyle.value,
                          ...((attrs.style as Record<string, string> | undefined) ?? {}),
                        },
                      },
                      [
                        h('span', { style: { flex: '1', minWidth: '0' } }, triggerLabel.value),
                        chevron(),
                      ],
                    ),
              ],
            ),
            h(
              IrisPopoverContent,
              {
                style: { padding: 'var(--iris-padding-sm)', minWidth: '180px' },
              },
              () =>
                h(IrisList, {
                  items: props.items,
                  modelValue: props.modelValue,
                  'onUpdate:modelValue': (v: unknown) => emit('update:modelValue', v),
                  onSelect,
                  ariaLabel: 'Options',
                }),
            ),
          ],
        },
      )
  },
})
