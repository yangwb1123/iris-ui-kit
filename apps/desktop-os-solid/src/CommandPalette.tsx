import { For, Show, createEffect, createMemo, createSignal, type JSX } from 'solid-js'
import { type Command, type CommandHit } from '@iris-ui-kit/core/commands'
import { useCommands, useCommandSearch } from './commands'

/**
 * ⌘K / Ctrl+K command palette — a centered, token-skinned overlay that fuzzy-
 * searches the shared command registry and runs the chosen command. ↑/↓ move the
 * selection, Enter runs it (then closes), Esc + click-outside close. The Solid
 * port of the React palette over the SAME `@iris-ui-kit/core/commands` registry.
 */
export function CommandPalette(props: { open: boolean; onClose: () => void }): JSX.Element {
  const registry = useCommands()
  const [query, setQuery] = createSignal('')
  const [active, setActive] = createSignal(0)
  let inputRef: HTMLInputElement | undefined

  // Reset query/selection + focus the input each time the palette opens.
  createEffect(() => {
    if (!props.open) return
    setQuery('')
    setActive(0)
    const r = requestAnimationFrame(() => inputRef?.focus())
    return () => cancelAnimationFrame(r)
  })

  const hits = useCommandSearch(query)
  // Clamp the selection into range whenever the result set shrinks.
  const selectedIndex = createMemo(() =>
    hits().length === 0 ? -1 : Math.min(active(), hits().length - 1),
  )

  const run = (command: Command): void => {
    void registry.run(command.id)
    props.onClose()
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, hits().length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = hits()[selectedIndex()]
      if (hit) run(hit.command)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      props.onClose()
    }
  }

  // Group hits in best-score order, preserving first-seen group order.
  const groups = createMemo(() => {
    const out: { group: string; hits: CommandHit[] }[] = []
    for (const hit of hits()) {
      const group = hit.command.group ?? 'Commands'
      const bucket = out.find((g) => g.group === group)
      if (bucket) bucket.hits.push(hit)
      else out.push({ group, hits: [hit] })
    }
    return out
  })

  return (
    <Show when={props.open}>
      <div
        onPointerDown={props.onClose}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          'justify-content': 'center',
          'align-items': 'flex-start',
          'padding-top': '16vh',
          background: 'rgba(0,0,0,0.18)',
          'z-index': 100001,
        }}
      >
        <div
          role="dialog"
          aria-label="Command palette"
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: 'min(620px, 92vw)',
            'max-height': '64vh',
            display: 'flex',
            'flex-direction': 'column',
            'border-radius': 'var(--os-window-radius)',
            overflow: 'hidden',
            background: 'var(--os-window-bg)',
            color: 'var(--os-window-fg)',
            border: 'var(--os-window-border)',
            'box-shadow': 'var(--os-window-shadow)',
            'backdrop-filter': 'var(--os-blur)',
            '-webkit-backdrop-filter': 'var(--os-blur)',
          }}
        >
          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              gap: '10px',
              padding: '12px 16px',
              'border-bottom': '1px solid rgba(127,127,127,0.2)',
            }}
          >
            <span style={{ 'font-size': '18px', opacity: 0.6 }}>⌘</span>
            <input
              ref={inputRef}
              value={query()}
              onInput={(e) => {
                setQuery(e.currentTarget.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="Type a command…"
              aria-label="Search commands"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'inherit',
                'font-size': '18px',
              }}
            />
          </div>

          <div style={{ overflow: 'auto', padding: '6px 0' }}>
            <For each={groups()}>
              {(bucket) => (
                <div>
                  <div
                    style={{
                      padding: '8px 16px 4px',
                      'font-size': '11px',
                      'font-weight': 700,
                      'letter-spacing': '0.4px',
                      'text-transform': 'uppercase',
                      opacity: 0.45,
                    }}
                  >
                    {bucket.group}
                  </div>
                  <For each={bucket.hits}>
                    {(hit) => {
                      const flat = createMemo(() => hits().indexOf(hit))
                      const isActive = createMemo(() => flat() === selectedIndex())
                      return (
                        <button
                          type="button"
                          onClick={() => run(hit.command)}
                          onPointerEnter={() => setActive(flat())}
                          style={{
                            display: 'flex',
                            'align-items': 'center',
                            gap: '12px',
                            width: '100%',
                            padding: '9px 16px',
                            border: 'none',
                            background: isActive()
                              ? 'color-mix(in srgb, var(--os-accent) 22%, transparent)'
                              : 'transparent',
                            color: 'inherit',
                            cursor: 'pointer',
                            'text-align': 'left',
                            'font-size': '15px',
                          }}
                        >
                          <span
                            style={{ width: '22px', 'text-align': 'center', 'font-size': '16px' }}
                          >
                            {hit.command.icon ?? '•'}
                          </span>
                          <span style={{ flex: 1 }}>{hit.command.title}</span>
                        </button>
                      )
                    }}
                  </For>
                </div>
              )}
            </For>
            <Show when={hits().length === 0}>
              <div style={{ padding: '16px', opacity: 0.6, 'font-size': '14px' }}>
                No commands found.
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}
