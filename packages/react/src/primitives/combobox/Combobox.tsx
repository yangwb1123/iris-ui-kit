import * as React from 'react'
import { createVirtualizer, type Virtualizer } from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'

export type IrisComboboxSize = 'sm' | 'md' | 'lg'

export interface IrisComboboxOption {
  label: string
  value: string
  disabled?: boolean
}

export interface IrisComboboxProps {
  /** Controlled selected option value ('' = none). */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  options: IrisComboboxOption[]
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  size?: IrisComboboxSize
  /** Text shown when no option matches the query. Defaults to the i18n value. */
  emptyText?: string
  /** id forwarded to the input. Set by `IrisFormField`. */
  id?: string
  /** Applied as `aria-describedby` on the input. Set by `IrisFormField`. */
  ariaDescribedby?: string
  style?: React.CSSProperties
  className?: string
  /**
   * Opt-in windowed rendering of the listbox via the core virtualizer.
   * When true, only the visible window (+ buffer) of options is rendered;
   * keyboard navigation scrolls the active option into view. Default false.
   */
  virtual?: boolean
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

/**
 * Filterable single-select (searchable select): a text input that type-ahead
 * filters a listbox of options. The displayed text is derived
 * (`filtering ? query : selected label`) so controlled value changes stay in
 * sync without an effect. Opens downward; follows the ARIA 1.2 combobox pattern.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisCombobox}.
 */
export function IrisCombobox({
  value: valueProp,
  defaultValue = '',
  onValueChange,
  options,
  placeholder,
  disabled = false,
  invalid = false,
  size = 'md',
  emptyText,
  id,
  ariaDescribedby,
  style,
  className,
  virtual = false,
  ...rest
}: IrisComboboxProps): React.ReactElement {
  const { t } = useI18n()
  const reactId = React.useId()
  const listboxId = `${reactId}-listbox`
  const optionId = (i: number) => `${reactId}-opt-${i}`

  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState(defaultValue)
  const currentValue = isControlled ? (valueProp as string) : internal

  const [query, setQuery] = React.useState('')
  const [filtering, setFiltering] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const [focused, setFocused] = React.useState(false)

  const selected = options.find((o) => o.value === currentValue)
  const display = filtering ? query : (selected?.label ?? '')
  const needle = query.trim().toLowerCase()
  const filtered =
    filtering && needle ? options.filter((o) => o.label.toLowerCase().startsWith(needle)) : options

  // Virtualized listbox (opt-in): one controller per mount, reactive inputs
  // read through refs so the instance (scroll offset + keyed cache) survives
  // renders — the same instance-preservation pattern as IrisVirtualScroll.
  const sizeRef = React.useRef(size)
  sizeRef.current = size
  const filteredRef = React.useRef(filtered)
  filteredRef.current = filtered
  const virtualizer = React.useMemo<Virtualizer>(
    () =>
      createVirtualizer({
        count: 0,
        estimateSize: () => ROW_HEIGHT[sizeRef.current],
        getItemKey: (i) => filteredRef.current[i]?.value ?? i,
        viewportSize: LISTBOX_MAX_HEIGHT,
        buffer: 4,
      }),
    [],
  )
  const vstate = React.useSyncExternalStore(virtualizer.subscribe, virtualizer.getState)
  const [listScrollTop, setListScrollTop] = React.useState(0)
  const listboxRef = React.useRef<HTMLUListElement | null>(null)

  // Push count + scroll into the controller pre-paint (never during render);
  // re-clamp the DOM scrollTop when the list shrinks (jsdom/browser parity).
  React.useLayoutEffect(() => {
    if (!virtual) return
    virtualizer.setCount(filtered.length)
    virtualizer.setScroll(listScrollTop)
    const el = listboxRef.current
    if (el) {
      const max = Math.max(0, virtualizer.totalSize() - LISTBOX_MAX_HEIGHT)
      if (el.scrollTop > max) el.scrollTop = max
    }
  }, [virtual, virtualizer, filtered.length, listScrollTop])

  // Scroll the active option into view ('auto' semantics: no-op when already
  // fully inside the viewport). Estimates are constant and never measured, so
  // `start = index × rowHeight` is exact.
  const ensureVisible = (index: number) => {
    if (!virtual || index < 0 || index >= filtered.length) return
    const el = listboxRef.current
    if (!el) return
    const top = el.scrollTop
    const start = index * ROW_HEIGHT[size]
    if (start >= top && start + ROW_HEIGHT[size] <= top + LISTBOX_MAX_HEIGHT) return
    const target = virtualizer.scrollToIndex(index, start < top ? 'start' : 'end')
    el.scrollTop = target
    setListScrollTop(target)
  }

  const close = () => {
    setOpen(false)
    setFiltering(false)
    setActiveIndex(-1)
    setListScrollTop(0)
  }

  const selectOption = (opt: IrisComboboxOption) => {
    if (opt.disabled) return
    if (!isControlled) setInternal(opt.value)
    onValueChange?.(opt.value)
    setQuery('')
    close()
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setFiltering(true)
    setOpen(true)
    setActiveIndex(0)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setFiltering(false)
        setActiveIndex(0)
        return
      }
      const next = Math.min(filtered.length - 1, activeIndex + 1)
      setActiveIndex(next)
      ensureVisible(next)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (open) {
        const next = Math.max(0, activeIndex - 1)
        setActiveIndex(next)
        ensureVisible(next)
      }
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && filtered[activeIndex]) {
        e.preventDefault()
        selectOption(filtered[activeIndex])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        close()
      }
    } else if (e.key === 'Home') {
      if (open) {
        e.preventDefault()
        setActiveIndex(0)
        ensureVisible(0)
      }
    } else if (e.key === 'End') {
      if (open) {
        e.preventDefault()
        const next = filtered.length - 1
        setActiveIndex(next)
        ensureVisible(next)
      }
    }
  }

  const sz = SIZE_MAP[size]
  const borderColor = invalid
    ? 'var(--iris-danger)'
    : focused
      ? 'var(--iris-primary)'
      : 'var(--iris-border)'
  const activeId =
    open && activeIndex >= 0 && filtered[activeIndex] ? optionId(activeIndex) : undefined
  const resolvedEmpty = emptyText ?? t('combobox.empty')

  return (
    <div
      data-iris-combobox=""
      data-iris-combobox-size={size}
      data-state={open ? 'open' : 'closed'}
      className={className}
      {...rest}
      style={{ position: 'relative', display: 'inline-block', minWidth: 200, ...style }}
    >
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedby}
        data-iris-combobox-input=""
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (disabled) return
          setFocused(true)
          setOpen(true)
          setFiltering(false)
        }}
        onBlur={() => {
          setFocused(false)
          close()
        }}
        style={{
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
          opacity: disabled ? 0.6 : 1,
          boxShadow: focused
            ? `0 0 0 3px ${invalid ? 'color-mix(in srgb, var(--iris-danger) 18%, transparent)' : 'color-mix(in srgb, var(--iris-primary) 18%, transparent)'}`
            : 'none',
          transition: 'border-color 120ms ease, box-shadow 120ms ease',
        }}
      />
      {open && (
        <ul
          id={listboxId}
          ref={listboxRef}
          role="listbox"
          data-iris-combobox-listbox=""
          onScroll={(e) => {
            if (!virtual) return
            setListScrollTop(e.currentTarget.scrollTop)
          }}
          style={{
            position: 'absolute',
            insetInlineStart: 0,
            insetInlineEnd: 0,
            top: '100%',
            marginBlockStart: 4,
            maxHeight: 240,
            overflowY: 'auto',
            listStyle: 'none',
            margin: 0,
            padding: 4,
            zIndex: 50,
            background: 'var(--iris-background)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            boxShadow: 'var(--iris-shadow-lg)',
          }}
        >
          {filtered.length === 0 ? (
            <li
              data-iris-combobox-empty=""
              aria-disabled="true"
              style={{
                padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
                color: 'var(--iris-muted)',
                fontSize: sz.fontSize,
              }}
            >
              {resolvedEmpty}
            </li>
          ) : virtual ? (
            <>
              <li
                role="presentation"
                aria-hidden="true"
                data-iris-combobox-spacer=""
                data-iris-combobox-spacer-type="top"
                style={{ height: vstate.offsetBefore }}
              />
              {vstate.items.map((item) => {
                const opt = filtered[item.index]
                if (!opt) return null
                const isActive = item.index === activeIndex
                const isSelected = opt.value === currentValue
                return (
                  <li
                    key={opt.value}
                    id={optionId(item.index)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled ? 'true' : undefined}
                    aria-setsize={filtered.length}
                    aria-posinset={item.index + 1}
                    data-iris-combobox-option=""
                    data-active={isActive ? 'true' : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(item.index)}
                    onClick={() => selectOption(opt)}
                    style={{
                      padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
                      fontSize: sz.fontSize,
                      borderRadius: 'var(--iris-radius-sm, 4px)',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      color: opt.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                      background: isActive
                        ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                        : 'transparent',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </li>
                )
              })}
              <li
                role="presentation"
                aria-hidden="true"
                data-iris-combobox-spacer=""
                data-iris-combobox-spacer-type="bottom"
                style={{
                  height:
                    vstate.totalSize - vstate.offsetBefore - vstate.items.length * ROW_HEIGHT[size],
                }}
              />
            </>
          ) : (
            filtered.map((opt, i) => {
              const isActive = i === activeIndex
              const isSelected = opt.value === currentValue
              return (
                <li
                  key={opt.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled ? 'true' : undefined}
                  data-iris-combobox-option=""
                  data-active={isActive ? 'true' : undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => selectOption(opt)}
                  style={{
                    padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
                    fontSize: sz.fontSize,
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                    cursor: opt.disabled ? 'not-allowed' : 'pointer',
                    color: opt.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                    background: isActive
                      ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                      : 'transparent',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {opt.label}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
