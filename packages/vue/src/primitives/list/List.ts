import { computed, defineComponent, h, ref, watch, type PropType } from 'vue'

export interface IrisListItem<T = unknown> {
  value: T
  label?: string
  disabled?: boolean
}

/**
 * Generic selectable list. Foundation for `IrisSelect`, dropdowns, command
 * palettes, etc. Implements the WAI-ARIA Listbox pattern:
 *
 *   - `role="listbox"` (or `listbox` with `aria-multiselectable="true"`)
 *   - Roving tabindex (one item has `tabindex=0`, others `-1`)
 *   - Arrow keys / Home / End to move focus
 *   - Enter / Space to (de)select
 *
 * The list is data-driven — pass an array of `{ value, label?, disabled? }`.
 * Render custom items via the `#item` slot.
 */
export const IrisList = defineComponent({
  name: 'IrisList',
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<IrisListItem<unknown>[]>, required: true },
    /** Selected value(s). For multi mode, pass an array. */
    modelValue: { type: null as unknown as PropType<unknown> },
    /** Allow multi-select. */
    multi: { type: Boolean, default: false },
    /** Loop ArrowDown past the last item back to the first (and vice versa). Default `true`. */
    loop: { type: Boolean, default: true },
    /** ARIA label. */
    ariaLabel: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: unknown) => true,
    select: (_item: IrisListItem<unknown>) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const enabledIndexes = computed(() =>
      props.items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i !== -1),
    )

    const activeIndex = ref<number>(enabledIndexes.value[0] ?? -1)

    // Keep the active index in sync when items change.
    watch(
      () => props.items,
      () => {
        if (activeIndex.value < 0 || activeIndex.value >= props.items.length) {
          activeIndex.value = enabledIndexes.value[0] ?? -1
        } else if (props.items[activeIndex.value]?.disabled) {
          activeIndex.value = enabledIndexes.value[0] ?? -1
        }
      },
      { flush: 'post' },
    )

    const isSelected = (value: unknown): boolean => {
      if (props.multi) {
        return Array.isArray(props.modelValue) && (props.modelValue as unknown[]).includes(value)
      }
      return props.modelValue === value
    }

    const select = (item: IrisListItem<unknown>) => {
      if (item.disabled) return
      if (props.multi) {
        const arr: unknown[] = Array.isArray(props.modelValue)
          ? [...(props.modelValue as unknown[])]
          : []
        const idx = arr.indexOf(item.value)
        if (idx >= 0) arr.splice(idx, 1)
        else arr.push(item.value)
        emit('update:modelValue', arr)
      } else {
        emit('update:modelValue', item.value)
      }
      emit('select', item)
    }

    const moveActive = (delta: 1 | -1) => {
      const enabled = enabledIndexes.value
      if (enabled.length === 0) return
      let pos = enabled.indexOf(activeIndex.value)
      if (pos === -1) pos = delta > 0 ? -1 : enabled.length
      let next = pos + delta
      if (next < 0) next = props.loop ? enabled.length - 1 : 0
      else if (next >= enabled.length) next = props.loop ? 0 : enabled.length - 1
      activeIndex.value = enabled[next]!
    }

    const focusActive = () => {
      const root = listRef.value
      if (!root || activeIndex.value < 0) return
      const el = root.querySelector<HTMLElement>(`[data-iris-list-index="${activeIndex.value}"]`)
      el?.focus()
    }

    const listRef = ref<HTMLElement | null>(null)

    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          moveActive(1)
          focusActive()
          break
        case 'ArrowUp':
          event.preventDefault()
          moveActive(-1)
          focusActive()
          break
        case 'Home': {
          event.preventDefault()
          const first = enabledIndexes.value[0] ?? -1
          if (first >= 0) {
            activeIndex.value = first
            focusActive()
          }
          break
        }
        case 'End': {
          event.preventDefault()
          const last = enabledIndexes.value[enabledIndexes.value.length - 1] ?? -1
          if (last >= 0) {
            activeIndex.value = last
            focusActive()
          }
          break
        }
        case 'Enter':
        case ' ': {
          if (activeIndex.value >= 0) {
            event.preventDefault()
            const item = props.items[activeIndex.value]
            if (item) select(item)
          }
          break
        }
      }
    }

    return () =>
      h(
        'ul',
        {
          ...attrs,
          ref: (el: unknown) => {
            listRef.value = (el ?? null) as HTMLElement | null
          },
          role: 'listbox',
          'aria-label': props.ariaLabel,
          'aria-multiselectable': props.multi ? 'true' : undefined,
          'data-iris-list': '',
          onKeydown: onKeyDown,
          style: {
            listStyle: 'none',
            margin: '0',
            padding: 'var(--iris-padding-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            outline: 'none',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        props.items.map((item, index) => {
          const selected = isSelected(item.value)
          const active = index === activeIndex.value
          const onClick = () => {
            activeIndex.value = index
            select(item)
          }
          const onFocus = () => {
            activeIndex.value = index
          }
          const baseStyle: Record<string, string> = {
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iris-gap-sm)',
            padding: '6px var(--iris-padding-md)',
            borderRadius: 'var(--iris-radius-sm)',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            opacity: item.disabled ? '0.5' : '1',
            fontSize: '14px',
            background: selected
              ? 'var(--iris-primary)'
              : active
                ? 'var(--iris-surface-hover)'
                : 'transparent',
            color: selected ? 'var(--iris-primary-foreground)' : 'var(--iris-foreground)',
            outline: 'none',
          }

          const slotContent = slots.item?.({
            item,
            index,
            selected,
            active,
          })

          return h(
            'li',
            {
              key: String(item.value ?? index),
              role: 'option',
              tabindex: active ? 0 : -1,
              'aria-selected': selected ? 'true' : 'false',
              'aria-disabled': item.disabled ? 'true' : undefined,
              'data-iris-list-index': index,
              'data-iris-list-item': '',
              'data-state': selected ? 'selected' : active ? 'active' : 'idle',
              onClick: item.disabled ? undefined : onClick,
              onFocus,
              style: baseStyle,
            },
            slotContent ?? item.label ?? String(item.value),
          )
        }),
      )
  },
})
