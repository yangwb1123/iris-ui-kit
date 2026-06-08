import {
  createSignal,
  createMemo,
  createEffect,
  mergeProps,
  splitProps,
  Show,
  For,
  onCleanup,
  type JSX,
} from 'solid-js'
import { type IrisCommandItem, defaultFilter } from './types'

export interface IrisCommandPaletteProps {
  open?: boolean
  defaultOpen?: boolean
  items?: IrisCommandItem[]
  placeholder?: string
  emptyText?: string
  onOpenChange?: (open: boolean) => void
  onSelect?: (item: IrisCommandItem) => void
}

/**
 * Command palette: modal search dialog with grouped results + keyboard navigation.
 * Solid port of the Vue IrisCommandPalette.
 */
export function IrisCommandPalette(props: IrisCommandPaletteProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultOpen: false,
      items: [] as IrisCommandItem[],
      placeholder: 'Type a command or search…',
      emptyText: 'No results found.',
    },
    props,
  )
  const [local] = splitProps(merged, [
    'open',
    'defaultOpen',
    'items',
    'placeholder',
    'emptyText',
    'onOpenChange',
    'onSelect',
  ])

  const [internalOpen, setInternalOpen] = createSignal(local.defaultOpen)
  const [query, setQuery] = createSignal('')
  const [activeIdx, setActiveIdx] = createSignal(0)

  const open = () => (local.open !== undefined ? local.open : internalOpen())
  const setOpen = (v: boolean) => {
    if (local.open === undefined) setInternalOpen(v)
    local.onOpenChange?.(v)
  }

  const filtered = createMemo(() => {
    const q = query()
    const results = local.items
      .map((item) => ({ item, score: defaultFilter(q, item) }))
      .filter((r) => r.score !== null)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    return results.map((r) => r.item)
  })

  // Group the filtered items
  const grouped = createMemo(() => {
    const groups = new Map<string, IrisCommandItem[]>()
    for (const item of filtered()) {
      const key = item.group ?? ''
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }
    return Array.from(groups.entries())
  })

  const flatItems = createMemo(() => filtered())

  const select = (item: IrisCommandItem) => {
    if (item.disabled) return
    item.action?.()
    local.onSelect?.(item)
    setOpen(false)
    setQuery('')
  }

  // Reset active idx when filtered changes
  createEffect(() => {
    filtered()
    setActiveIdx(0)
  })

  // Global keyboard shortcut: Cmd/Ctrl+K to open
  const onDocKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      setOpen(!open())
      if (!open()) setQuery('')
    }
    if (e.key === 'Escape' && open()) {
      e.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  document.addEventListener('keydown', onDocKeyDown)
  onCleanup(() => document.removeEventListener('keydown', onDocKeyDown))

  const onInputKeyDown = (e: KeyboardEvent) => {
    const items = flatItems()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[activeIdx()]
      if (item) select(item)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <Show when={open()}>
      <div
        data-iris-command-palette=""
        data-state="open"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{
          position: 'fixed',
          inset: '0',
          display: 'flex',
          'align-items': 'flex-start',
          'justify-content': 'center',
          'padding-top': '15vh',
          background: 'rgba(0,0,0,0.4)',
          'z-index': '1000',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setOpen(false)
            setQuery('')
          }
        }}
      >
        <div
          data-iris-command-palette-panel=""
          style={{
            width: '100%',
            'max-width': '560px',
            background: 'var(--iris-surface)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-lg, 8px)',
            'box-shadow': '0 8px 32px rgba(0,0,0,0.18)',
            overflow: 'hidden',
          }}
        >
          {/* Search input */}
          <div style={{ padding: '12px', 'border-bottom': '1px solid var(--iris-border)' }}>
            <input
              type="text"
              data-iris-command-palette-input=""
              placeholder={local.placeholder}
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={onInputKeyDown}
              autofocus
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                'font-size': '16px',
                color: 'var(--iris-foreground)',
                'font-family': 'inherit',
              }}
            />
          </div>

          {/* Results */}
          <div
            data-iris-command-palette-results=""
            role="listbox"
            style={{
              'max-height': '320px',
              'overflow-y': 'auto',
              padding: '4px',
            }}
          >
            <Show
              when={flatItems().length > 0}
              fallback={
                <div
                  style={{
                    padding: '20px',
                    'text-align': 'center',
                    color: 'var(--iris-muted)',
                    'font-size': '14px',
                  }}
                >
                  {local.emptyText}
                </div>
              }
            >
              <For each={grouped()}>
                {([group, items]) => (
                  <div data-iris-command-palette-group="">
                    <Show when={group}>
                      <div
                        style={{
                          padding: '6px 8px 2px',
                          'font-size': '11px',
                          'font-weight': '600',
                          color: 'var(--iris-muted)',
                          'text-transform': 'uppercase',
                          'letter-spacing': '0.05em',
                        }}
                      >
                        {group}
                      </div>
                    </Show>
                    <For each={items}>
                      {(item) => {
                        const isActive = () =>
                          flatItems().indexOf(item) === activeIdx() && !item.disabled

                        return (
                          <div
                            role="option"
                            aria-selected={isActive()}
                            aria-disabled={item.disabled ? 'true' : undefined}
                            data-iris-command-palette-item={item.id}
                            data-active={isActive() ? 'true' : undefined}
                            onClick={() => select(item)}
                            onMouseEnter={() => setActiveIdx(flatItems().indexOf(item))}
                            style={{
                              display: 'flex',
                              'align-items': 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              'border-radius': 'var(--iris-radius-sm, 4px)',
                              background: isActive() ? 'var(--iris-primary)' : 'transparent',
                              color: isActive()
                                ? 'var(--iris-primary-foreground, #fff)'
                                : item.disabled
                                  ? 'var(--iris-muted)'
                                  : 'var(--iris-foreground)',
                              cursor: item.disabled ? 'not-allowed' : 'pointer',
                              opacity: item.disabled ? '0.5' : '1',
                              'font-size': '14px',
                            }}
                          >
                            <Show when={item.icon}>
                              <span aria-hidden="true" style={{ 'font-size': '16px' }}>
                                {item.icon}
                              </span>
                            </Show>
                            <span style={{ flex: '1' }}>{item.label}</span>
                            <Show when={item.shortcut}>
                              <kbd
                                style={{
                                  'font-size': '11px',
                                  padding: '2px 4px',
                                  background: 'rgba(0,0,0,0.1)',
                                  'border-radius': '3px',
                                  opacity: '0.7',
                                }}
                              >
                                {item.shortcut}
                              </kbd>
                            </Show>
                          </div>
                        )
                      }}
                    </For>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}
