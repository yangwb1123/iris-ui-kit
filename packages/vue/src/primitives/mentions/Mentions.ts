import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  watchEffect,
  type PropType,
} from 'vue'
import { createVirtualizer, type Virtualizer, type VirtualizerState } from '@iris-ui-kit/core'

export interface IrisMentionOption {
  label: string
  value: string
}

interface Active {
  start: number
  query: string
}

/** Find an active mention token (prefix at start/after-space, no inner spaces). */
function detect(text: string, caret: number, prefix: string): Active | null {
  let i = caret - 1
  while (i >= 0 && text.charAt(i) !== prefix) {
    if (/\s/.test(text.charAt(i))) return null
    i--
  }
  if (i < 0) return null
  if (i === 0 || /\s/.test(text.charAt(i - 1))) return { start: i, query: text.slice(i + 1, caret) }
  return null
}

const TEXTAREA_STYLE: Record<string, string> = {
  boxSizing: 'border-box',
  width: '100%',
  padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
  fontSize: 'var(--iris-font-size-md, 14px)',
  fontFamily: 'inherit',
  color: 'var(--iris-foreground)',
  background: 'var(--iris-background)',
  borderRadius: 'var(--iris-radius-md, 6px)',
  outline: 'none',
  resize: 'vertical',
}

const LIST_STYLE: Record<string, string> = {
  position: 'absolute',
  insetInlineStart: '0',
  top: '100%',
  marginBlockStart: '4px',
  maxHeight: '200px',
  overflowY: 'auto',
  minWidth: '160px',
  margin: '0',
  padding: '4px',
  zIndex: '50',
  listStyle: 'none',
  background: 'var(--iris-background)',
  border: '1px solid var(--iris-border)',
  borderRadius: 'var(--iris-radius-md, 6px)',
  boxShadow: 'var(--iris-shadow-lg)',
}

/** Listbox maxHeight — the virtualizer's viewport (px). */
const LISTBOX_MAX_HEIGHT = 200
/** Fixed per-option row height (px) — estimate, never measured. */
const ROW_HEIGHT = 32

/**
 * Mentions: a textarea that opens an autocomplete listbox when the user types
 * the trigger character (default `@`). Selecting a suggestion replaces the
 * `@query` token with the chosen label. Keyboard: ↑/↓ to move, Enter to pick,
 * Esc to dismiss.
 */
