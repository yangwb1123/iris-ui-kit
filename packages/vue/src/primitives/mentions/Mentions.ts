import { computed, defineComponent, h, nextTick, ref, useId, type PropType } from 'vue'

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
                  style: LIST_STYLE,
                },
                filtered.value.map((opt, i) =>
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
