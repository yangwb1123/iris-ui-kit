import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  useId,
  watchEffect,
  type PropType,
} from 'vue'
import { createVirtualizer, type Virtualizer, type VirtualizerState } from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'

export type IrisComboboxSize = 'sm' | 'md' | 'lg'

export interface IrisComboboxOption {
  label: string
  value: string
  disabled?: boolean
}

const SIZE_MAP: Record<IrisComboboxSize, { padding: string; fontSize: string; minHeight: string }> =
  {
    sm: {
      padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
      fontSize: 'var(--iris-font-size-xs, 12px)',
      minHeight: '28px',
    },
    md: {
      padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
      fontSize: 'var(--iris-font-size-md, 14px)',
      minHeight: '34px',
    },
    lg: {
      padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
      fontSize: 'var(--iris-font-size-lg, 16px)',
      minHeight: '40px',
    },
  }

/** Listbox maxHeight — the virtualizer's viewport (px). */
const LISTBOX_MAX_HEIGHT = 240
/** Fixed per-option row height (px) — mirrors SIZE_MAP minHeight (estimate, never measured). */
const ROW_HEIGHT: Record<IrisComboboxSize, number> = { sm: 28, md: 34, lg: 40 }

/**
 * Filterable single-select (searchable select): a text input that type-ahead
 * filters a listbox of options. The displayed text is derived
 * (`filtering ? query : selected label`) so `v-model` changes stay in sync.
 * Opens downward; follows the ARIA 1.2 combobox pattern.
 */
