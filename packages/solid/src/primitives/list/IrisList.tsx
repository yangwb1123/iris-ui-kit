import { createEffect, For, mergeProps, Show, splitProps, type JSX } from 'solid-js'
import { createSelectionModel, createKeyboardNav, type KeyboardNavAction } from '@iris-ui-kit/core'
import { useStore } from '../../useStore'
import { useI18n } from '../../i18n'
import { useDataState } from '../../motion'

export interface IrisListItem<T = unknown> {
  value: T
  label?: string
  disabled?: boolean
}

export interface IrisListProps<T = unknown> extends Omit<
  JSX.HTMLAttributes<HTMLUListElement>,
  'onSelect' | 'onChange'
> {
  items: IrisListItem<T>[]
  value?: T | T[]
  defaultValue?: T | T[]
  multi?: boolean
  loop?: boolean
  ariaLabel?: string
  renderItem?: (item: IrisListItem<T>, selected: boolean) => JSX.Element
  onChange?: (value: T | T[]) => void
  loading?: boolean
  error?: boolean
  emptyState?: JSX.Element
  loadingState?: JSX.Element
  errorState?: JSX.Element
}

/**
 * Generic selectable list. Implements the WAI-ARIA Listbox pattern:
 * role="listbox", roving tabindex, arrow-key navigation, Enter/Space to select.
 * Keyboard logic is single-sourced in `createKeyboardNav` (core).
 */
export function IrisList<T = unknown>(props: IrisListProps<T>): JSX.Element {
  const merged = mergeProps(
    { items: [] as IrisListItem<T>[], multi: false, loop: true, loading: false, error: false },
    props,
  )
  const [local, rest] = splitProps(merged as typeof merged & { style?: JSX.CSSProperties }, [
    'items',
    'value',
    'defaultValue',
    'multi',
    'loop',
    'ariaLabel',
    'renderItem',
    'onChange',
    'style',
    'loading',
    'error',
    'emptyState',
    'loadingState',
    'errorState',
  ])

  const { t } = useI18n()
  const { state, isContent, stateProps } = useDataState(() => ({
    loading: local.loading,
    error: local.error,
    empty: local.items.length === 0,
  }))

  const isEnabled = (i: number): boolean => !local.items[i]?.disabled

  // Keyboard navigation (single-sourced in core controller)
  let listRef: HTMLUListElement | undefined

  type Key = string | number
  const asKey = (v: T): Key => v as unknown as Key
  const toKeys = (v: T | T[] | undefined): Key[] =>
    v === undefined ? [] : (Array.isArray(v) ? (v as T[]) : [v]).map(asKey)

  const model = createSelectionModel<Key>({
    mode: local.multi ? 'multiple' : 'single',
    defaultSelected: toKeys(local.value !== undefined ? local.value : local.defaultValue),
    onChange: (keys) =>
      local.onChange?.(local.multi ? (keys as unknown as T[]) : (keys[0] as unknown as T)),
  })
  const selected = useStore(model.store)

  const isControlled = (): boolean => local.value !== undefined
  createEffect(() => {
    if (isControlled()) model.sync(toKeys(local.value))
  })

  const displaySelectedKeys = (): Key[] => (isControlled() ? toKeys(local.value) : selected())
  const rebaseToProp = (): void => {
    if (isControlled()) model.sync(toKeys(local.value))
  }

  const isSelected = (value: T): boolean => displaySelectedKeys().includes(asKey(value))

  const select = (item: IrisListItem<T>) => {
    if (item.disabled) return
    rebaseToProp()
    if (local.multi) model.toggle(asKey(item.value))
    else model.set([asKey(item.value)])
  }

  // Create nav controller — it manages the active index via its own store.
  const nav = createKeyboardNav({
    count: local.items.length,
    loop: local.loop,
    isEnabled,
  })
  const activeIndex = useStore(nav.store)

  // Keep controller in sync when items change
  createEffect(() => {
    nav.reset(local.items.length)
  })

  const focusAt = (index: number) => {
    const el = listRef?.querySelector<HTMLElement>(`[data-iris-list-index="${index}"]`)
    el?.focus()
  }

  const onKeyDown: JSX.EventHandlerUnion<HTMLUListElement, KeyboardEvent> = (e) => {
    if (!isContent()) return
    const action: KeyboardNavAction = nav.handleKeyDown({
      key: e.key,
      preventDefault: () => e.preventDefault(),
    })
    if (action.type === 'focus' || action.type === 'typeahead') {
      focusAt(action.target)
    } else if (action.type === 'select') {
      const item = local.items[action.target]
      if (item) select(item)
    }
  }

  return (
    <ul
      {...rest}
      ref={listRef!}
      role="listbox"
      aria-label={local.ariaLabel}
      aria-multiselectable={local.multi ? 'true' : undefined}
      aria-busy={state() === 'loading' ? 'true' : undefined}
      data-iris-list=""
      onKeyDown={onKeyDown}
      style={{
        'list-style': 'none',
        margin: '0',
        padding: 'var(--iris-padding-sm, 4px)',
        display: 'flex',
        'flex-direction': 'column',
        gap: 'var(--iris-space-xxs, 4px)',
        outline: 'none',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <Show
        when={isContent()}
        fallback={
          <li
            role="presentation"
            data-iris-list-state={state()}
            aria-live="polite"
            {...stateProps()}
            style={{
              'list-style': 'none',
              padding: '12px',
              'text-align': 'center',
              color: 'var(--iris-muted)',
              'font-size': 'var(--iris-font-size-md, 14px)',
            }}
          >
            {state() === 'error'
              ? (local.errorState ?? t('list.error'))
              : state() === 'loading'
                ? (local.loadingState ?? t('list.loading'))
                : (local.emptyState ?? t('list.empty'))}
          </li>
        }
      >
        <For each={local.items}>
          {(item, index) => {
            const i = index()
            const selected = () => isSelected(item.value)
            const active = () => i === activeIndex()

            return (
              <li
                role="option"
                tabIndex={active() ? 0 : -1}
                aria-selected={selected() ? 'true' : 'false'}
                aria-disabled={item.disabled ? 'true' : undefined}
                data-iris-list-index={i}
                data-iris-list-item=""
                data-state={selected() ? 'selected' : active() ? 'active' : 'idle'}
                onClick={() => {
                  if (!item.disabled) {
                    nav.focus(i)
                    select(item)
                  }
                }}
                onFocus={() => nav.focus(i)}
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: 'var(--iris-gap-sm, 6px)',
                  padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? '0.5' : '1',
                  'font-size': 'var(--iris-font-size-md, 14px)',
                  background: selected()
                    ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
                    : active()
                      ? 'var(--iris-surface-hover)'
                      : 'transparent',
                  color: 'var(--iris-foreground)',
                  'font-weight': selected() ? '600' : '400',
                  outline: 'none',
                }}
              >
                <span style={{ flex: '1', 'min-width': '0' }}>
                  <Show when={local.renderItem} fallback={<>{item.label ?? String(item.value)}</>}>
                    {local.renderItem!(item, selected())}
                  </Show>
                </span>
                <Show when={selected()}>
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--iris-primary)"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </Show>
              </li>
            )
          }}
        </For>
      </Show>
    </ul>
  )
}
