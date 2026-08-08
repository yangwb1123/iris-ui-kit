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

    const selectedItem = computed(
      () => props.items.find((item) => item.value === currentValue.value) ?? null,
    )

    const triggerLabel = computed(() => {
      const item = selectedItem.value
      if (!item) return props.placeholder ?? t('select.placeholder')
      return item.label ?? String(item.value)
    })

    const onSelect = (item: IrisListItem<unknown>) => {
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

    // Windowed listbox — mirrors the IrisList DOM contract (role=option,
    // data-iris-list-index / data-iris-list-item / data-state + selected check)
    // plus virtual-list spacers and aria-setsize/aria-posinset. The inter-row
    // gap is dropped so the spacer-sum invariant is exact (ROW_HEIGHT already
    // includes the 4px spacing).
    const renderVirtualListbox = () => {
      const list = props.items
      const optionStyle = (
        selected: boolean,
        active: boolean,
        disabled: boolean,
      ): Record<string, string> => ({
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--iris-gap-sm)',
        padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md)',
        borderRadius: 'var(--iris-radius-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? '0.5' : '1',
        fontSize: 'var(--iris-font-size-md, 14px)',
        background: selected
          ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
          : active
            ? 'var(--iris-surface-hover)'
            : 'transparent',
        color: 'var(--iris-foreground)',
        fontWeight: selected ? '600' : '400',
        outline: 'none',
      })
      const check = () =>
        h(
          'svg',
          {
            'aria-hidden': 'true',
            width: '14',
            height: '14',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'var(--iris-primary)',
            'stroke-width': '2.5',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          },
          [h('path', { d: 'M20 6 9 17l-5-5' })],
        )

      return h(
        'ul',
        {
          role: 'listbox',
          'aria-label': t('select.options'),
          'data-iris-list': '',
          ref: (el: unknown) => {
            listboxRef.value = (el ?? null) as HTMLElement | null
          },
          onKeydown: onListKeyDown,
          onScroll: (e: Event) => {
            v?.setScroll((e.currentTarget as HTMLElement).scrollTop)
          },
          style: {
            listStyle: 'none',
            margin: '0',
            padding: 'var(--iris-padding-sm)',
            display: 'flex',
            flexDirection: 'column',
            outline: 'none',
            maxHeight: '240px',
            overflowY: 'auto',
          },
        },
        list.length === 0
          ? [
              h(
                'li',
                {
                  role: 'presentation',
                  'data-iris-list-state': 'empty',
                  'aria-live': 'polite',
                  style: {
                    listStyle: 'none',
                    padding: '12px',
                    textAlign: 'center',
                    color: 'var(--iris-muted)',
                    fontSize: 'var(--iris-font-size-md, 14px)',
                  },
                },
                t('list.empty'),
              ),
            ]
          : [
              h('li', {
                role: 'presentation',
                'aria-hidden': 'true',
                'data-iris-select-spacer': '',
                'data-iris-select-spacer-type': 'top',
                style: { height: `${vstate.value.offsetBefore}px` },
              }),
              ...vstate.value.items.map((item) => {
                const opt = list[item.index]
                if (!opt) return null
                const active = item.index === activeIndex.value
                const selected = opt.value === currentValue.value
                return h(
                  'li',
                  {
                    key: String(opt.value ?? item.index),
                    role: 'option',
                    tabindex: active ? 0 : -1,
                    'aria-selected': selected ? 'true' : 'false',
                    'aria-disabled': opt.disabled ? 'true' : undefined,
                    'aria-setsize': list.length,
                    'aria-posinset': item.index + 1,
                    'data-iris-list-index': item.index,
                    'data-iris-list-item': '',
                    'data-state': selected ? 'selected' : active ? 'active' : 'idle',
                    onClick: opt.disabled
                      ? undefined
                      : () => {
                          activeIndex.value = item.index
                          onSelect(opt)
                        },
                    onFocus: () => {
                      activeIndex.value = item.index
                    },
                    onMouseenter: () => {
                      activeIndex.value = item.index
                    },
                    style: optionStyle(selected, active, !!opt.disabled),
                  },
                  [
                    h(
                      'span',
                      { style: { flex: '1', minWidth: '0' } },
                      opt.label ?? String(opt.value),
                    ),
                    selected ? check() : null,
                  ],
                )
              }),
              h('li', {
                role: 'presentation',
                'aria-hidden': 'true',
                'data-iris-select-spacer': '',
                'data-iris-select-spacer-type': 'bottom',
                style: {
                  height: `${
                    vstate.value.totalSize -
                    vstate.value.offsetBefore -
                    vstate.value.items.length * ROW_HEIGHT
                  }px`,
                },
              }),
            ],
      )
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
                  ? renderVirtualListbox()
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
