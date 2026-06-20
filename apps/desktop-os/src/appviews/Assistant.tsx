import * as React from 'react'
import { IrisButton } from '@iris-ui/react'
import type { Command, CommandRegistry } from '@iris-ui/core/commands'
import { useCommands } from '../commands-context'

interface Turn {
  role: 'you' | 'iris'
  text: string
  /** Alternative commands offered as clickable chips. */
  actions?: Command[]
}

/**
 * The AGENT SEAM. A planner turns natural-language `input` into a chosen
 * `commandId` (plus what to `say`), reading the live {@link CommandRegistry}. It
 * returns `null` when nothing matches. The default is deterministic, but this
 * signature is exactly what an LLM/MCP agent needs — the registry is exposed as
 * MCP tools (see the Agent Tools app), so a model that picks a tool name IS a
 * drop-in planner with zero shell changes.
 */
export type Planner = (
  input: string,
  registry: CommandRegistry,
) => { commandId: string; say: string } | null

/**
 * The default planner: deterministic fuzzy-match → top command (the original
 * Assistant behavior). Returns `null` when nothing matches.
 */
export const fuzzyPlanner: Planner = (input, registry) => {
  const top = registry.search(input, 1)[0]?.command
  if (!top) return null
  return { commandId: top.id, say: `Running “${top.title}”.` }
}

const GREETING: Turn = {
  role: 'iris',
  text:
    'Tell me what to do — e.g. “open settings”, “switch to macOS”, “close window”, ' +
    '“open app store”. I map your words to desktop actions via the command registry and run them. ' +
    'Today’s planner is deterministic (fuzzy match); it’s a drop-in seam for an LLM/MCP agent — ' +
    'the registry is exposed as MCP tools (see the Agent Tools app).',
}

/**
 * The agent layer: a natural-ish command runner over `@iris-ui/core/commands`.
 * The planner here is DETERMINISTIC (fuzzy-match → top command), but the contract
 * is exactly what an LLM/MCP agent needs — every desktop capability is a
 * registered Command, so swapping this planner for a model that picks a command
 * id (and fills params) makes it a real cross-app agent with zero shell changes.
 */
export function AssistantView({ planner = fuzzyPlanner }: { planner?: Planner } = {}) {
  const registry = useCommands()
  const [input, setInput] = React.useState('')
  const [turns, setTurns] = React.useState<Turn[]>([GREETING])
  const bodyRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [turns])

  const runCommand = (c: Command) => {
    void c.run()
    setTurns((t) => [...t, { role: 'iris', text: `✓ ${c.title}` }])
  }

  const submit = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    // The planner is the seam: it chooses a command id (default = fuzzy top hit).
    const plan = planner(text, registry)
    if (!plan) {
      setTurns((t) => [
        ...t,
        { role: 'you', text },
        {
          role: 'iris',
          text: 'I couldn’t find an action for that. Try naming an app or a window action.',
        },
      ])
      return
    }
    const chosen = registry.list().find((c) => c.id === plan.commandId)
    if (!chosen) {
      setTurns((t) => [
        ...t,
        { role: 'you', text },
        { role: 'iris', text: `The planner picked “${plan.commandId}”, but it isn’t available.` },
      ])
      return
    }
    void chosen.run()
    // Offer up to 3 other near-matches as one-tap alternatives (same as before).
    const alts = registry
      .search(text, 5)
      .map((h) => h.command)
      .filter((c) => c.id !== chosen.id)
      .slice(0, 3)
    setTurns((t) => [...t, { role: 'you', text }, { role: 'iris', text: plan.say, actions: alts }])
  }

  const bubble = (t: Turn, i: number) => {
    const mine = t.role === 'you'
    return (
      <div key={i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
        <div style={{ maxWidth: '85%', display: 'grid', gap: 6 }}>
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 12,
              fontSize: 14,
              lineHeight: 1.5,
              background: mine
                ? 'color-mix(in srgb, var(--os-accent) 85%, transparent)'
                : 'rgba(127,127,127,0.16)',
              color: mine ? '#fff' : 'inherit',
            }}
          >
            {t.text}
          </div>
          {t.actions && t.actions.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, opacity: 0.6, alignSelf: 'center' }}>or:</span>
              {t.actions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => runCommand(c)}
                  style={{
                    fontSize: 12,
                    padding: '3px 10px',
                    borderRadius: 999,
                    cursor: 'pointer',
                    border: '1px solid rgba(127,127,127,0.4)',
                    background: 'transparent',
                    color: 'inherit',
                  }}
                >
                  {c.icon ? `${c.icon} ` : ''}
                  {c.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        ref={bodyRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'grid',
          gap: 12,
          alignContent: 'start',
        }}
      >
        {turns.map(bubble)}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          borderTop: '1px solid rgba(127,127,127,0.2)',
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the desktop to do something…"
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: 999,
            border: '1px solid rgba(127,127,127,0.35)',
            background: 'rgba(255,255,255,0.5)',
            color: 'inherit',
            outline: 'none',
            fontSize: 14,
          }}
        />
        <IrisButton type="submit" variant="solid">
          Send
        </IrisButton>
      </form>
    </div>
  )
}
