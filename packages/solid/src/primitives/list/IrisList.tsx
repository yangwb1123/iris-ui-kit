import { createEffect, createSignal, For, mergeProps, Show, splitProps, type JSX } from 'solid-js'
import {
  createSelectionModel,
  firstEnabledIndex,
  lastEnabledIndex,
  nextEnabledIndex,
} from '@iris-ui/core'
import { useStore } from '../../useStore'

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
  /** Selected value(s). For multi mode, pass an array. */
  value?: T | T[]
  /** Default selected value(s) for uncontrolled mode. */
  defaultValue?: T | T[]
  /** Allow multi-select. */
  multi?: boolean
  /** Loop ArrowDown past the last item back to the first. */
  loop?: boolean
  /** ARIA label. */
  ariaLabel?: string
  /** Render prop for custom item content. */
  renderItem?: (item: IrisListItem<T>, selected: boolean) => JSX.Element
  onChange?: (value: T | T[]) => void
}

/**
 * Generic selectable list. Implements the WAI-ARIA Listbox pattern:
 * role="listbox", roving tabindex, arrow-key navigation, Enter/Space to select.
 */
export function IrisList<T = unknown>(props: IrisListProps<T>): JSX.Element {
  const merged = mergeProps({ items: [] as IrisListItem<T>[], multi: false, loop: true }, props)
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
  ])

  const isEnabled = (i: number): boolean => !local.items[i]?.disabled

  const [activeIndex, setActiveIndex] = createSignal<number>(
    firstEnabledIndex(local.items.length, isEnabled),
  )

  // Selection logic (single/multiple toggle, dedup) is single-sourced in the core
  // model. List values are an opaque generic `T`, so they're used directly as
  // model keys — the model compares by identity (`includes`/`Set`), matching the
  // component's previous `===`/`indexOf` semantics for any value type.
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

  // Controlled: mirror the prop into the model without re-emitting onChange.
  createEffect(() => {
    if (local.value !== undefined) model.sync(toKeys(local.value))
  })

  const isSelected = (value: T): boolean => selected().includes(asKey(value))

  const select = (item: IrisListItem<T>) => {
    if (item.disabled) return
    // multiple: toggle; single: always select (list never deselects on re-click).
    if (local.multi) model.toggle(asKey(item.value))
    else model.set([asKey(item.value)])
  }

  const moveActive = (delta: 1 | -1) => {
    const next = nextEnabledIndex(activeIndex(), delta, local.items.length, isEnabled, local.loop)
    if (next >= 0) setActiveIndex(next)
  }

  const onKeyDown: JSX.EventHandlerUnion<HTMLUListElement, KeyboardEvent> = (e) => {
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
        const first = firstEnabledIndex(local.items.length, isEnabled)
        if (first >= 0) setActiveIndex(first)
        break
      }
      case 'End': {
        e.preventDefault()
        const last = lastEnabledIndex(local.items.length, isEnabled)
        if (last >= 0) setActiveIndex(last)
        break
      }
      case 'Enter':
      case ' ': {
        if (activeIndex() >= 0) {
          e.preventDefault()
          const item = local.items[activeIndex()]
          if (item) select(item)
        }
        break
      }
    }
  }

  return (
    <ul
      {...rest}
      role="listbox"
      aria-label={local.ariaLabel}
      aria-multiselectable={local.multi ? 'true' : undefined}
      data-iris-list=""
      onKeyDown={onKeyDown}
      style={{
        'list-style': 'none',
        margin: '0',
        padding: 'var(--iris-padding-sm, 4px)',
        display: 'flex',
        'flex-direction': 'column',
        gap: '2px',
        outline: 'none',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
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
                  setActiveIndex(i)
                  select(item)
                }
              }}
              onFocus={() => setActiveIndex(i)}
              style={{
                display: 'flex',
                'align-items': 'center',
                gap: 'var(--iris-gap-sm, 6px)',
                padding: '6px var(--iris-padding-md, 12px)',
                'border-radius': 'var(--iris-radius-sm, 4px)',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? '0.5' : '1',
                'font-size': '14px',
                background: selected()
                  ? 'var(--iris-primary)'
                  : active()
                    ? 'var(--iris-surface-hover)'
                    : 'transparent',
                color: selected() ? 'var(--iris-primary-foreground)' : 'var(--iris-foreground)',
                outline: 'none',
              }}
            >
              <Show when={local.renderItem} fallback={<>{item.label ?? String(item.value)}</>}>
                {local.renderItem!(item, selected())}
              </Show>
            </li>
          )
        }}
      </For>
    </ul>
  )
}
