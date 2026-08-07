import { defineComponent, h, ref, watch, type PropType } from 'vue'
import { createKeyboardNav } from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { useDataState } from '../../motion'

export interface IrisListItem<T = unknown> {
  value: T
  label?: string
  disabled?: boolean
}

const LIST_STATE_STYLE: Record<string, string> = {
  listStyle: 'none',
  padding: '12px',
  textAlign: 'center',
  color: 'var(--iris-muted)',
  fontSize: '14px',
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
 *
 * Async lifecycle: pass `loading` / `error` (and empty `items`) to render the
 * animated loading / error / empty state in place of options. Customize each
 * via the `#loading` / `#error` / `#empty` slots; state precedence and entry
 * animation come from {@link useDataState}.
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
    /** Show the loading state instead of items. */
    loading: { type: Boolean, default: false },
    /** Show the error state instead of items (takes precedence over loading). */
    error: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: unknown) => true,
    select: (_item: IrisListItem<unknown>) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const { t } = useI18n()
    const { state, isContent, stateKey, stateProps } = useDataState(() => ({
      loading: props.loading,
      error: props.error,
      empty: props.items.length === 0,
    }))

    const isEnabled = (i: number) => !props.items[i]?.disabled

    // Keyboard navigation (single-sourced in core controller)
    const nav = createKeyboardNav({
      count: props.items.length,
      loop: props.loop,
      isEnabled,
    })
    const activeIndex = ref<number>(nav.index)
    const hoveredIndex = ref(-1)
    watch(
      () => props.items,
      () => {
        nav.reset(props.items.length)
        activeIndex.value = nav.index
      },
      { immediate: true, flush: 'post' },
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

    const focusActive = () => {
      const root = listRef.value
      if (!root || activeIndex.value < 0) return
      const el = root.querySelector<HTMLElement>(`[data-iris-list-index="${activeIndex.value}"]`)
      el?.focus()
    }

    const listRef = ref<HTMLElement | null>(null)

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isContent.value) return
      const action = nav.handleKeyDown({
        key: event.key,
        preventDefault: () => event.preventDefault(),
      })
      if (action.type === 'focus') {
        activeIndex.value = action.target
        focusActive()
      } else if (action.type === 'select') {
        const item = props.items[action.target]
        if (item) select(item)
      } else if (action.type === 'escape') {
        // allow popover/portal to handle
      }
    }

    const renderStateNode = () => {
      const content =
        state.value === 'error'
          ? slots.error
            ? slots.error()
            : t('list.error')
          : state.value === 'loading'
            ? slots.loading
              ? slots.loading()
              : t('list.loading')
            : slots.empty
              ? slots.empty()
              : t('list.empty')
      return h(
        'li',
        {
          key: stateKey.value,
          role: 'presentation',
          'data-iris-list-state': state.value,
          'aria-live': 'polite',
          ...stateProps.value,
          style: LIST_STATE_STYLE,
        },
        content,
      )
    }

    const renderItems = () =>
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
            : hoveredIndex.value === index
              ? 'var(--iris-surface-hover)'
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
            onMouseEnter: () => {
              hoveredIndex.value = index
            },
            onMouseLeave: () => {
              if (hoveredIndex.value === index) hoveredIndex.value = -1
            },
            style: baseStyle,
          },
          slotContent ?? item.label ?? String(item.value),
        )
      })

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
          'aria-busy': state.value === 'loading' ? 'true' : undefined,
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
        isContent.value ? renderItems() : [renderStateNode()],
      )
  },
})
