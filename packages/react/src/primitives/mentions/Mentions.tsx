import * as React from 'react'
import { createVirtualizer, type Virtualizer } from '@iris-ui-kit/core'

export interface IrisMentionOption {
  label: string
  value: string
}

export interface IrisMentionsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  options: IrisMentionOption[]
  /** Trigger character. Default '@'. */
  prefix?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  rows?: number
  /**
   * Opt-in windowed rendering of the suggestion listbox via the core
   * virtualizer. When true, only the visible window (+ buffer) of options is
   * rendered; keyboard navigation scrolls the active option into view and
   * every keystroke re-anchors the window to the top. Default false.
   */
  virtual?: boolean
  /** id forwarded to the textarea. Set by `IrisFormField`. */
  id?: string
  ariaDescribedby?: string
  style?: React.CSSProperties
  className?: string
}

interface Active {
  start: number
  query: string
}

/** Listbox maxHeight — the virtualizer's viewport (px). */
const LISTBOX_MAX_HEIGHT = 200
/** Fixed per-option row height (px) — mirrors the option padding + font size (estimate, never measured). */
const ROW_HEIGHT = 32

/** Find an active mention token (prefix at start/after-space, no inner spaces). */
function detect(text: string, caret: number, prefix: string): Active | null {
  let i = caret - 1
  while (i >= 0 && text[i] !== prefix) {
    if (/\s/.test(text[i] as string)) return null
    i--
  }
  if (i < 0) return null
  if (i === 0 || /\s/.test(text[i - 1] as string)) {
    return { start: i, query: text.slice(i + 1, caret) }
  }
  return null
}

/**
 * Mentions: a textarea that opens an autocomplete listbox when the user types
 * the trigger character (default `@`). Selecting a suggestion replaces the
 * `@query` token with the chosen label. Keyboard: ↑/↓ to move, Enter to pick,
 * Esc to dismiss.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisMentions}.
 */
