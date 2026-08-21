import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  watchEffect,
  type PropType,
} from 'vue'
import {
  createKeyboardNav,
  createVirtualizer,
  type KeyboardNavAction,
  type Placement,
  type Size,
  type Virtualizer,
  type VirtualizerState,
} from '@iris-ui-kit/core'
import { IrisPopover } from '../popover/Popover'
import { IrisPopoverTrigger } from '../popover/PopoverTrigger'
import { IrisPopoverContent } from '../popover/PopoverContent'
import { IrisList, type IrisListItem } from '../list/List'
import { useI18n } from '../../i18n'
import { renderVirtualSelectListbox } from './renderVirtualListbox'

export type IrisSelectSize = Size

export interface IrisSelectProps<T = unknown> {
  items: IrisListItem<T>[]
  modelValue?: T
  defaultValue?: T
  placeholder?: string
  size?: IrisSelectSize
  disabled?: boolean
  placement?: Placement
  invalid?: boolean
  id?: string
  ariaDescribedby?: string
  teleport?: false | HTMLElement | string
  /**
   * Opt-in windowed rendering of the listbox via the core virtualizer.
   * When true, only the visible window (+ buffer) of options is rendered;
   * keyboard navigation scrolls the active option into view. Default false.
   */
  virtual?: boolean
}

