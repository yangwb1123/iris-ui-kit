import * as React from 'react'
import {
  defaultIconPickerCategories,
  defaultIconRegistry,
  getIconPickerCategoryId,
  matchesIconPickerQuery,
  type IrisIconPickerCategory,
  type IrisIconRegistry,
} from '@iris-ui-kit/icons'
import { useI18n } from '../../i18n'
import { IrisIcon } from './Icon'

const ALL_CATEGORY = '__iris_all_icons__'
const OTHER_CATEGORY: IrisIconPickerCategory = { id: 'other', iconNames: [] }

export interface IrisIconPickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  /** Selected semantic icon name. Omit to use `defaultValue`. */
  value?: string
  defaultValue?: string
  onValueChange?: (name: string) => void
  /** Resolve names from this registry; defaults to the built-in registry. */
  registry?: IrisIconRegistry
  /** Optional ordered allow-list; by default all names in the active registry are shown. */
  iconNames?: readonly string[]
  /** Category definitions; unlisted names are grouped under Other. */
  categories?: readonly IrisIconPickerCategory[]
  /** Number of icon columns. Clamped to 1–12. Default 6. */
  columns?: number
  disabled?: boolean
  label?: string
  searchLabel?: string
  placeholder?: string
  emptyText?: string
}

/** Searchable, categorized semantic icon picker with roving keyboard navigation. */
export function IrisIconPicker({
  value: valueProp,
  defaultValue,
  onValueChange,
  registry = defaultIconRegistry,
  iconNames,
  categories = defaultIconPickerCategories,
  columns = 6,
  disabled = false,
  label,
  searchLabel,
  placeholder,
  emptyText,
  className,
  style,
  'aria-label': ariaLabel,
  ...rest
}: IrisIconPickerProps): React.ReactElement {
  const { t } = useI18n()
  const id = React.useId()
  const searchId = `${id}-search`
  const listboxId = `${id}-icons`
  const isControlled = valueProp !== undefined
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? valueProp ?? '')
  const wasControlled = React.useRef(isControlled)
  const lastControlledValue = React.useRef(valueProp)
  if (isControlled) {
    wasControlled.current = true
    lastControlledValue.current = valueProp
  } else if (wasControlled.current) {
    wasControlled.current = false
    if (lastControlledValue.current !== undefined) setInternalValue(lastControlledValue.current)
  }
  const currentValue = isControlled ? valueProp : internalValue
  const [query, setQuery] = React.useState('')
  const [categoryId, setCategoryId] = React.useState(ALL_CATEGORY)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const searchRef = React.useRef<HTMLInputElement | null>(null)
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const categoryRefs = React.useRef<Array<HTMLButtonElement | null>>([])

  const resolvedNames = React.useMemo(
    () => [...new Set(iconNames ?? registry.list())].filter((name) => !!registry.resolve(name)),
    [iconNames, registry],
  )
  const icons = React.useMemo(
    () =>
      resolvedNames.flatMap((name) => {
        const icon = registry.resolve(name)
        return icon ? [{ name, icon }] : []
      }),
    [registry, resolvedNames],
  )
  const categoryIds = React.useMemo(
    () => icons.map(({ name }) => getIconPickerCategoryId(name, categories)),
    [categories, icons],
  )
  const visibleCategories = React.useMemo(() => {
    const available = new Set(categoryIds)
    const result = categories.filter((category) => available.has(category.id))
    if (available.has('other') && !result.some((category) => category.id === 'other')) {
      result.push(OTHER_CATEGORY)
    }
    return result
  }, [categories, categoryIds])
  const effectiveCategory =
    categoryId === ALL_CATEGORY || visibleCategories.some((item) => item.id === categoryId)
      ? categoryId
      : ALL_CATEGORY
  const filtered = React.useMemo(
    () =>
      icons.filter(
        ({ name }, index) =>
          (effectiveCategory === ALL_CATEGORY || categoryIds[index] === effectiveCategory) &&
          matchesIconPickerQuery(name, query),
      ),
    [categoryIds, effectiveCategory, icons, query],
  )
  const columnCount = Number.isFinite(columns) ? Math.max(1, Math.min(12, Math.trunc(columns))) : 6
  const active = Math.min(activeIndex, Math.max(0, filtered.length - 1))
  const resolvedLabel = label ?? ariaLabel ?? t('iconPicker.label')
  const resolvedSearchLabel = searchLabel ?? t('iconPicker.search')
  const resolvedPlaceholder = placeholder ?? t('iconPicker.placeholder')
  const resolvedEmptyText = emptyText ?? t('iconPicker.empty')

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query, effectiveCategory, icons])

  const choose = (name: string) => {
    if (disabled) return
    if (!isControlled) setInternalValue(name)
    onValueChange?.(name)
  }
  const focusOption = (next: number) => {
    if (filtered.length === 0) return
    const index = Math.max(0, Math.min(filtered.length - 1, next))
    setActiveIndex(index)
    optionRefs.current[index]?.focus()
  }
  const onOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | undefined
    switch (event.key) {
      case 'ArrowRight':
        next = index + 1
        break
      case 'ArrowLeft':
        next = index - 1
        break
      case 'ArrowDown':
        next = index + columnCount
        break
      case 'ArrowUp':
        next = index - columnCount
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = filtered.length - 1
        break
      case 'Escape':
        event.preventDefault()
        searchRef.current?.focus()
        return
      default:
        return
    }
    event.preventDefault()
    focusOption(next)
  }
  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && filtered.length > 0) {
      event.preventDefault()
      focusOption(0)
    } else if (event.key === 'ArrowUp' && filtered.length > 0) {
      event.preventDefault()
      focusOption(filtered.length - 1)
    }
  }
  const onCategoryKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    let next: number | undefined
    if (event.key === 'ArrowRight') next = (index + 1) % (visibleCategories.length + 1)
    else if (event.key === 'ArrowLeft')
      next = (index - 1 + visibleCategories.length + 1) % (visibleCategories.length + 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = visibleCategories.length
    else return
    event.preventDefault()
    setCategoryId(next === 0 ? ALL_CATEGORY : visibleCategories[next - 1]!.id)
    setActiveIndex(0)
    categoryRefs.current[next]?.focus()
  }
  const categoryLabel = (category: IrisIconPickerCategory) => {
    if (category.label) return category.label
    const key = `iconPicker.category.${category.id}`
    const translated = t(key)
    return translated === key
      ? category.id.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
      : translated
  }

  return (
    <div
      {...rest}
      role="group"
      aria-label={resolvedLabel}
      className={className}
      data-iris-icon-picker=""
      data-disabled={disabled ? 'true' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-sm, 12px)',
        padding: 'var(--iris-padding-md, 12px)',
        color: 'var(--iris-foreground)',
        background: 'var(--iris-surface)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        ...style,
      }}
    >
      <input
        ref={searchRef}
        id={searchId}
        type="search"
        value={query}
        placeholder={resolvedPlaceholder}
        aria-label={resolvedSearchLabel}
        aria-controls={listboxId}
        disabled={disabled}
        data-iris-icon-picker-search=""
        onChange={(event) => {
          setQuery(event.currentTarget.value)
          setActiveIndex(0)
        }}
        onKeyDown={onSearchKeyDown}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          minHeight: 36,
          padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
          color: 'inherit',
          background: 'var(--iris-background)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-sm, 4px)',
          font: 'inherit',
          opacity: disabled ? 0.6 : 1,
        }}
      />
      <div
        role="toolbar"
        tabIndex={-1}
        aria-label={t('iconPicker.categories')}
        data-iris-icon-picker-categories=""
        onKeyDown={(event) => {
          const target = event.target
          if (!(target instanceof HTMLButtonElement)) return
          const index = categoryRefs.current.indexOf(target)
          if (index >= 0) onCategoryKeyDown(event, index)
        }}
        style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBlock: 2 }}
      >
        <button
          ref={(node) => {
            categoryRefs.current[0] = node
          }}
          type="button"
          aria-controls={listboxId}
          aria-pressed={effectiveCategory === ALL_CATEGORY}
          tabIndex={effectiveCategory === ALL_CATEGORY ? 0 : -1}
          disabled={disabled}
          data-iris-icon-picker-category="all"
          onClick={() => {
            setCategoryId(ALL_CATEGORY)
            setActiveIndex(0)
          }}
          style={categoryButtonStyle(effectiveCategory === ALL_CATEGORY, disabled)}
        >
          {t('iconPicker.all')}
        </button>
        {visibleCategories.map((category, index) => {
          const selected = effectiveCategory === category.id
          return (
            <button
              key={category.id}
              ref={(node) => {
                categoryRefs.current[index + 1] = node
              }}
              type="button"
              aria-controls={listboxId}
              aria-pressed={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              data-iris-icon-picker-category={category.id}
              onClick={() => {
                setCategoryId(category.id)
                setActiveIndex(0)
              }}
              style={categoryButtonStyle(selected, disabled)}
            >
              {categoryLabel(category)}
            </button>
          )
        })}
      </div>
      <div
        id={listboxId}
        role="listbox"
        aria-label={resolvedLabel}
        aria-disabled={disabled ? 'true' : undefined}
        data-iris-icon-picker-grid=""
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          gap: 6,
          maxHeight: 280,
          overflowY: 'auto',
          padding: 2,
        }}
      >
        {filtered.length === 0 ? (
          <div
            role="status"
            data-iris-icon-picker-empty=""
            style={{
              gridColumn: '1 / -1',
              padding: 20,
              color: 'var(--iris-muted)',
              textAlign: 'center',
            }}
          >
            {resolvedEmptyText}
          </div>
        ) : (
          filtered.map(({ name, icon }, index) => {
            const selected = currentValue === name
            return (
              <button
                key={name}
                ref={(node) => {
                  optionRefs.current[index] = node
                }}
                type="button"
                role="option"
                aria-label={name}
                aria-selected={selected}
                tabIndex={index === active ? 0 : -1}
                disabled={disabled}
                data-iris-icon-picker-option={name}
                data-state={selected ? 'selected' : 'idle'}
                onFocus={() => setActiveIndex(index)}
                onClick={() => choose(name)}
                onKeyDown={(event) => onOptionKeyDown(event, index)}
                style={{
                  minWidth: 0,
                  minHeight: 64,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 4px',
                  color: 'inherit',
                  background: selected
                    ? 'var(--iris-surface-hover, var(--iris-background))'
                    : 'transparent',
                  border: `1px solid ${selected ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
                  borderRadius: 'var(--iris-radius-sm, 4px)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1,
                  font: 'inherit',
                }}
              >
                <IrisIcon name={name} registry={registry} size={22} />
                <span
                  style={{
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 'var(--iris-font-size-xs, 12px)',
                  }}
                >
                  {icon.name}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function categoryButtonStyle(selected: boolean, disabled: boolean): React.CSSProperties {
  return {
    flex: '0 0 auto',
    padding: '5px 10px',
    color: selected
      ? 'var(--iris-primary-foreground, var(--iris-background))'
      : 'var(--iris-foreground)',
    background: selected ? 'var(--iris-primary)' : 'transparent',
    border: `1px solid ${selected ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
    borderRadius: 'var(--iris-radius-full, 999px)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    font: 'inherit',
    fontSize: 'var(--iris-font-size-xs, 12px)',
    whiteSpace: 'nowrap',
  }
}
