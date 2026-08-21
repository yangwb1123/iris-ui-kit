import { h, type Ref, type VNode } from 'vue'
import type { IrisListItem } from '../list/List'
import type { Virtualizer, VirtualizerState } from '@iris-ui-kit/core'

export interface VirtualSelectListboxContext {
  items: IrisListItem<unknown>[]
  translate: (key: string) => string
  listboxRef: Ref<HTMLElement | null>
  onListKeyDown: (event: KeyboardEvent) => void
  virtualizer: Virtualizer | null
  state: Ref<VirtualizerState>
  activeIndex: Ref<number>
  multiple: boolean
  selectedValues: Ref<unknown[]>
  currentValue: Ref<unknown>
  onSelect: (item: IrisListItem<unknown>) => void
  rowHeight: number
}

/** Render the windowed listbox while keeping the Vue component focused on state/bridge wiring. */
export function renderVirtualSelectListbox({
  items,
  translate,
  listboxRef,
  onListKeyDown,
  virtualizer,
  state,
  activeIndex,
  multiple,
  selectedValues,
  currentValue,
  onSelect,
  rowHeight,
}: VirtualSelectListboxContext): VNode {
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
      'aria-label': translate('select.options'),
      'data-iris-list': '',
      ref: (el: unknown) => {
        listboxRef.value = (el ?? null) as HTMLElement | null
      },
      onKeydown: onListKeyDown,
      onScroll: (event: Event) => {
        virtualizer?.setScroll((event.currentTarget as HTMLElement).scrollTop)
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
    items.length === 0
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
            translate('list.empty'),
          ),
        ]
      : [
          h('li', {
            role: 'presentation',
            'aria-hidden': 'true',
            'data-iris-select-spacer': '',
            'data-iris-select-spacer-type': 'top',
            style: { height: `${state.value.offsetBefore}px` },
          }),
          ...state.value.items.map((item) => {
            const option = items[item.index]
            if (!option) return null
            const active = item.index === activeIndex.value
            const selected = multiple
              ? selectedValues.value.includes(option.value)
              : option.value === currentValue.value
            return h(
              'li',
              {
                key: String(option.value ?? item.index),
                role: 'option',
                tabindex: active ? 0 : -1,
                'aria-selected': selected ? 'true' : 'false',
                'aria-disabled': option.disabled ? 'true' : undefined,
                'aria-setsize': items.length,
                'aria-posinset': item.index + 1,
                'data-iris-list-index': item.index,
                'data-iris-list-item': '',
                'data-state': selected ? 'selected' : active ? 'active' : 'idle',
                onClick: option.disabled
                  ? undefined
                  : () => {
                      activeIndex.value = item.index
                      onSelect(option)
                    },
                onFocus: () => {
                  activeIndex.value = item.index
                },
                onMouseenter: () => {
                  activeIndex.value = item.index
                },
                style: optionStyle(selected, active, !!option.disabled),
              },
              [
                h(
                  'span',
                  { style: { flex: '1', minWidth: '0' } },
                  option.label ?? String(option.value),
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
              height: `${state.value.totalSize - state.value.offsetBefore - state.value.items.length * rowHeight}px`,
            },
          }),
        ],
  )
}
