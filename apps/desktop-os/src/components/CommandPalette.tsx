import * as React from 'react'
import { type Command, type CommandHit } from '@iris-ui/core/commands'
import { useCommands, useCommandSearch } from '../commands-context'

/**
 * ⌘K / Ctrl+K command palette — a centered, token-skinned overlay that fuzzy-
 * searches the shared command registry and runs the chosen command. ↑/↓ move the
 * selection, Enter runs it (then closes), Esc + click-outside close.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const registry = useCommands()
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Reset query/selection + focus the input each time the palette opens.
  React.useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const r = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(r)
  }, [open])

  const hits = useCommandSearch(query)
  // Clamp the selection into range whenever the result set shrinks.
  const selectedIndex = hits.length === 0 ? -1 : Math.min(active, hits.length - 1)

  const run = React.useCallback(
    (command: Command) => {
      void registry.run(command.id)
      onClose()
    },
    [registry, onClose],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = hits[selectedIndex]
      if (hit) run(hit.command)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  // Group hits in best-score order, preserving first-seen group order.
  const groups: { group: string; hits: CommandHit[] }[] = []
  for (const hit of hits) {
    const group = hit.command.group ?? 'Commands'
    const bucket = groups.find((g) => g.group === group)
    if (bucket) bucket.hits.push(hit)
    else groups.push({ group, hits: [hit] })
  }
  // Flat index → so ↑/↓ selection maps across groups.
  let flatIndex = -1

  return (
    <div
      onPointerDown={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '16vh',
        background: 'rgba(0,0,0,0.18)',
        zIndex: 100001,
      }}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(620px, 92vw)',
          maxHeight: '64vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--os-window-radius)',
          overflow: 'hidden',
          background: 'var(--os-window-bg)',
          color: 'var(--os-window-fg)',
          border: 'var(--os-window-border)',
          boxShadow: 'var(--os-window-shadow)',
          backdropFilter: 'var(--os-blur)',
          WebkitBackdropFilter: 'var(--os-blur)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid rgba(127,127,127,0.2)',
          }}
        >
          <span style={{ fontSize: 18, opacity: 0.6 }}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
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
              fontSize: 18,
            }}
          />
        </div>

        <div style={{ overflow: 'auto', padding: '6px 0' }}>
          {groups.map(({ group, hits: groupHits }) => (
            <div key={group}>
              <div
                style={{
                  padding: '8px 16px 4px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  opacity: 0.45,
                }}
              >
                {group}
              </div>
              {groupHits.map((hit) => {
                flatIndex += 1
                const isActive = flatIndex === selectedIndex
                return (
                  <button
                    key={hit.command.id}
                    type="button"
                    onClick={() => run(hit.command)}
                    onPointerEnter={() => setActive(hits.indexOf(hit))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      padding: '9px 16px',
                      border: 'none',
                      background: isActive
                        ? 'color-mix(in srgb, var(--os-accent) 22%, transparent)'
                        : 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 15,
                    }}
                  >
                    <span style={{ width: 22, textAlign: 'center', fontSize: 16 }}>
                      {hit.command.icon ?? '•'}
                    </span>
                    <span style={{ flex: 1 }}>{hit.command.title}</span>
                  </button>
                )
              })}
            </div>
          ))}
          {hits.length === 0 && (
            <div style={{ padding: '16px', opacity: 0.6, fontSize: 14 }}>No commands found.</div>
          )}
        </div>
      </div>
    </div>
  )
}
