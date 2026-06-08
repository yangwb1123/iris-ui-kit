import { createMemo, createSignal, createUniqueId, mergeProps, Show, For, type JSX } from 'solid-js'

export type IrisComboboxSize = 'sm' | 'md' | 'lg'

export interface IrisComboboxOption {
  label: string
  value: string
  disabled?: boolean
}

const SIZE_MAP: Record<IrisComboboxSize, { padding: string; fontSize: string; minHeight: string }> =
  {
    sm: { padding: '4px 8px', fontSize: '12px', minHeight: '28px' },
    md: { padding: '6px 12px', fontSize: '14px', minHeight: '34px' },
    lg: { padding: '8px 12px', fontSize: '16px', minHeight: '40px' },
  }

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
    },
    props,
  )

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
      ? merged.options.filter((o) => o.label.toLowerCase().includes(needle))
      : merged.options
  })

  const close = (): void => {
    setOpen(false)
    setFiltering(false)
    setActiveIndex(-1)
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
      setActiveIndex((ai) => Math.min(list.length - 1, ai + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (open()) setActiveIndex((ai) => Math.max(0, ai - 1))
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
      }
    } else if (event.key === 'End') {
      if (open()) {
        event.preventDefault()
        setActiveIndex(list.length - 1)
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
  const resolvedEmpty = createMemo(() => merged.emptyText ?? 'No options')

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
          role="listbox"
          data-iris-combobox-listbox=""
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
            'box-shadow': '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          <Show
            when={filtered().length > 0}
            fallback={
              <li
                data-iris-combobox-empty=""
                aria-disabled="true"
                style={{
                  padding: '6px 10px',
                  color: 'var(--iris-muted)',
                  'font-size': sz().fontSize,
                }}
              >
                {resolvedEmpty()}
              </li>
            }
          >
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
                      padding: '6px 10px',
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
          </Show>
        </ul>
      </Show>
    </div>
  )
}
