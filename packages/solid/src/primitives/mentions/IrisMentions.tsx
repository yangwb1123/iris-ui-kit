import {
  createSignal,
  createMemo,
  createUniqueId,
  mergeProps,
  splitProps,
  Show,
  For,
  type JSX,
} from 'solid-js'

export interface IrisMentionOption {
  label: string
  value: string
}

interface Active {
  start: number
  query: string
}

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

export interface IrisMentionsProps {
  value?: string
  defaultValue?: string
  options?: IrisMentionOption[]
  prefix?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  rows?: number
  id?: string
  onChange?: (value: string) => void
}

/**
 * Mentions textarea: opens an autocomplete listbox when the user types the
 * trigger prefix (default `@`). Selecting a suggestion replaces the token.
 * Solid port of the Vue IrisMentions.
 */
export function IrisMentions(props: IrisMentionsProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultValue: '',
      options: [] as IrisMentionOption[],
      prefix: '@',
      disabled: false,
      invalid: false,
      rows: 3,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'value',
    'defaultValue',
    'options',
    'prefix',
    'placeholder',
    'disabled',
    'invalid',
    'rows',
    'id',
    'onChange',
  ])

  const [internalValue, setInternalValue] = createSignal(local.defaultValue)
  const [active, setActive] = createSignal<Active | null>(null)
  const [activeIdx, setActiveIdx] = createSignal(0)

  const currentValue = () => (local.value !== undefined ? local.value : internalValue())

  const baseId = createUniqueId()
  const listboxId = `${baseId}-listbox`

  const filtered = createMemo(() => {
    const a = active()
    if (!a) return []
    const q = a.query.toLowerCase()
    return local.options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    )
  })

  const isOpen = (): boolean => active() !== null && filtered().length > 0
  const activeId = (): string | undefined => (isOpen() ? `${baseId}-opt-${activeIdx()}` : undefined)

  const updateValue = (v: string) => {
    if (local.value === undefined) setInternalValue(v)
    local.onChange?.(v)
  }

  const onInput = (e: Event) => {
    const ta = e.target as HTMLTextAreaElement
    updateValue(ta.value)
    const caret = ta.selectionStart ?? ta.value.length
    setActive(detect(ta.value, caret, local.prefix))
    setActiveIdx(0)
  }

  const pickOption = (opt: IrisMentionOption) => {
    const a = active()
    if (!a) return
    const val = currentValue()
    const before = val.slice(0, a.start)
    const after = val.slice(a.start + 1 + a.query.length)
    const replacement = `${local.prefix}${opt.label} `
    updateValue(before + replacement + after)
    setActive(null)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const items = filtered()
    if (!active() || items.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && active()) {
      e.preventDefault()
      const item = items[activeIdx()]
      if (item) pickOption(item)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setActive(null)
    }
  }

  return (
    <div data-iris-mentions="" style={{ position: 'relative', display: 'block' }}>
      <textarea
        id={local.id}
        data-iris-mentions-textarea=""
        rows={local.rows}
        placeholder={local.placeholder}
        value={currentValue()}
        disabled={local.disabled || undefined}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen()}
        aria-controls={listboxId}
        aria-activedescendant={activeId()}
        aria-invalid={local.invalid ? 'true' : undefined}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setActive(null), 150)}
        style={{
          'box-sizing': 'border-box',
          width: '100%',
          padding: '8px 12px',
          'font-size': '14px',
          'font-family': 'inherit',
          color: 'var(--iris-foreground)',
          background: 'var(--iris-background)',
          border: `1px solid ${local.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
          'border-radius': 'var(--iris-radius-md, 6px)',
          outline: 'none',
          resize: 'vertical',
        }}
      />
      <Show when={active() && filtered().length > 0}>
        <ul
          id={listboxId}
          data-iris-mentions-list=""
          role="listbox"
          style={{
            position: 'absolute',
            left: '0',
            top: '100%',
            'margin-top': '4px',
            'max-height': '200px',
            'overflow-y': 'auto',
            'min-width': '160px',
            margin: '0',
            padding: '4px',
            'z-index': '50',
            'list-style': 'none',
            background: 'var(--iris-background)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            'box-shadow': '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          <For each={filtered()}>
            {(opt, i) => (
              <li
                id={`${baseId}-opt-${i()}`}
                role="option"
                aria-selected={i() === activeIdx()}
                data-iris-mentions-item={opt.value}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pickOption(opt)
                }}
                onMouseEnter={() => setActiveIdx(i())}
                style={{
                  padding: '7px 10px',
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                  cursor: 'pointer',
                  'font-size': '14px',
                  background: i() === activeIdx() ? 'var(--iris-primary)' : 'transparent',
                  color:
                    i() === activeIdx()
                      ? 'var(--iris-primary-foreground, #fff)'
                      : 'var(--iris-foreground)',
                }}
              >
                {opt.label}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