/**
 * Single-select dropdown. Composes Popover (positioning + dismiss) with List
 * (keyboard nav + selection). Two-way binds via `v-model`; when `modelValue`
 * is omitted it owns its value, seeded by `defaultValue`.
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
    multiple: { type: Boolean, default: false },
    defaultValue: { type: null as unknown as PropType<unknown>, default: undefined },
    placeholder: { type: String, default: undefined },
    size: { type: String as PropType<IrisSelectSize>, default: 'md' },
    disabled: { type: Boolean, default: false },
    placement: { type: String as PropType<Placement>, default: 'bottom-start' },
    /** Visual invalid state. */
    invalid: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    /** Forwarded as `aria-describedby` on the trigger button. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
    /** Pass `false` to render the popover content inline (no teleport). */
    teleport: {
      type: [Boolean, Object] as PropType<false | HTMLElement | string>,
      default: undefined,
    },
    /**
     * Opt-in windowed rendering of the listbox via the core virtualizer.
     * When true, only the visible window (+ buffer) of options is rendered;
     * keyboard navigation scrolls the active option into view. Default false.
     */
    virtual: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: unknown) => true,
    valueChange: (_value: unknown) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const { t } = useI18n()
    const open = ref(false)
    const internalValue = ref<unknown>(props.defaultValue)
    const controlled = computed(() => props.modelValue !== undefined)
    const currentValue = computed(() => (controlled.value ? props.modelValue : internalValue.value))

    const selectedValues = computed<unknown[]>(() => {
      if (!props.multiple) return []
      const v = currentValue.value
      return Array.isArray(v) ? (v as unknown[]) : v !== undefined ? [v] : []
    })

    const selectedItem = computed(
      () => props.items.find((item) => item.value === currentValue.value) ?? null,
    )

    const triggerLabel = computed(() => {
      if (props.multiple) {
        const items = props.items.filter((it) => selectedValues.value.includes(it.value))
        if (items.length === 0) return props.placeholder ?? t('select.placeholder')
        return items.map((it) => it.label ?? String(it.value)).join(', ')
      }
      const item = selectedItem.value
      if (!item) return props.placeholder ?? t('select.placeholder')
      return item.label ?? String(item.value)
    })

    const onSelect = (item: IrisListItem<unknown>) => {
      if (props.multiple) {
        const exists = selectedValues.value.includes(item.value)
        const next = exists
          ? selectedValues.value.filter((v) => v !== item.value)
          : [...selectedValues.value, item.value]
        if (!controlled.value) internalValue.value = next
        emit('update:modelValue', next)
        emit('valueChange', next)
        return // keep popover open for multi-select
      }
      if (!controlled.value) internalValue.value = item.value
      emit('update:modelValue', item.value)
      emit('valueChange', item.value)
      open.value = false
    }

    // ── Virtualized listbox (opt-in) — combobox precedent ────────────────
    // One controller per mount, reactive inputs read live through closures so
    // the instance (scroll offset + keyed cache) survives re-renders.
    const LISTBOX_MAX_HEIGHT = 240
    // Fixed per-option row height (px) — option padding 6+6 + 14px line ≈ 32px
    // plus the 4px inter-row gap; estimate, never measured (combobox approach).
    const ROW_HEIGHT = 36

    const listboxRef = ref<HTMLElement | null>(null)
    const vstate = ref<VirtualizerState>({
      items: [],
      offsetBefore: 0,
      totalSize: 0,
      startIndex: 0,
      endIndex: -1,
    })
    let v: Virtualizer | null = null
    let vUnsub: (() => void) | null = null
    const nav = ref<ReturnType<typeof createKeyboardNav> | null>(null)
    const activeIndex = ref(-1)

    const isEnabled = (i: number) => !props.items[i]?.disabled

    // flush 'pre': count lands before every render → the first windowed frame
    // is never stale; DOM scrollTop is re-clamped when the list shrinks.
    watchEffect(() => {
      if (!props.virtual) return
      if (!v) {
        v = createVirtualizer({
          count: 0,
          estimateSize: () => ROW_HEIGHT,
          getItemKey: (i) => String(props.items[i]?.value ?? i),
          viewportSize: LISTBOX_MAX_HEIGHT,
          buffer: 4,
        })
        vstate.value = v.getState()
        vUnsub = v.subscribe((s) => {
          vstate.value = s
        })
        nav.value = createKeyboardNav({
          count: props.items.length,
          loop: true,
          isEnabled,
        })
        activeIndex.value = nav.value.index
      }
      v.setCount(props.items.length)
      const el = listboxRef.value
      if (el) {
        const max = Math.max(0, v.totalSize() - LISTBOX_MAX_HEIGHT)
        if (el.scrollTop > max) el.scrollTop = max
      }
    })
    onBeforeUnmount(() => vUnsub?.())

    // Nav bounds follow items (IrisList parity).
    watch(
      () => props.items,
      () => {
        if (!props.virtual || !nav.value) return
        nav.value.reset(props.items.length)
        activeIndex.value = nav.value.index
      },
      { flush: 'post' },
    )

    // Open: anchor to the selected (or first enabled) option and scroll it
    // into view — the deep-value anchor, unified across the four bridges.
    // Close: reset the controller offset (the DOM listbox unmounts per open).
    watch(
      () => open.value,
      (isOpen) => {
        if (!isOpen) {
          v?.setScroll(0)
          return
        }
        if (!props.virtual || !nav.value) return
        const selIdx = props.items.findIndex(
          (it) => it.value === currentValue.value && !it.disabled,
        )
        if (selIdx >= 0) nav.value.focus(selIdx)
        else nav.value.goFirst()
        activeIndex.value = nav.value.index
        ensureVisible(activeIndex.value)
        focusOption(activeIndex.value)
      },
      { flush: 'post' },
    )

    // Scroll the active option into view ('auto' semantics: no-op when already
    // fully inside the viewport). Estimates are constant and never measured.
    const ensureVisible = (index: number) => {
      if (!props.virtual || !v || index < 0 || index >= props.items.length) return
      const el = listboxRef.value
      if (!el) return
      const top = el.scrollTop
      const start = index * ROW_HEIGHT
      if (start >= top && start + ROW_HEIGHT <= top + LISTBOX_MAX_HEIGHT) return
      el.scrollTop = v.scrollToIndex(index, start < top ? 'start' : 'end')
    }

    // Focus only after the scroll-triggered window re-render has placed the
    // option in the DOM (nextTick flushes the vstate-driven re-render).
    const focusOption = (index: number) => {
      if (index < 0) return
      nextTick(() => {
        listboxRef.value?.querySelector<HTMLElement>(`[data-iris-list-index="${index}"]`)?.focus()
      })
    }

    const onListKeyDown = (event: KeyboardEvent) => {
      if (!nav.value) return
      const action: KeyboardNavAction = nav.value.handleKeyDown({
        key: event.key,
        preventDefault: () => event.preventDefault(),
      })
      if (action.type === 'focus' || action.type === 'typeahead') {
        activeIndex.value = action.target
        ensureVisible(action.target)
        focusOption(action.target)
      } else if (action.type === 'select') {
        const item = props.items[action.target]
        if (item) onSelect(item)
      }
      // escape is handled by Popover's dismiss
    }

    const sizeStyles = computed(() => {
      const map: Record<IrisSelectSize, { padding: string; fontSize: string; minHeight: string }> =
        {
          sm: {
            padding:
              'var(--iris-space-xxs, 4px) 24px var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
            fontSize: 'var(--iris-font-size-xs, 12px)',
            minHeight: '28px',
          },
          md: {
            padding:
              'var(--iris-space-xs, 8px) var(--iris-space-xl, 24px) var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
            fontSize: 'var(--iris-font-size-md, 14px)',
            minHeight: '34px',
          },
          lg: {
            padding:
              'var(--iris-space-xs, 8px) var(--iris-space-2xl, 32px) var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
            fontSize: 'var(--iris-font-size-lg, 16px)',
            minHeight: '40px',
          },
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
      textAlign: 'start',
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
            h(IrisPopoverTrigger, { asChild: true }, () => [
              slots.trigger
                ? slots.trigger({
                    value: currentValue.value,
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
                      // A select opens a listbox, not a generic dialog — override
                      // the popover trigger's default aria-haspopup="dialog".
                      'aria-haspopup': 'listbox',
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
            ]),
            h(
              IrisPopoverContent,
              {
                style: { padding: 'var(--iris-padding-sm)', minWidth: '180px' },
                ...(props.teleport !== undefined ? { teleport: props.teleport } : {}),
              },
              () =>
                props.virtual
                  ? renderVirtualSelectListbox({
                      items: props.items,
                      translate: t,
                      listboxRef,
                      onListKeyDown,
                      virtualizer: v,
                      state: vstate,
                      activeIndex,
                      multiple: props.multiple,
                      selectedValues,
                      currentValue,
                      onSelect,
                      rowHeight: ROW_HEIGHT,
                    })
                  : h(IrisList, {
                      items: props.items,
                      modelValue: currentValue.value,
                      onSelect,
                      ariaLabel: t('select.options'),
                    }),
            ),
          ],
        },
      )
  },
})