export const IrisMentions = defineComponent({
  name: 'IrisMentions',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array as PropType<IrisMentionOption[]>, default: () => [] },
    /** Trigger character. */
    prefix: { type: String, default: '@' },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    rows: { type: Number, default: 3 },
    /**
     * Opt-in windowed rendering of the suggestion listbox via the core
     * virtualizer. When true, only the visible window (+ buffer) of options is
     * rendered; keyboard navigation scrolls the active option into view and
     * every keystroke re-anchors the window to the top. Default false.
     */
    virtual: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    ariaDescribedby: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
  },
  setup(props, { attrs, emit }) {
    const reactId = useId()
    const listboxId = `${reactId}-listbox`
    const active = ref<Active | null>(null)
    const activeIndex = ref(0)
    let textareaEl: HTMLTextAreaElement | null = null
    let startPos = 0
    let caretPos = 0

    const filtered = computed(() =>
      active.value
        ? props.options.filter((o) =>
            o.label.toLowerCase().includes(active.value!.query.toLowerCase()),
          )
        : [],
    )
    const open = computed(() => active.value !== null && filtered.value.length > 0)

    // Virtualized listbox (opt-in): one controller per mount (created lazily
    // inside the effect, then retained), reactive inputs read through
    // closures so the instance (scroll offset + keyed cache) survives
    // re-renders — the IrisCombobox precedent.
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
    let lastText: string | undefined
    let lastActiveIndex = 0
    // flush 'pre': count lands before every render → the first windowed frame
    // is never stale. Single sync covering per-keystroke re-anchor to 0 (a
    // keystroke always resets activeIndex), shrink clamp (external options
    // swaps) and active-option visibility (keyboard/mouse). Wheel scrolling
    // drives setScroll directly via the scroll handler, so it moves the window
    // freely — it does not change activeIndex.
    watchEffect(() => {
      if (!props.virtual) return
      if (!v) {
        v = createVirtualizer({
          count: 0,
          estimateSize: () => ROW_HEIGHT,
          getItemKey: (i) => filtered.value[i]?.value ?? i,
          viewportSize: LISTBOX_MAX_HEIGHT,
          buffer: 4,
        })
        vstate.value = v.getState()
        unsub = v.subscribe((s) => {
          vstate.value = s
        })
      }
      const list = filtered.value
      v.setCount(list.length)
      // Read up-front so `activeIndex` is tracked by this watcher in EVERY run
      // — the re-anchor branch below returns early, and Vue re-collects
      // dependencies per run (an untracked activeIndex would freeze keyboard
      // navigation until the next text change).
      const idx = activeIndex.value
      if (props.modelValue !== lastText) {
        lastText = props.modelValue
        lastActiveIndex = 0
        v.setScroll(0)
        const el = listboxRef.value
        if (el) el.scrollTop = 0
        return
      }
      const el = listboxRef.value
      if (el) {
        const max = Math.max(0, v.totalSize() - LISTBOX_MAX_HEIGHT)
        if (el.scrollTop > max) el.scrollTop = max
      }
      if (idx !== lastActiveIndex) {
        lastActiveIndex = idx
        if (idx >= 0 && idx < list.length && el) {
          const top = el.scrollTop
          const start = idx * ROW_HEIGHT
          if (start < top || start + ROW_HEIGHT > top + LISTBOX_MAX_HEIGHT) {
            el.scrollTop = v.scrollToIndex(idx, start < top ? 'start' : 'end')
          }
        }
      }
    })
    onBeforeUnmount(() => unsub?.())

    const onInput = (e: Event) => {
      const ta = e.target as HTMLTextAreaElement
      const val = ta.value
      const caret = ta.selectionStart ?? val.length
      emit('update:modelValue', val)
      const found = detect(val, caret, props.prefix)
      if (found) {
        startPos = found.start
        caretPos = caret
        active.value = found
        activeIndex.value = 0
      } else {
        active.value = null
      }
    }

    const insert = (opt: IrisMentionOption) => {
      const before = props.modelValue.slice(0, startPos)
      const after = props.modelValue.slice(caretPos)
      const inserted = `${props.prefix}${opt.label} `
      const next = before + inserted + after
      const pos = (before + inserted).length
      emit('update:modelValue', next)
      active.value = null
      nextTick(() => {
        if (textareaEl) {
          textareaEl.focus()
          textareaEl.setSelectionRange(pos, pos)
        }
      })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!open.value) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        activeIndex.value = Math.min(filtered.value.length - 1, activeIndex.value + 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        activeIndex.value = Math.max(0, activeIndex.value - 1)
      } else if (e.key === 'Enter') {
        if (filtered.value[activeIndex.value]) {
          e.preventDefault()
          insert(filtered.value[activeIndex.value])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        active.value = null
      }
    }

    return () => {
      const activeId = open.value ? `${reactId}-opt-${activeIndex.value}` : undefined
      const list = filtered.value
      return h(
        'div',
        {
          ...attrs,
          'data-iris-mentions': '',
          style: {
            position: 'relative',
            display: 'inline-block',
            minWidth: '240px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h('textarea', {
            ref: (el: unknown) => {
              textareaEl = (el ?? null) as HTMLTextAreaElement | null
            },
            id: props.id,
            rows: props.rows,
            value: props.modelValue,
            placeholder: props.placeholder,
            disabled: props.disabled || undefined,
            role: 'combobox',
            'aria-autocomplete': 'list',
            'aria-expanded': open.value ? 'true' : 'false',
            'aria-controls': listboxId,
            'aria-activedescendant': activeId,
            'aria-invalid': props.invalid ? 'true' : undefined,
            'aria-describedby': props.ariaDescribedby,
            'data-iris-mentions-input': '',
            onInput,
            onKeydown: onKeyDown,
            style: {
              ...TEXTAREA_STYLE,
              border: `1px solid ${props.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
            },
          }),
          open.value
            ? h(
                'ul',
                {
                  id: listboxId,
                  role: 'listbox',
                  'data-iris-mentions-listbox': '',
                  ref: (el: unknown) => {
                    listboxRef.value = (el ?? null) as HTMLUListElement | null
                  },
                  onScroll: (e: Event) => {
                    v?.setScroll((e.currentTarget as HTMLElement).scrollTop)
                  },
                  style: LIST_STYLE,
                },
                props.virtual && v && vstate.value.items.length > 0
                  ? [
                      h('li', {
                        role: 'presentation',
                        'aria-hidden': 'true',
                        'data-iris-mentions-spacer': '',
                        'data-iris-mentions-spacer-type': 'top',
                        style: { height: `${vstate.value.offsetBefore}px` },
                      }),
                      ...vstate.value.items.map((item) => {
                        const opt = list[item.index]
                        if (!opt) return null
                        const isActive = item.index === activeIndex.value
                        return h(
                          'li',
                          {
                            key: opt.value,
                            id: `${reactId}-opt-${item.index}`,
                            role: 'option',
                            'aria-selected': isActive ? 'true' : 'false',
                            'aria-setsize': list.length,
                            'aria-posinset': item.index + 1,
                            'data-iris-mentions-option': '',
                            'data-value': opt.value,
                            onMousedown: (e: MouseEvent) => e.preventDefault(),
                            onMouseenter: () => {
                              activeIndex.value = item.index
                            },
                            onClick: () => insert(opt),
                            style: {
                              padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
                              fontSize: 'var(--iris-font-size-md, 14px)',
                              borderRadius: 'var(--iris-radius-sm, 4px)',
                              cursor: 'pointer',
                              background: isActive
                                ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                                : 'transparent',
                            },
                          },
                          opt.label,
                        )
                      }),
                      h('li', {
                        role: 'presentation',
                        'aria-hidden': 'true',
                        'data-iris-mentions-spacer': '',
                        'data-iris-mentions-spacer-type': 'bottom',
                        style: {
                          height: `${vstate.value.totalSize - vstate.value.offsetBefore - vstate.value.items.length * ROW_HEIGHT}px`,
                        },
                      }),
                    ]
                  : list.map((opt, i) =>
                      h(
                        'li',
                        {
                          key: opt.value,
                          id: `${reactId}-opt-${i}`,
                          role: 'option',
                          'aria-selected': i === activeIndex.value ? 'true' : 'false',
                          'data-iris-mentions-option': '',
                          'data-value': opt.value,
                          onMousedown: (e: MouseEvent) => e.preventDefault(),
                          onMouseenter: () => {
                            activeIndex.value = i
                          },
                          onClick: () => insert(opt),
                          style: {
                            padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
                            fontSize: 'var(--iris-font-size-md, 14px)',
                            borderRadius: 'var(--iris-radius-sm, 4px)',
                            cursor: 'pointer',
                            background:
                              i === activeIndex.value
                                ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                                : 'transparent',
                          },
                        },
                        opt.label,
                      ),
                    ),
              )
            : null,
        ],
      )
    }
  },
})
