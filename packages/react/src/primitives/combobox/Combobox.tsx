import * as React from 'react'
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
}

const SIZE_MAP: Record<IrisComboboxSize, { padding: string; fontSize: string; minHeight: string }> =
  {
    sm: { padding: '4px 8px', fontSize: '12px', minHeight: '28px' },
    md: { padding: '6px 12px', fontSize: '14px', minHeight: '34px' },
    lg: { padding: '8px 12px', fontSize: '16px', minHeight: '40px' },
  }

/**
 * Filterable single-select (searchable select): a text input that type-ahead
 * filters a listbox of options. The displayed text is derived
 * (`filtering ? query : selected label`) so controlled value changes stay in
 * sync without an effect. Opens downward; follows the ARIA 1.2 combobox pattern.
 *
 * React port of {@link import('@iris-ui/vue').IrisCombobox}.
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

  const close = () => {
    setOpen(false)
    setFiltering(false)
    setActiveIndex(-1)
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
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (open) setActiveIndex((i) => Math.max(0, i - 1))
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
      }
    } else if (e.key === 'End') {
      if (open) {
        e.preventDefault()
        setActiveIndex(filtered.length - 1)
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
            ? `0 0 0 3px ${invalid ? 'rgba(239, 68, 68, 0.18)' : 'rgba(99, 102, 241, 0.18)'}`
            : 'none',
          transition: 'border-color 120ms ease, box-shadow 120ms ease',
        }}
      />
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          data-iris-combobox-listbox=""
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
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          {filtered.length === 0 ? (
            <li
              data-iris-combobox-empty=""
              aria-disabled="true"
              style={{ padding: '6px 10px', color: 'var(--iris-muted)', fontSize: sz.fontSize }}
            >
              {resolvedEmpty}
            </li>
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
                    padding: '6px 10px',
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
