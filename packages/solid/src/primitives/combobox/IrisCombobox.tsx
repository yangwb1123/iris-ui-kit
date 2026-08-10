import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  mergeProps,
  onCleanup,
  Show,
  untrack,
  type JSX,
} from 'solid-js'
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
    sm: { padding: '4px 8px', fontSize: 'var(--iris-font-size-xs, 12px)', minHeight: '28px' },
    md: {
      padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
      fontSize: 'var(--iris-font-size-md, 14px)',
      minHeight: '34px',
    },
    lg: { padding: '8px 12px', fontSize: 'var(--iris-font-size-lg, 16px)', minHeight: '40px' },
  }

/** Listbox maxHeight — the virtualizer's viewport (px). */
const LISTBOX_MAX_HEIGHT = 240
/** Fixed per-option row height (px) — mirrors SIZE_MAP minHeight (estimate, never measured). */
const ROW_HEIGHT: Record<IrisComboboxSize, number> = { sm: 28, md: 34, lg: 40 }

export interface IrisComboboxProps {
  /** Selected option value ('' = none). */
  value?: string
  options?: IrisComboboxOption[]
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  size?: IrisComboboxSize
  emptyText?: string
  id?: string
  onChange?: (value: string) => void
  /**
   * Opt-in windowed rendering of the listbox via the core virtualizer.
   * When true, only the visible window (+ buffer) of options is rendered;
   * keyboard navigation scrolls the active option into view. Default false.
   */
  virtual?: boolean
  style?: JSX.CSSProperties
}

/**
 * Filterable single-select (searchable select): a text input that type-ahead
 * filters a listbox of options. Follows the ARIA 1.2 combobox pattern.
 * Solid port of the Vue IrisCombobox.
 */