export function IrisMentions({
  value,
  defaultValue = '',
  onValueChange,
  options,
  prefix = '@',
  placeholder,
  disabled = false,
  invalid = false,
  rows = 3,
  virtual = false,
  id,
  ariaDescribedby,
  style,
  className,
  ...rest
}: IrisMentionsProps): React.ReactElement {
  const reactId = React.useId()
  const listboxId = `${reactId}-listbox`
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState(defaultValue)
  const text = isControlled ? (value as string) : internal

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const startRef = React.useRef(0)
  const caretRef = React.useRef(0)
  const pendingCaret = React.useRef<number | null>(null)
  const [active, setActive] = React.useState<Active | null>(null)
  const [activeIndex, setActiveIndex] = React.useState(0)

  const filtered = active
    ? options.filter((o) => o.label.toLowerCase().includes(active.query.toLowerCase()))
    : []
  const open = active !== null && filtered.length > 0

  // Virtualized listbox (opt-in): one controller per mount, reactive inputs
  // read through refs so the instance (scroll offset + keyed cache) survives
  // renders — the same instance-preservation pattern as IrisCombobox.
  const filteredRef = React.useRef(filtered)
  filteredRef.current = filtered
  const virtualizer = React.useMemo<Virtualizer>(
    () =>
      createVirtualizer({
        count: 0,
        estimateSize: () => ROW_HEIGHT,
        getItemKey: (i) => filteredRef.current[i]?.value ?? i,
        viewportSize: LISTBOX_MAX_HEIGHT,
        buffer: 4,
      }),
    [],
  )
  const vstate = React.useSyncExternalStore(virtualizer.subscribe, virtualizer.getState)
  const [listScrollTop, setListScrollTop] = React.useState(0)
  const listboxRef = React.useRef<HTMLUListElement | null>(null)
  // Change detectors for the layout-phase sync (below): a text change means a
  // keystroke (activeIndex resets to 0 — re-anchor the window to the top); an
  // activeIndex change means keyboard/mouse navigation (keep it visible).
  const lastTextRef = React.useRef<string | undefined>(undefined)
  const lastActiveIndexRef = React.useRef(0)

  // Single layout-phase sync covering every listbox mutation: count push +
  // per-keystroke re-anchor to 0, shrink clamp (external `options` swaps), and
  // active-option visibility (keyboard arrows / mouse hover). Runs pre-paint,
  // never during render; wheel scrolling moves the window freely because it
  // does not change `activeIndex`.
  React.useLayoutEffect(() => {
    if (!virtual || !open) return
    const el = listboxRef.current
    virtualizer.setCount(filtered.length)
    if (lastTextRef.current !== text) {
      lastTextRef.current = text
      lastActiveIndexRef.current = 0
      virtualizer.setScroll(0)
      if (el) el.scrollTop = 0
      setListScrollTop(0)
      return
    }
    virtualizer.setScroll(listScrollTop)
    if (el) {
      const max = Math.max(0, virtualizer.totalSize() - LISTBOX_MAX_HEIGHT)
      if (el.scrollTop > max) el.scrollTop = max
    }
    if (activeIndex !== lastActiveIndexRef.current) {
      lastActiveIndexRef.current = activeIndex
      if (activeIndex >= 0 && activeIndex < filtered.length && el) {
        const top = el.scrollTop
        const start = activeIndex * ROW_HEIGHT
        if (start < top || start + ROW_HEIGHT > top + LISTBOX_MAX_HEIGHT) {
          const target = virtualizer.scrollToIndex(activeIndex, start < top ? 'start' : 'end')
          el.scrollTop = target
          setListScrollTop(target)
        }
      }
    }
  }, [virtual, open, text, filtered.length, activeIndex, listScrollTop])

  const setText = (next: string) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    const caret = e.target.selectionStart ?? val.length
    setText(val)
    const found = detect(val, caret, prefix)
    if (found) {
      startRef.current = found.start
      caretRef.current = caret
      setActive(found)
      setActiveIndex(0)
    } else {
      setActive(null)
    }
  }

  const insert = (opt: IrisMentionOption) => {
    const before = text.slice(0, startRef.current)
    const after = text.slice(caretRef.current)
    const inserted = `${prefix}${opt.label} `
    const next = before + inserted + after
    pendingCaret.current = (before + inserted).length
    setText(next)
    setActive(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      if (filtered[activeIndex]) {
        e.preventDefault()
        insert(filtered[activeIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setActive(null)
    }
  }

  React.useEffect(() => {
    if (pendingCaret.current != null && textareaRef.current) {
      const pos = pendingCaret.current
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(pos, pos)
      pendingCaret.current = null
    }
  })

  const activeId = open ? `${reactId}-opt-${activeIndex}` : undefined

  return (
    <div
      data-iris-mentions=""
      className={className}
      {...rest}
      style={{ position: 'relative', display: 'inline-block', minWidth: 240, ...style }}
    >
      <textarea
        ref={textareaRef}
        id={id}
        rows={rows}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedby}
        data-iris-mentions-input=""
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          padding: '8px 12px',
          fontSize: 'var(--iris-font-size-md, 14px)',
          fontFamily: 'inherit',
          color: 'var(--iris-foreground)',
          background: 'var(--iris-background)',
          border: `1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
          borderRadius: 'var(--iris-radius-md, 6px)',
          outline: 'none',
          resize: 'vertical',
        }}
      />
      {open ? (
        <ul
          id={listboxId}
          ref={listboxRef}
          role="listbox"
          data-iris-mentions-listbox=""
          onScroll={(e) => {
            if (!virtual) return
            setListScrollTop(e.currentTarget.scrollTop)
          }}
          style={{
            position: 'absolute',
            insetInlineStart: 0,
            top: '100%',
            marginBlockStart: 4,
            maxHeight: 200,
            overflowY: 'auto',
            minWidth: 160,
            margin: 0,
            padding: 4,
            zIndex: 50,
            listStyle: 'none',
            background: 'var(--iris-background)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            boxShadow: 'var(--iris-shadow-lg)',
          }}
        >
          {virtual ? (
            <>
              <li
                role="presentation"
                aria-hidden="true"
                data-iris-mentions-spacer=""
                data-iris-mentions-spacer-type="top"
                style={{ height: vstate.offsetBefore }}
              />
              {vstate.items.map((item) => {
                const opt = filtered[item.index]
                if (!opt) return null
                const isActive = item.index === activeIndex
                return (
                  <li
                    key={opt.value}
                    id={`${reactId}-opt-${item.index}`}
                    role="option"
                    aria-selected={isActive}
                    aria-setsize={filtered.length}
                    aria-posinset={item.index + 1}
                    data-iris-mentions-option=""
                    data-value={opt.value}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(item.index)}
                    onClick={() => insert(opt)}
                    style={{
                      padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
                      fontSize: 'var(--iris-font-size-md, 14px)',
                      borderRadius: 'var(--iris-radius-sm, 4px)',
                      cursor: 'pointer',
                      background: isActive
                        ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                        : 'transparent',
                    }}
                  >
                    {opt.label}
                  </li>
                )
              })}
              <li
                role="presentation"
                aria-hidden="true"
                data-iris-mentions-spacer=""
                data-iris-mentions-spacer-type="bottom"
                style={{
                  height: vstate.totalSize - vstate.offsetBefore - vstate.items.length * ROW_HEIGHT,
                }}
              />
            </>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt.value}
                id={`${reactId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                data-iris-mentions-option=""
                data-value={opt.value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => insert(opt)}
                style={{
                  padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                  borderRadius: 'var(--iris-radius-sm, 4px)',
                  cursor: 'pointer',
                  background:
                    i === activeIndex
                      ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                      : 'transparent',
                }}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
