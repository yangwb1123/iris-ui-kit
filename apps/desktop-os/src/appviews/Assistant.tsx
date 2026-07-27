import * as React from 'react'
import { IrisButton } from '@iris-ui-kit/react'
import type { Command } from '@iris-ui-kit/core/commands'
import { useCommands } from '../commands-context'
import { createAnthropicCall, createLlmPlanner, fuzzyPlanner, type Planner } from './planner'

// Re-export the planner seam from its old home so existing import sites keep working.
export { fuzzyPlanner } from './planner'
export type { Planner, PlanResult } from './planner'

interface Turn {
  role: 'you' | 'iris'
  text: string
  /** Alternative commands offered as clickable chips. */
  actions?: Command[]
}

const GREETING: Turn = {
  role: 'iris',
  text:
    'Tell me what to do — e.g. “open settings”, “switch to macOS”, “close window”, ' +
    '“open app store”. I map your words to desktop actions via the command registry and run them. ' +
    'The default planner is deterministic (fuzzy match). Flip on the AI planner (⚙) to have ' +
    'Claude pick the command via tool-use over the same registry.',
}

const DEFAULT_MODEL = 'claude-opus-4-8'

/**
 * The agent layer: a natural-ish command runner over `@iris-ui-kit/core/commands`.
 * The `planner` prop is the deterministic fallback (fuzzy-match → top command).
 * When the user enables the AI planner and supplies a key, a Claude-backed
 * planner ({@link createLlmPlanner}) takes over — it asks the model to pick a
 * command via tool-use over the same registry, falling back to `planner` on any
 * miss. Every desktop capability is a registered Command, so this is a real
 * cross-app agent with zero shell changes.
 */
export function AssistantView({ planner = fuzzyPlanner }: { planner?: Planner } = {}) {
  const registry = useCommands()
  const [input, setInput] = React.useState('')
  const [turns, setTurns] = React.useState<Turn[]>([GREETING])
  const [pending, setPending] = React.useState(false)
  const bodyRef = React.useRef<HTMLDivElement>(null)

  // ── AI-planner config (in-memory only; the key is never persisted) ──────────
  const [showSettings, setShowSettings] = React.useState(false)
  const [aiOn, setAiOn] = React.useState(false)
  const [aiKey, setAiKey] = React.useState('')
  const [aiModel, setAiModel] = React.useState(DEFAULT_MODEL)

  const aiActive = aiOn && aiKey.trim().length > 0
  const effectivePlanner = React.useMemo<Planner>(() => {
    if (!aiActive) return planner
    return createLlmPlanner(
      createAnthropicCall({ apiKey: aiKey.trim(), model: aiModel.trim() || undefined }),
      planner,
    )
  }, [aiActive, aiKey, aiModel, planner])

  React.useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [turns, pending])

  const runCommand = (c: Command) => {
    void c.run()
    setTurns((t) => [...t, { role: 'iris', text: `✓ ${c.title}` }])
  }

  const submit = async () => {
    const text = input.trim()
    if (!text || pending) return
    setInput('')
    setTurns((t) => [...t, { role: 'you', text }])
    setPending(true)
    try {
      // The planner is the seam: it chooses a command id (fuzzy, or Claude tool-use).
      const plan = await effectivePlanner(text, registry)
      if (!plan) {
        setTurns((t) => [
          ...t,
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
          { role: 'iris', text: `The planner picked “${plan.commandId}”, but it isn’t available.` },
        ])
        return
      }
      void chosen.run(plan.args)
      // Offer up to 3 other near-matches as one-tap alternatives.
      const alts = registry
        .search(text, 5)
        .map((h) => h.command)
        .filter((c) => c.id !== chosen.id)
        .slice(0, 3)
      setTurns((t) => [...t, { role: 'iris', text: plan.say, actions: alts }])
    } catch (err) {
      setTurns((t) => [
        ...t,
        {
          role: 'iris',
          text: `The planner failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ])
    } finally {
      setPending(false)
    }
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

  const fieldStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid rgba(127,127,127,0.35)',
    background: 'rgba(255,255,255,0.5)',
    color: 'inherit',
    outline: 'none',
    fontSize: 13,
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
        {pending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 12,
                fontSize: 14,
                background: 'rgba(127,127,127,0.16)',
                opacity: 0.7,
              }}
            >
              {aiActive ? 'Asking Claude…' : 'Thinking…'}
            </div>
          </div>
        )}
      </div>

      {showSettings && (
        <div
          style={{
            display: 'grid',
            gap: 8,
            padding: 12,
            borderTop: '1px solid rgba(127,127,127,0.2)',
            background: 'rgba(127,127,127,0.06)',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={aiOn} onChange={(e) => setAiOn(e.target.checked)} />
            Use Claude to pick the command (tool-use over the registry)
          </label>
          <input
            type="password"
            value={aiKey}
            onChange={(e) => setAiKey(e.target.value)}
            placeholder="Anthropic API key (sk-ant-…)"
            autoComplete="off"
            style={fieldStyle}
          />
          <input
            type="text"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder={DEFAULT_MODEL}
            style={fieldStyle}
          />
          <p style={{ margin: 0, fontSize: 11, opacity: 0.65, lineHeight: 1.45 }}>
            ⚠️ Demo only: the key is sent straight from the browser to Anthropic (
            <code>dangerouslyAllowBrowser</code>) and kept in memory for this session only — never
            persisted. In production, proxy the call through a server that holds the key. Falls back
            to the deterministic planner if the call fails.
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          borderTop: '1px solid rgba(127,127,127,0.2)',
        }}
      >
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          aria-label="AI planner settings"
          aria-pressed={showSettings}
          title={aiActive ? 'AI planner: on' : 'AI planner: off'}
          style={{
            width: 38,
            borderRadius: 999,
            cursor: 'pointer',
            border: '1px solid rgba(127,127,127,0.35)',
            background: aiActive
              ? 'color-mix(in srgb, var(--os-accent) 85%, transparent)'
              : 'transparent',
            color: aiActive ? '#fff' : 'inherit',
            fontSize: 16,
          }}
        >
          ⚙
        </button>
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
        <IrisButton type="submit" variant="solid" disabled={pending}>
          Send
        </IrisButton>
      </form>
    </div>
  )
}