export function IrisCombobox(props: IrisComboboxProps): JSX.Element {
  const merged = mergeProps(
    {
      options: [] as IrisComboboxOption[],
      size: 'md' as IrisComboboxSize,
      disabled: false,
      invalid: false,
      virtual: false,
    },
    props,
  )

  const { t } = useI18n()

  const reactId = createUniqueId()
  const listboxId = `${reactId}-listbox`
  const optionId = (i: number) => `${reactId}-opt-${i}`

  const [query, setQuery] = createSignal('')
  const [filtering, setFiltering] = createSignal(false)
  const [open, setOpen] = createSignal(false)
  const [activeIndex, setActiveIndex] = createSignal(-1)
  const [focused, setFocused] = createSignal(false)

  const selected = createMemo(() => merged.options.find((o) => o.value === merged.value))
  const display = createMemo(() => (filtering() ? query() : (selected()?.label ?? '')))
  const filtered = createMemo(() => {
    const needle = query().trim().toLowerCase()
    return filtering() && needle
      ? merged.options.filter((o) => o.label.toLowerCase().startsWith(needle))
      : merged.options
  })

  // Virtualized listbox (opt-in): one controller per mount (created lazily,
  // then retained), reactive inputs read untracked through closures so the
  // instance (scroll offset + keyed cache) survives re-renders.
  let vInstance: Virtualizer | null = null
  const virtualizer = createMemo<Virtualizer | null>(() => {
    if (!merged.virtual) return null
    return untrack(() => {
      if (!vInstance) {
        vInstance = createVirtualizer({
          count: 0,
          estimateSize: () => ROW_HEIGHT[merged.size],
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
  // Count + scroll clamp: re-runs when the filtered list (or size) changes.
  createEffect(() => {
    const v = virtualizer()
    if (!v) return
    v.setCount(filtered().length)
    const el = listboxEl
    if (el) {
      const max = Math.max(0, v.totalSize() - LISTBOX_MAX_HEIGHT)
      if (el.scrollTop > max) el.scrollTop = max
    }
  })
  // Windowed options (stale-window guard: skip indices missing from `filtered`).
  // Wrapper objects are cached per index so For's identity-keyed reconciliation
  // reuses DOM when the window shifts.
  const windowCache = new Map<number, { opt: IrisComboboxOption; index: number }>()
  const windowed = createMemo(() => {
    const list = filtered()
    const out: { opt: IrisComboboxOption; index: number }[] = []
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

  let listboxEl: HTMLUListElement | undefined
  // Scroll the active option into view ('auto' semantics: no-op when already
  // fully inside the viewport). Estimates are constant and never measured, so
  // `start = index × rowHeight` is exact.
  const ensureVisible = (index: number): void => {
    if (!merged.virtual || !vInstance || index < 0 || index >= filtered().length) return
    const el = listboxEl
    if (!el) return
    const top = el.scrollTop
    const start = index * ROW_HEIGHT[merged.size]
    if (start >= top && start + ROW_HEIGHT[merged.size] <= top + LISTBOX_MAX_HEIGHT) return
    el.scrollTop = vInstance.scrollToIndex(index, start < top ? 'start' : 'end')
  }

  const close = (): void => {
    setOpen(false)
    setFiltering(false)
    setActiveIndex(-1)
    vInstance?.setScroll(0)
  }

  const selectOption = (opt: IrisComboboxOption): void => {
    if (opt.disabled) return
    props.onChange?.(opt.value)
    setQuery('')
    close()
  }

  const onInput = (event: Event): void => {
    setQuery((event.target as HTMLInputElement).value)
    setFiltering(true)
    setOpen(true)
    setActiveIndex(0)
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (merged.disabled) return
    const list = filtered()
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open()) {
        setOpen(true)
        setFiltering(false)
        setActiveIndex(0)
        return
      }
      const next = Math.min(list.length - 1, activeIndex() + 1)
      setActiveIndex(next)
      ensureVisible(next)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (open()) {
        const next = Math.max(0, activeIndex() - 1)
        setActiveIndex(next)
        ensureVisible(next)
      }
    } else if (event.key === 'Enter') {
      if (open() && activeIndex() >= 0 && list[activeIndex()]) {
        event.preventDefault()
        selectOption(list[activeIndex()]!)
      }
    } else if (event.key === 'Escape') {
      if (open()) {
        event.preventDefault()
        close()
      }
    } else if (event.key === 'Home') {
      if (open()) {
        event.preventDefault()
        setActiveIndex(0)
        ensureVisible(0)
      }
    } else if (event.key === 'End') {
      if (open()) {
        event.preventDefault()
        const next = list.length - 1
        setActiveIndex(next)
        ensureVisible(next)
      }
    }
  }

  const sz = createMemo(() => SIZE_MAP[merged.size])
  const borderColor = createMemo(() =>
    merged.invalid
      ? 'var(--iris-danger)'
      : focused()
        ? 'var(--iris-primary)'
        : 'var(--iris-border)',
  )
  const activeId = createMemo(() => {
    if (!open() || activeIndex() < 0 || !filtered()[activeIndex()]) return undefined
    return optionId(activeIndex())
  })
  const resolvedEmpty = createMemo(() => merged.emptyText ?? t('combobox.empty'))

  return (
    <div
      data-iris-combobox=""
      data-iris-combobox-size={merged.size}
      data-state={open() ? 'open' : 'closed'}
      style={{
        position: 'relative',
        display: 'inline-block',
        'min-width': '200px',
        ...(merged.style ?? {}),
      }}
    >
      <input
        id={merged.id}
        type="text"
        role="combobox"
        autocomplete="off"
        value={display()}
        placeholder={merged.placeholder}
        disabled={merged.disabled || undefined}
        aria-expanded={open() ? 'true' : 'false'}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeId()}
        aria-invalid={merged.invalid ? 'true' : undefined}
        data-iris-combobox-input=""
        onInput={onInput}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (merged.disabled) return
          setFocused(true)
          setOpen(true)
          setFiltering(false)
        }}
        onBlur={() => {
          setFocused(false)
          close()
        }}
        style={{
          'box-sizing': 'border-box',
          width: '100%',
          padding: sz().padding,
          'min-height': sz().minHeight,
          'font-size': sz().fontSize,
          'font-family': 'inherit',
          color: 'var(--iris-foreground)',
          background: 'var(--iris-background)',
          border: `1px solid ${borderColor()}`,
          'border-radius': 'var(--iris-radius-md, 6px)',
          outline: 'none',
          opacity: merged.disabled ? '0.6' : '1',
          transition: 'border-color 120ms ease, box-shadow 120ms ease',
        }}
      />
      <Show when={open()}>
        <ul
          id={listboxId}
          ref={listboxEl}
          role="listbox"
          data-iris-combobox-listbox=""
          onScroll={(e) => {
            vInstance?.setScroll(e.currentTarget.scrollTop)
          }}
          style={{
            display: 'block',
            position: 'absolute',
            'inset-inline-start': '0',
            'inset-inline-end': '0',
            top: '100%',
            'margin-block-start': '4px',
            'max-height': '240px',
            'overflow-y': 'auto',
            'list-style': 'none',
            margin: '0',
            padding: '4px',
            'z-index': 50,
            background: 'var(--iris-background)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            'box-shadow': 'var(--iris-shadow-lg)',
          }}
        >
          <Show
            when={filtered().length > 0}
            fallback={
              <li
                data-iris-combobox-empty=""
                aria-disabled="true"
                style={{
                  padding: 'var(--iris-padding-sm, 6px) var(--iris-space-sm, 12px)',
                  color: 'var(--iris-muted)',
                  'font-size': sz().fontSize,
                }}
              >
                {resolvedEmpty()}
              </li>
            }
          >
            <Show
              when={virtualizer() !== null}
              fallback={
                <For each={filtered()}>
                  {(opt, index) => {
                    const i = index()
                    const isActive = () => i === activeIndex()
                    const isSelected = () => opt.value === merged.value
                    return (
                      <li
                        id={optionId(i)}
                        role="option"
                        aria-selected={isSelected() ? 'true' : 'false'}
                        aria-disabled={opt.disabled ? 'true' : undefined}
                        data-iris-combobox-option=""
                        data-active={isActive() ? 'true' : undefined}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => selectOption(opt)}
                        style={{
                          padding: 'var(--iris-padding-sm, 6px) var(--iris-space-sm, 12px)',
                          'font-size': sz().fontSize,
                          'border-radius': 'var(--iris-radius-sm, 4px)',
                          cursor: opt.disabled ? 'not-allowed' : 'pointer',
                          color: opt.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                          background: isActive()
                            ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                            : 'transparent',
                          'font-weight': isSelected() ? '600' : '400',
                        }}
                      >
                        {opt.label}
                      </li>
                    )
                  }}
                </For>
              }
            >
              <li
                role="presentation"
                aria-hidden="true"
                data-iris-combobox-spacer=""
                data-iris-combobox-spacer-type="top"
                style={{ height: `${vstate().offsetBefore}px` }}
              />
              <For each={windowed()}>
                {(w) => {
                  const isActive = () => w.index === activeIndex()
                  const isSelected = () => w.opt.value === merged.value
                  return (
                    <li
                      id={optionId(w.index)}
                      role="option"
                      aria-selected={isSelected() ? 'true' : 'false'}
                      aria-disabled={w.opt.disabled ? 'true' : undefined}
                      aria-setsize={filtered().length}
                      aria-posinset={w.index + 1}
                      data-iris-combobox-option=""
                      data-active={isActive() ? 'true' : undefined}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIndex(w.index)}
                      onClick={() => selectOption(w.opt)}
                      style={{
                        padding: 'var(--iris-padding-sm, 6px) var(--iris-space-sm, 12px)',
                        'font-size': sz().fontSize,
                        'border-radius': 'var(--iris-radius-sm, 4px)',
                        cursor: w.opt.disabled ? 'not-allowed' : 'pointer',
                        color: w.opt.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                        background: isActive()
                          ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                          : 'transparent',
                        'font-weight': isSelected() ? '600' : '400',
                      }}
                    >
                      {w.opt.label}
                    </li>
                  )
                }}
              </For>
              <li
                role="presentation"
                aria-hidden="true"
                data-iris-combobox-spacer=""
                data-iris-combobox-spacer-type="bottom"
                style={{
                  height: `${vstate().totalSize - vstate().offsetBefore - vstate().items.length * ROW_HEIGHT[merged.size]}px`,
                }}
              />
            </Show>
          </Show>
        </ul>
      </Show>
    </div>
  )
}
