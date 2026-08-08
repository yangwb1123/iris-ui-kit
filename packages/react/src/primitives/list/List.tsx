import * as React from 'react'
import {
  createSelectionModel,
  createKeyboardNav,
  type SelectionKey,
  type SelectionModel,
  type KeyboardNavController,
  type KeyboardNavAction,
} from '@iris-ui-kit/core'
import { useStore } from '../../useStore'
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
  fontSize: 'var(--iris-font-size-md, 14px)',
}

/**
 * Generic selectable list — foundation for `IrisSelect` content, dropdowns,
 * command palettes, etc. Implements the WAI-ARIA Listbox pattern:
 *
 *   - `role="listbox"` (with `aria-multiselectable` when `multi`)
 *   - Roving tabindex (one item has tabindex=0, others -1)
 *   - Arrow keys / Home / End move focus via `createKeyboardNav` (core)
 *   - Enter / Space (de)select
 *
 * Keyboard logic is single-sourced in `@iris-ui-kit/core` — this adapter only
 * bridges the returned actions to DOM focus and selection callbacks.
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
  ...rest
}: IrisListProps<T>): React.ReactElement {
  const safeItems = items ?? []
  // Item-selection logic (single set / multiple toggle, dedup,
  // controlled/uncontrolled) is single-sourced in the core model. List values
  // are generic `T`, while the model is keyed by string|number and only ever
  // compares keys by identity (Set/includes) — exactly the previous hand-rolled
  // behavior — so we bridge `T ⇄ key` at this edge (the cast is purely
  // structural; runtime is identical). Single mode never toggles off, so
  // `select` uses `model.set`, not `model.toggle`.
  const isControlled = valueProp !== undefined
  const asKey = (v: T): SelectionKey => v as unknown as SelectionKey
  const toKeys = (v: T | T[] | null | undefined): SelectionKey[] =>
    v == null ? [] : Array.isArray(v) ? (v as T[]).map(asKey) : [asKey(v as T)]
  const fromKeys = (keys: SelectionKey[]): T | T[] | null =>
    multi ? (keys as unknown as T[]) : ((keys[0] ?? null) as unknown as T | null)
  const modelRef = React.useRef<SelectionModel<SelectionKey> | null>(null)
  if (modelRef.current === null) {
    const initial: T | T[] | null = defaultValue !== undefined ? defaultValue : multi ? [] : null
    modelRef.current = createSelectionModel<SelectionKey>({
      mode: multi ? 'multiple' : 'single',
      defaultSelected: toKeys(isControlled ? valueProp : initial),
      onChange: (keys) => onValueChange?.(fromKeys(keys)),
    })
  }
  const model = modelRef.current
  const selectedKeys = useStore(model.store)

  // Controlled: mirror the prop into the model without re-emitting onChange.
  React.useEffect(() => {
    if (isControlled) model.sync(toKeys(valueProp))
  }, [valueProp, isControlled, model])

  // Controlled lists RENDER from the prop (true controlled semantics): a click
  // emits onChange but the highlighted selection only changes when the parent
  // writes `value` back; uncontrolled renders from the model store.
  const displaySelectedKeys = isControlled ? toKeys(valueProp) : selectedKeys
  const rebaseToProp = (): void => {
    if (isControlled) model.sync(toKeys(valueProp))
  }

  const { t } = useI18n()
  const { state, isContent, stateKey, stateProps } = useDataState({
    loading,
    error,
    empty: safeItems.length === 0,
  })

  const isSelected = React.useCallback(
    (v: T): boolean => displaySelectedKeys.includes(v as unknown as SelectionKey),
    [displaySelectedKeys],
  )

  // ── Keyboard navigation (single-sourced in core controller) ────────────
  const isEnabled = React.useCallback((i: number) => !safeItems[i]?.disabled, [safeItems])

  // Stable ref to capture the latest items/select for the controller's action handler
  const ctxRef = React.useRef({
    items: safeItems,
    multi,
    loop,
    isControlled,
    valueProp,
    model,
    onSelect,
    asKey,
  })

  const navRef = React.useRef<KeyboardNavController | null>(null)
  if (navRef.current === null) {
    navRef.current = createKeyboardNav({
      count: safeItems.length,
      loop,
      isEnabled,
    })
  }
  const nav = navRef.current

  // Reset nav when item count or enabled state changes
  React.useEffect(() => {
    nav.reset(safeItems.length)
  })

  // Keep the context ref current for the action handler below
  ctxRef.current = {
    items: safeItems,
    multi,
    loop,
    isControlled,
    valueProp,
    model,
    onSelect,
    asKey,
  }

  const activeIndex = useStore(nav.store)
  const [hoveredIndex, setHoveredIndex] = React.useState(-1)
  const listRef = React.useRef<HTMLUListElement | null>(null)

  const focusAt = (index: number) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-iris-list-index="${index}"]`)
    el?.focus()
  }

  const select = (item: IrisListItem<T>) => {
    if (item.disabled) return
    rebaseToProp()
    if (multi) model.toggle(ctxRef.current.asKey(item.value))
    else model.set([ctxRef.current.asKey(item.value)])
    onSelect?.(item)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (!isContent) return
    const action: KeyboardNavAction = nav.handleKeyDown({
      key: e.key,
      preventDefault: () => e.preventDefault(),
    })
    switch (action.type) {
      case 'focus':
        focusAt(action.target)
        break
      case 'select': {
        const item = safeItems[action.target]
        if (item) select(item)
        break
      }
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
      {...rest}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 'var(--iris-padding-sm, 4px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xxs, 4px)',
        outline: 'none',
        maxHeight: 240,
        overflowY: 'auto',
        ...style,
      }}
    >
      {isContent ? (
        safeItems.map((item, index) => {
          const selected = isSelected(item.value)
          const active = index === activeIndex
          const baseStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iris-gap-sm, 6px)',
            padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            opacity: item.disabled ? 0.5 : 1,
            fontSize: 'var(--iris-font-size-md, 14px)',
            background: selected
              ? 'var(--iris-primary)'
              : hoveredIndex === index
                ? 'var(--iris-surface-hover)'
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
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex((current) => (current === index ? -1 : current))}
              onClick={item.disabled ? undefined : () => select(item)}
              onFocus={() => nav.focus(index)}
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
