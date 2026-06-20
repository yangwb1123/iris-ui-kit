import { For, Show, createEffect, createMemo, createSignal, type JSX } from 'solid-js'
import { type AppManifest } from './catalog'
import { useApps, useLaunchApp } from './profile'
import { useCommands, useCommandSearch } from './commands'

/** One selectable result — either an app (launch) or a registry command (run). */
type Result =
  | { kind: 'app'; id: string; name: string; icon: string; sub: string; app: AppManifest }
  | { kind: 'command'; id: string; name: string; icon: string; sub: string }

/**
 * macOS Spotlight: a centered search overlay over BOTH apps and the command
 * registry (reusing {@link useApps} + {@link useCommandSearch}). Type to filter,
 * ↑/↓ to move, Enter/click to open/run, with a live preview of the selection.
 * Mirrors the React shell's Spotlight; the launcher when `chrome.launcher ===
 * 'spotlight'`.
 */
export function Spotlight(props: { open: boolean; onClose: () => void }): JSX.Element {
  const apps = useApps()
  const launchApp = useLaunchApp()
  const registry = useCommands()
  const [query, setQuery] = createSignal('')
  const [active, setActive] = createSignal(0)
  // Drives the scale/opacity entrance; flipped on after open so CSS transitions in.
  const [shown, setShown] = createSignal(false)
  let inputRef: HTMLInputElement | undefined

  // Reset + focus + animate-in on open; tear the entrance down on close.
  createEffect(() => {
    if (props.open) {
      setQuery('')
      setActive(0)
      // Focus once the overlay is in the DOM.
      queueMicrotask(() => inputRef?.focus())
      const r = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    return undefined
  })

  const commandHits = useCommandSearch(query)

  const results = createMemo<Result[]>(() => {
    const q = query().trim().toLowerCase()
    const appResults: Result[] = (
      q ? apps().filter((a) => a.name.toLowerCase().includes(q)) : apps()
    ).map((a) => ({
      kind: 'app',
      id: a.id,
      name: a.name,
      icon: a.icon,
      sub: 'Application',
      app: a,
    }))
    // Surface registry commands only once the user types (apps lead the list).
    const commandResults: Result[] = q
      ? commandHits()
          .slice(0, 6)
          .map((h) => ({
            kind: 'command',
            id: h.command.id,
            name: h.command.title,
            icon: h.command.icon ?? '•',
            sub: h.command.group ?? 'Command',
          }))
      : []
    return [...appResults, ...commandResults]
  })

  const selected = createMemo<Result | undefined>(() => {
    const list = results()
    return list[Math.min(active(), list.length - 1)]
  })

  const open = (r: Result): void => {
    if (r.kind === 'app') launchApp(r.id)
    else void registry.run(r.id)
    props.onClose()
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    const sel = selected()
    if (e.key === 'Enter' && sel) open(sel)
    else if (e.key === 'Escape') props.onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results().length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    }
  }

  return (
    <Show when={props.open}>
      <div
        onPointerDown={() => props.onClose()}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          'justify-content': 'center',
          'align-items': 'flex-start',
          'padding-top': '18vh',
          background: 'rgba(0,0,0,0.06)',
          'z-index': 100000,
        }}
      >
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: 'min(680px, 92vw)',
            'max-height': '60vh',
            display: 'flex',
            'flex-direction': 'column',
            'border-radius': '14px',
            overflow: 'hidden',
            background: 'var(--os-window-bg)',
            color: 'var(--os-window-fg)',
            border: 'var(--os-window-border)',
            'box-shadow': '0 30px 80px rgba(0,0,0,0.5)',
            'backdrop-filter': 'var(--os-blur)',
            '-webkit-backdrop-filter': 'var(--os-blur)',
            'transform-origin': 'top center',
            transform: shown() ? 'scale(1)' : 'scale(0.96)',
            opacity: shown() ? 1 : 0,
            transition: 'transform 160ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 160ms ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              gap: '12px',
              padding: '14px 18px',
              'border-bottom': '1px solid rgba(127,127,127,0.2)',
            }}
          >
            <span style={{ 'font-size': '22px', opacity: 0.6 }}>🔍</span>
            <input
              ref={inputRef}
              value={query()}
              onInput={(e) => {
                setQuery(e.currentTarget.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="Spotlight Search"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'inherit',
                'font-size': '22px',
              }}
            />
          </div>

          <div style={{ display: 'flex', 'min-height': 0 }}>
            {/* Results list */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                'border-right': '1px solid rgba(127,127,127,0.18)',
              }}
            >
              <div
                style={{
                  padding: '8px 18px 4px',
                  'font-size': '11px',
                  'font-weight': 700,
                  'letter-spacing': '0.4px',
                  'text-transform': 'uppercase',
                  opacity: 0.45,
                }}
              >
                {query().trim() ? 'Top hits' : 'Applications'}
              </div>
              <For each={results()}>
                {(r, i) => {
                  const isActive = (): boolean => i() === Math.min(active(), results().length - 1)
                  return (
                    <button
                      type="button"
                      onClick={() => open(r)}
                      onPointerEnter={() => setActive(i())}
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        gap: '12px',
                        width: '100%',
                        padding: '9px 18px',
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
                      <span style={{ 'font-size': '22px' }}>{r.icon}</span>
                      {r.name}
                    </button>
                  )
                }}
              </For>
              <Show when={results().length === 0}>
                <div style={{ padding: '18px', opacity: 0.6 }}>No results.</div>
              </Show>
            </div>

            {/* Preview column for the selected result */}
            <div
              style={{
                width: '220px',
                'flex-shrink': 0,
                display: 'flex',
                'flex-direction': 'column',
                'align-items': 'center',
                'justify-content': 'center',
                gap: '8px',
                padding: '24px 16px',
                'text-align': 'center',
              }}
            >
              <Show
                when={selected()}
                fallback={<div style={{ 'font-size': '13px', opacity: 0.45 }}>No selection</div>}
              >
                {(sel) => (
                  <>
                    <div style={{ 'font-size': '64px', 'line-height': 1 }}>{sel().icon}</div>
                    <div style={{ 'font-size': '17px', 'font-weight': 600 }}>{sel().name}</div>
                    <div style={{ 'font-size': '12px', opacity: 0.55 }}>{sel().sub}</div>
                  </>
                )}
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
