import * as React from 'react'
import { useI18n } from '../../i18n'
import { useDataState } from '../../motion'

export interface IrisListItem<T = unknown> {
  value: T
  label?: string
  disabled?: boolean
}

export interface IrisListProps<T = unknown> {
  items: IrisListItem<T>[]
  /** Selected value(s). For multi mode, pass an array. */
  value?: T | T[] | null
  defaultValue?: T | T[] | null
  onValueChange?: (next: T | T[] | null) => void
  onSelect?: (item: IrisListItem<T>) => void
  multi?: boolean
  /** Loop arrow nav at boundaries. Default true. */
  loop?: boolean
  ariaLabel?: string
  /** Show the loading state instead of items. */
  loading?: boolean
  /** Show the error state instead of items (takes precedence over loading). */
  error?: boolean
  /** Custom empty-state node (defaults to the localized `list.empty`). */
  emptyState?: React.ReactNode
  /** Custom loading-state node (defaults to the localized `list.loading`). */
  loadingState?: React.ReactNode
  /** Custom error-state node (defaults to the localized `list.error`). */
  errorState?: React.ReactNode
  /** Custom render per item. */
  renderItem?: (
    item: IrisListItem<T>,
    state: { selected: boolean; active: boolean; index: number },
  ) => React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const LIST_STATE_STYLE: React.CSSProperties = {
  listStyle: 'none',
  padding: '12px',
  textAlign: 'center',
  color: 'var(--iris-muted)',
  fontSize: 14,
}

/**
 * Generic selectable list — foundation for `IrisSelect` content, dropdowns,
 * command palettes, etc. Implements the WAI-ARIA Listbox pattern:
 *
 *   - `role="listbox"` (with `aria-multiselectable` when `multi`)
 *   - Roving tabindex (one item has tabindex=0, others -1)
 *   - Arrow keys / Home / End move focus
 *   - Enter / Space (de)select
 *
 * Async lifecycle: pass `loading` / `error` (and an empty `items`) to render
 * the animated loading / error / empty state in place of options. State
 * precedence and entry animation come from {@link useDataState}.
 */
export function IrisList<T = unknown>({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  onSelect,
  multi = false,
  loop = true,
  ariaLabel,
  loading = false,
  error = false,
  emptyState,
  loadingState,
  errorState,
  renderItem,
  style,
  className,
}: IrisListProps<T>): React.ReactElement {
  const isControlled = valueProp !== undefined
  const initial: T | T[] | null = defaultValue !== undefined ? defaultValue : multi ? [] : null
  const [internal, setInternal] = React.useState<T | T[] | null>(initial)
  const value = isControlled ? (valueProp as T | T[] | null) : internal

  const { t } = useI18n()
  const { state, isContent, stateKey, stateProps } = useDataState({
    loading,
    error,
    empty: items.length === 0,
  })

  const isSelected = React.useCallback(
    (v: T): boolean => {
      if (value == null) return false
      if (Array.isArray(value)) return (value as T[]).includes(v)
      return value === v
    },
    [value],
  )

  const enabledIndexes = React.useMemo(
    () => items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i !== -1),
    [items],
  )
  const [activeIndex, setActiveIndex] = React.useState<number>(enabledIndexes[0] ?? -1)

  React.useEffect(() => {
    if (activeIndex < 0 || activeIndex >= items.length || items[activeIndex]?.disabled) {
      setActiveIndex(enabledIndexes[0] ?? -1)
    }
  }, [items, activeIndex, enabledIndexes])

  const listRef = React.useRef<HTMLUListElement | null>(null)

  const setValue = (next: T | T[] | null) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  const select = (item: IrisListItem<T>) => {
    if (item.disabled) return
    if (multi) {
      const arr = Array.isArray(value) ? (value as T[]) : []
      const idx = arr.indexOf(item.value)
      const next = idx >= 0 ? arr.filter((v) => v !== item.value) : [...arr, item.value]
      setValue(next)
    } else {
      setValue(item.value)
    }
    onSelect?.(item)
  }

  const focusAt = (index: number) => {
    setActiveIndex(index)
    const el = listRef.current?.querySelector<HTMLElement>(`[data-iris-list-index="${index}"]`)
    el?.focus()
  }

  const moveActive = (delta: 1 | -1) => {
    if (enabledIndexes.length === 0) return
    let pos = enabledIndexes.indexOf(activeIndex)
    if (pos === -1) pos = delta > 0 ? -1 : enabledIndexes.length
    let next = pos + delta
    if (next < 0) next = loop ? enabledIndexes.length - 1 : 0
    if (next >= enabledIndexes.length) next = loop ? 0 : enabledIndexes.length - 1
    focusAt(enabledIndexes[next]!)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (!isContent) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveActive(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveActive(-1)
        break
      case 'Home': {
        e.preventDefault()
        const first = enabledIndexes[0]
        if (first !== undefined) focusAt(first)
        break
      }
      case 'End': {
        e.preventDefault()
        const last = enabledIndexes[enabledIndexes.length - 1]
        if (last !== undefined) focusAt(last)
        break
      }
      case 'Enter':
      case ' ':
        if (activeIndex >= 0) {
          e.preventDefault()
          const it = items[activeIndex]
          if (it) select(it)
        }
        break
    }
  }

  const stateNode =
    state === 'error'
      ? (errorState ?? t('list.error'))
      : state === 'loading'
        ? (loadingState ?? t('list.loading'))
        : (emptyState ?? t('list.empty'))

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label={ariaLabel}
      aria-multiselectable={multi ? true : undefined}
      aria-busy={state === 'loading' ? true : undefined}
      data-iris-list=""
      className={className}
      onKeyDown={onKeyDown}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 'var(--iris-padding-sm, 4px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        outline: 'none',
        ...style,
      }}
    >
      {isContent ? (
        items.map((item, index) => {
          const selected = isSelected(item.value)
          const active = index === activeIndex
          const baseStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iris-gap-sm, 6px)',
            padding: '6px var(--iris-padding-md, 12px)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            opacity: item.disabled ? 0.5 : 1,
            fontSize: 14,
            background: selected
              ? 'var(--iris-primary)'
              : active
                ? 'var(--iris-surface-hover)'
                : 'transparent',
            color: selected ? 'var(--iris-primary-foreground, #fff)' : 'var(--iris-foreground)',
            outline: 'none',
          }
          return (
            <li
              key={String(item.value ?? index)}
              role="option"
              tabIndex={active ? 0 : -1}
              aria-selected={selected}
              aria-disabled={item.disabled ? 'true' : undefined}
              data-iris-list-index={index}
              data-iris-list-item=""
              data-state={selected ? 'selected' : active ? 'active' : 'idle'}
              onClick={item.disabled ? undefined : () => select(item)}
              onFocus={() => setActiveIndex(index)}
              style={baseStyle}
            >
              {renderItem
                ? renderItem(item, { selected, active, index })
                : (item.label ?? String(item.value))}
            </li>
          )
        })
      ) : (
        <li
          key={stateKey}
          role="presentation"
          data-iris-list-state={state}
          aria-live="polite"
          {...stateProps}
          style={LIST_STATE_STYLE}
        >
          {stateNode}
        </li>
      )}
    </ul>
  )
}
