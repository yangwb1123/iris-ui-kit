import {
  createSignal,
  createMemo,
  createEffect,
  createUniqueId,
  mergeProps,
  onCleanup,
  splitProps,
  Show,
  For,
  untrack,
  type JSX,
} from 'solid-js'
import { createVirtualizer, type Virtualizer, type VirtualizerState } from '@iris-ui-kit/core'

export interface IrisMentionOption {
  label: string
  value: string
}

interface Active {
  start: number
  query: string
}

/** Listbox maxHeight — the virtualizer's viewport (px). */
const LISTBOX_MAX_HEIGHT = 200
/** Fixed per-option row height (px) — estimate, never measured. */
const ROW_HEIGHT = 32

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
  /**
   * Opt-in windowed rendering of the suggestion listbox via the core
   * virtualizer. When true, only the visible window (+ buffer) of options is
   * rendered; keyboard navigation scrolls the active option into view and
   * every keystroke re-anchors the window to the top. Default false.
   */
  virtual?: boolean
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
      virtual: false,
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
    'virtual',
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

  // Virtualized listbox (opt-in): one controller per mount (created lazily,
  // then retained), reactive inputs read untracked through closures so the
  // instance (scroll offset + keyed cache) survives re-renders — the
  // IrisCombobox precedent.
  let vInstance: Virtualizer | null = null
  const virtualizer = createMemo<Virtualizer | null>(() => {
    if (!local.virtual) return null
    return untrack(() => {
      if (!vInstance) {
        vInstance = createVirtualizer({
          count: 0,
          estimateSize: () => ROW_HEIGHT,
          getItemKey: (i) => filtered()[i]?.value ?? i,
          viewportSize: LISTBOX_MAX_HEIGHT,
          buffer: 4,
        })
      }
      return vInstance
    })
  })
  const [vstate, setVstate] = createSignal<VirtualizerState>({
    items: [],
    offsetBefore: 0,
    totalSize: 0,
    startIndex: 0,
    endIndex: -1,
  })
  createEffect(() => {
    const v = virtualizer()
    if (!v) return
    setVstate(() => v.getState())
    const unsub = v.subscribe((next) => setVstate(() => next))
    onCleanup(unsub)
  })
  let lastText: string | undefined
  let lastActiveIndex = 0
  let listboxEl: HTMLUListElement | undefined
  // Single sync covering every listbox mutation: count push + per-keystroke
  // re-anchor to 0 (a keystroke always resets activeIdx), shrink clamp
  // (external options swaps) and active-option visibility (keyboard/mouse).
  // Wheel scrolling drives setScroll via the scroll handler, so it moves the
  // window freely — it does not change activeIdx.
  createEffect(() => {
    const v = virtualizer()
    if (!v) return
    const list = filtered()
    v.setCount(list.length)
    const text = currentValue()
    // Read up-front so `activeIdx` is tracked by this effect in EVERY run —
    // the re-anchor branch below returns early, and Solid re-collects
    // dependencies per run (an untracked activeIdx would freeze keyboard
    // navigation until the next text change).
    const idx = activeIdx()
    if (text !== lastText) {
      lastText = text
      lastActiveIndex = 0
      v.setScroll(0)
      if (listboxEl) listboxEl.scrollTop = 0
      return
    }
    const el = listboxEl
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
  // Windowed options (stale-window guard: skip indices missing from `filtered`).
  // Wrapper objects are cached per index so For's identity-keyed reconciliation
  // reuses DOM when the window shifts.
  const windowCache = new Map<number, { opt: IrisMentionOption; index: number }>()
  const windowed = createMemo(() => {
    const list = filtered()
    const out: { opt: IrisMentionOption; index: number }[] = []
    for (const item of vstate().items) {
      const opt = list[item.index]
      if (!opt) continue
      const prev = windowCache.get(item.index)
      const w = prev && prev.opt === opt ? prev : { opt, index: item.index }
      windowCache.set(item.index, w)
      out.push(w)
    }
    return out
  })

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
          'font-size': 'var(--iris-font-size-md, 14px)',
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
          ref={listboxEl}
          data-iris-mentions-list=""
          role="listbox"
          onScroll={(e) => {
            vInstance?.setScroll(e.currentTarget.scrollTop)
          }}
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
            'box-shadow': 'var(--iris-shadow-lg)',
          }}
        >
          <Show
            when={virtualizer() !== null}
            fallback={
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
                      padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
                      'border-radius': 'var(--iris-radius-sm, 4px)',
                      cursor: 'pointer',
                      'font-size': 'var(--iris-font-size-md, 14px)',
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
            }
          >
            <li
              role="presentation"
              aria-hidden="true"
              data-iris-mentions-spacer=""
              data-iris-mentions-spacer-type="top"
              style={{ height: `${vstate().offsetBefore}px` }}
            />
            <For each={windowed()}>
              {(w) => (
                <li
                  id={`${baseId}-opt-${w.index}`}
                  role="option"
                  aria-selected={w.index === activeIdx()}
                  aria-setsize={filtered().length}
                  aria-posinset={w.index + 1}
                  data-iris-mentions-item={w.opt.value}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pickOption(w.opt)
                  }}
                  onMouseEnter={() => setActiveIdx(w.index)}
                  style={{
                    padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
                    'border-radius': 'var(--iris-radius-sm, 4px)',
                    cursor: 'pointer',
                    'font-size': 'var(--iris-font-size-md, 14px)',
                    background: w.index === activeIdx() ? 'var(--iris-primary)' : 'transparent',
                    color:
                      w.index === activeIdx()
                        ? 'var(--iris-primary-foreground, #fff)'
                        : 'var(--iris-foreground)',
                  }}
                >
                  {w.opt.label}
                </li>
              )}
            </For>
            <li
              role="presentation"
              aria-hidden="true"
              data-iris-mentions-spacer=""
              data-iris-mentions-spacer-type="bottom"
              style={{
                height: `${vstate().totalSize - vstate().offsetBefore - vstate().items.length * ROW_HEIGHT}px`,
              }}
            />
          </Show>
        </ul>
      </Show>
    </div>
  )
}
