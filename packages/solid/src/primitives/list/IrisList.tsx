import { createSignal, For, mergeProps, Show, splitProps, type JSX } from 'solid-js'

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

  const enabledIndices = () =>
    local.items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i !== -1)

  const [internalValue, setInternalValue] = createSignal<T | T[] | undefined>(local.defaultValue)
  const [activeIndex, setActiveIndex] = createSignal<number>(enabledIndices()[0] ?? -1)

  const isControlled = () => local.value !== undefined
  const currentValue = () => (isControlled() ? local.value : internalValue())

  const isSelected = (value: T): boolean => {
    const cv = currentValue()
    if (local.multi) {
      return Array.isArray(cv) && (cv as T[]).includes(value)
    }
    return cv === value
  }

  const select = (item: IrisListItem<T>) => {
    if (item.disabled) return
    let next: T | T[]
    if (local.multi) {
      const arr: T[] = Array.isArray(currentValue()) ? [...(currentValue() as T[])] : []
      const idx = arr.indexOf(item.value)
      if (idx >= 0) arr.splice(idx, 1)
      else arr.push(item.value)
      next = arr
    } else {
      next = item.value
    }
    if (!isControlled()) setInternalValue(() => next as T | T[])
    local.onChange?.(next)
  }

  const moveActive = (delta: 1 | -1) => {
    const enabled = enabledIndices()
    if (enabled.length === 0) return
    let pos = enabled.indexOf(activeIndex())
    if (pos === -1) pos = delta > 0 ? -1 : enabled.length
    let next = pos + delta
    if (next < 0) next = local.loop ? enabled.length - 1 : 0
    else if (next >= enabled.length) next = local.loop ? 0 : enabled.length - 1
    setActiveIndex(enabled[next]!)
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
        const first = enabledIndices()[0] ?? -1
        if (first >= 0) setActiveIndex(first)
        break
      }
      case 'End': {
        e.preventDefault()
        const last = enabledIndices()[enabledIndices().length - 1] ?? -1
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