export const IrisCombobox = defineComponent({
  name: 'IrisCombobox',
  inheritAttrs: false,
  props: {
    /** Selected option value ('' = none). */
    modelValue: { type: String, default: '' },
    options: { type: Array as PropType<IrisComboboxOption[]>, default: () => [] },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    size: { type: String as PropType<IrisComboboxSize>, default: 'md' },
    /**
     * Opt-in windowed rendering of the listbox via the core virtualizer.
     * When true, only the visible window (+ buffer) of options is rendered;
     * keyboard navigation scrolls the active option into view. Default false.
     */
    virtual: { type: Boolean, default: false },
    /** Text shown when no option matches the query. Defaults to the i18n value. */
    emptyText: { type: String, default: undefined },
    /** Allow committing free text that matches no option: Enter/blur emits
     * `commit` with the trimmed query (antd AutoComplete parity). Default
     * false keeps the option-only contract. */
    allowCommit: { type: Boolean, default: false },
    /** id forwarded to the input. Set by IrisFormField. */
    id: { type: String, default: undefined },
    /** Forwarded as `aria-describedby` on the input. Set by IrisFormField. */
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
    /** Free-text commit when `allowCommit` is on and no option is selected. */
    commit: (_text: string) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const reactId = useId()
    const listboxId = `${reactId}-listbox`
    const optionId = (i: number) => `${reactId}-opt-${i}`

    const query = ref('')
    const filtering = ref(false)
    const open = ref(false)
    const activeIndex = ref(-1)
    const focused = ref(false)

    const selected = computed(() => props.options.find((o) => o.value === props.modelValue))
    const display = computed(() => (filtering.value ? query.value : (selected.value?.label ?? '')))
    const filtered = computed(() => {
      const needle = query.value.trim().toLowerCase()
      return filtering.value && needle
        ? props.options.filter((o) => o.label.toLowerCase().startsWith(needle))
        : props.options
    })

    // Virtualized listbox (opt-in): one controller per mount, reactive inputs
    // read live through closures so the instance (scroll offset + keyed cache)
    // survives re-renders — the IrisVirtualScroll instance-preservation pattern.
    const listboxRef = ref<HTMLUListElement | null>(null)
    const vstate = ref<VirtualizerState>({
      items: [],
      offsetBefore: 0,
      totalSize: 0,
      startIndex: 0,
      endIndex: -1,
    })
    let v: Virtualizer | null = null
    let unsub: (() => void) | null = null
    // flush 'pre': count lands before every render → the first windowed frame
    // is never stale. setScroll is driven by the DOM scroll handler (below).
    watchEffect(() => {
      if (!props.virtual) return
      if (!v) {
        v = createVirtualizer({
          count: 0,
          estimateSize: () => ROW_HEIGHT[props.size],
          getItemKey: (i) => filtered.value[i]?.value ?? i,
          viewportSize: LISTBOX_MAX_HEIGHT,
          buffer: 4,
        })
        vstate.value = v.getState()
        unsub = v.subscribe((s) => {
          vstate.value = s
        })
      }
      v.setCount(filtered.value.length)
      const el = listboxRef.value
      if (el) {
        const max = Math.max(0, v.totalSize() - LISTBOX_MAX_HEIGHT)
        if (el.scrollTop > max) el.scrollTop = max
      }
    })
    onBeforeUnmount(() => unsub?.())

    // Scroll the active option into view ('auto' semantics: no-op when already
    // fully inside the viewport). Estimates are constant and never measured, so
    // `start = index × rowHeight` is exact.
    const ensureVisible = (index: number) => {
      if (!props.virtual || !v || index < 0 || index >= filtered.value.length) return
      const el = listboxRef.value
      if (!el) return
      const top = el.scrollTop
      const start = index * ROW_HEIGHT[props.size]
      if (start >= top && start + ROW_HEIGHT[props.size] <= top + LISTBOX_MAX_HEIGHT) return
      el.scrollTop = v.scrollToIndex(index, start < top ? 'start' : 'end')
    }

    const close = () => {
      open.value = false
      filtering.value = false
      activeIndex.value = -1
      v?.setScroll(0)
    }

    const selectOption = (opt: IrisComboboxOption) => {
      if (opt.disabled) return
      emit('update:modelValue', opt.value)
      query.value = ''
      close()
    }

    const commitQuery = () => {
      const text = query.value.trim()
      if (!text) return
      emit('commit', text)
      query.value = ''
      close()
    }

    const onInput = (event: Event) => {
      query.value = (event.target as HTMLInputElement).value
      filtering.value = true
      open.value = true
      activeIndex.value = 0
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (props.disabled) return
      const list = filtered.value
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (!open.value) {
          open.value = true
          filtering.value = false
          activeIndex.value = 0
          return
        }
        const next = Math.min(list.length - 1, activeIndex.value + 1)
        activeIndex.value = next
        ensureVisible(next)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (open.value) {
          const next = Math.max(0, activeIndex.value - 1)
          activeIndex.value = next
          ensureVisible(next)
        }
      } else if (event.key === 'Enter') {
        if (open.value && activeIndex.value >= 0 && list[activeIndex.value]) {
          event.preventDefault()
          selectOption(list[activeIndex.value])
        } else if (props.allowCommit) {
          event.preventDefault()
          commitQuery()
        }
      } else if (event.key === 'Escape') {
        if (open.value) {
          event.preventDefault()
          close()
        }
      } else if (event.key === 'Home') {
        if (open.value) {
          event.preventDefault()
          activeIndex.value = 0
          ensureVisible(0)
        }
      } else if (event.key === 'End') {
        if (open.value) {
          event.preventDefault()
          const next = list.length - 1
          activeIndex.value = next
          ensureVisible(next)
        }
      }
    }

    return () => {
      const sz = SIZE_MAP[props.size]
      const list = filtered.value
      const borderColor = props.invalid
        ? 'var(--iris-danger)'
        : focused.value
          ? 'var(--iris-primary)'
          : 'var(--iris-border)'
      const activeId =
        open.value && activeIndex.value >= 0 && list[activeIndex.value]
          ? optionId(activeIndex.value)
          : undefined
      const resolvedEmpty = props.emptyText ?? t('combobox.empty')

      return h(
        'div',
        {
          ...attrs,
          'data-iris-combobox': '',
          'data-iris-combobox-size': props.size,
          'data-state': open.value ? 'open' : 'closed',
          style: {
            position: 'relative',
            display: 'inline-block',
            minWidth: '200px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h('input', {
            id: props.id,
            type: 'text',
            role: 'combobox',
            autocomplete: 'off',
            spellcheck: false,
            value: display.value,
            placeholder: props.placeholder,
            disabled: props.disabled || undefined,
            'aria-expanded': open.value ? 'true' : 'false',
            'aria-controls': listboxId,
            'aria-autocomplete': 'list',
            'aria-activedescendant': activeId,
            'aria-invalid': props.invalid ? 'true' : undefined,
            'aria-describedby': props.ariaDescribedby,
            'data-iris-combobox-input': '',
            onInput,
            onKeydown: onKeyDown,
            onMousedown: (_e: MouseEvent) => {
              if (props.disabled) return
              focused.value = true
              open.value = true
              filtering.value = false
            },
            onFocus: () => {
              if (props.disabled) return
              focused.value = true
              open.value = true
              filtering.value = false
            },
            onBlur: () => {
              focused.value = false
              if (props.allowCommit && query.value.trim()) {
                // 自由文本失焦提交（仅 allowCommit 时）
                commitQuery()
                return
              }
              close()
            },
            style: {
              boxSizing: 'border-box',
              width: '100%',
              padding: sz.padding,
              minHeight: sz.minHeight,
              fontSize: sz.fontSize,
              fontFamily: 'inherit',
              color: 'var(--iris-foreground)',
              background: 'var(--iris-background)',
              border: `1px solid ${borderColor}`,
              borderRadius: 'var(--iris-radius-md, 6px)',
              outline: 'none',
              opacity: props.disabled ? '0.6' : '1',
              boxShadow: focused.value
                ? `0 0 0 3px ${props.invalid ? 'color-mix(in srgb, var(--iris-danger) 18%, transparent)' : 'color-mix(in srgb, var(--iris-primary) 18%, transparent)'}`
                : 'none',
              transition: 'border-color 120ms ease, box-shadow 120ms ease',
            },
          }),
          open.value
            ? h(
                'ul',
                {
                  id: listboxId,
                  role: 'listbox',
                  'data-iris-combobox-listbox': '',
                  ref: (el: unknown) => {
                    listboxRef.value = (el ?? null) as HTMLUListElement | null
                  },
                  onScroll: (e: Event) => {
                    v?.setScroll((e.currentTarget as HTMLElement).scrollTop)
                  },
                  style: {
                    position: 'absolute',
                    insetInlineStart: '0',
                    insetInlineEnd: '0',
                    top: '100%',
                    marginBlockStart: '4px',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    listStyle: 'none',
                    margin: '0',
                    padding: '4px',
                    zIndex: '50',
                    background: 'var(--iris-background)',
                    border: '1px solid var(--iris-border)',
                    borderRadius: 'var(--iris-radius-md, 6px)',
                    boxShadow: 'var(--iris-shadow-lg)',
                  },
                },
                list.length === 0
                  ? [
                      h(
                        'li',
                        {
                          'data-iris-combobox-empty': '',
                          'aria-disabled': 'true',
                          style: {
                            padding: 'var(--iris-padding-sm, 6px) var(--iris-space-sm, 12px)',
                            color: 'var(--iris-muted)',
                            fontSize: sz.fontSize,
                          },
                        },
                        resolvedEmpty,
                      ),
                    ]
                  : props.virtual && v && vstate.value.items.length > 0
                    ? [
                        h('li', {
                          role: 'presentation',
                          'aria-hidden': 'true',
                          'data-iris-combobox-spacer': '',
                          'data-iris-combobox-spacer-type': 'top',
                          style: { height: `${vstate.value.offsetBefore}px` },
                        }),
                        ...vstate.value.items.map((item) => {
                          const opt = list[item.index]
                          if (!opt) return null
                          const isActive = item.index === activeIndex.value
                          const isSelected = opt.value === props.modelValue
                          return h(
                            'li',
                            {
                              key: opt.value,
                              id: optionId(item.index),
                              role: 'option',
                              'aria-selected': isSelected ? 'true' : 'false',
                              'aria-disabled': opt.disabled ? 'true' : undefined,
                              'aria-setsize': list.length,
                              'aria-posinset': item.index + 1,
                              'data-iris-combobox-option': '',
                              'data-active': isActive ? 'true' : undefined,
                              onMousedown: (e: MouseEvent) => e.preventDefault(),
                              onMouseenter: () => {
                                activeIndex.value = item.index
                              },
                              onClick: () => selectOption(opt),
                              style: {
                                padding: 'var(--iris-padding-sm, 6px) var(--iris-space-sm, 12px)',
                                fontSize: sz.fontSize,
                                borderRadius: 'var(--iris-radius-sm, 4px)',
                                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                                color: opt.disabled
                                  ? 'var(--iris-muted)'
                                  : 'var(--iris-foreground)',
                                background: isActive
                                  ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                                  : 'transparent',
                                fontWeight: isSelected ? '600' : '400',
                              },
                            },
                            opt.label,
                          )
                        }),
                        h('li', {
                          role: 'presentation',
                          'aria-hidden': 'true',
                          'data-iris-combobox-spacer': '',
                          'data-iris-combobox-spacer-type': 'bottom',
                          style: {
                            height: `${vstate.value.totalSize - vstate.value.offsetBefore - vstate.value.items.length * ROW_HEIGHT[props.size]}px`,
                          },
                        }),
                      ]
                    : list.map((opt, i) => {
                        const isActive = i === activeIndex.value
                        const isSelected = opt.value === props.modelValue
                        return h(
                          'li',
                          {
                            key: opt.value,
                            id: optionId(i),
                            role: 'option',
                            'aria-selected': isSelected ? 'true' : 'false',
                            'aria-disabled': opt.disabled ? 'true' : undefined,
                            'data-iris-combobox-option': '',
                            'data-active': isActive ? 'true' : undefined,
                            onMousedown: (e: MouseEvent) => e.preventDefault(),
                            onMouseenter: () => {
                              activeIndex.value = i
                            },
                            onClick: () => selectOption(opt),
                            style: {
                              padding: 'var(--iris-padding-sm, 6px) var(--iris-space-sm, 12px)',
                              fontSize: sz.fontSize,
                              borderRadius: 'var(--iris-radius-sm, 4px)',
                              cursor: opt.disabled ? 'not-allowed' : 'pointer',
                              color: opt.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                              background: isActive
                                ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                                : 'transparent',
                              fontWeight: isSelected ? '600' : '400',
                            },
                          },
                          opt.label,
                        )
                      }),
              )
            : null,
        ],
      )
    }
  },
})
