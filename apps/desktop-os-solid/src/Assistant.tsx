import { For, Show, createEffect, createMemo, createSignal, type JSX } from 'solid-js'
import { IrisButton } from '@iris-ui/solid'
import type { Command } from '@iris-ui/core/commands'
import { useCommands } from './commands'
import { createAnthropicCall, createLlmPlanner, fuzzyPlanner, type Planner } from './planner'

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
 * The agent layer: a natural-ish command runner over `@iris-ui/core/commands`.
 * The deterministic fallback is `fuzzyPlanner` (fuzzy-match → top command). When
 * the user enables the AI planner and supplies a key, a Claude-backed planner
 * ({@link createLlmPlanner}) takes over — it asks the model to pick a command via
 * tool-use over the same registry, falling back to the deterministic planner on
 * any miss. Every desktop capability is a registered Command, so this is a real
 * cross-app agent with zero shell changes. The React desktop's Assistant, on Solid.
 */
export function AssistantApp(props: { planner?: Planner } = {}): JSX.Element {
  const registry = useCommands()
  const basePlanner = (): Planner => props.planner ?? fuzzyPlanner
  const [input, setInput] = createSignal('')
  const [turns, setTurns] = createSignal<Turn[]>([GREETING])
  const [pending, setPending] = createSignal(false)
  let bodyRef: HTMLDivElement | undefined

  // ── AI-planner config (in-memory only; the key is never persisted) ──────────
  const [showSettings, setShowSettings] = createSignal(false)
  const [aiOn, setAiOn] = createSignal(false)
  const [aiKey, setAiKey] = createSignal('')
  const [aiModel, setAiModel] = createSignal(DEFAULT_MODEL)

  const aiActive = createMemo(() => aiOn() && aiKey().trim().length > 0)
  const effectivePlanner = createMemo<Planner>(() => {
    if (!aiActive()) return basePlanner()
    return createLlmPlanner(
      createAnthropicCall({ apiKey: aiKey().trim(), model: aiModel().trim() || undefined }),
      basePlanner(),
    )
  })

  // Auto-scroll to the latest turn (tracks turns + the pending indicator).
  createEffect(() => {
    turns()
    pending()
    bodyRef?.scrollTo({ top: bodyRef.scrollHeight })
  })

  const runCommand = (c: Command): void => {
    void c.run()
    setTurns((t) => [...t, { role: 'iris', text: `✓ ${c.title}` }])
  }

  const submit = async (): Promise<void> => {
    const text = input().trim()
    if (!text || pending()) return
    setInput('')
    setTurns((t) => [...t, { role: 'you', text }])
    setPending(true)
    try {
      // The planner is the seam: it chooses a command id (fuzzy, or Claude tool-use).
      const plan = await effectivePlanner()(text, registry)
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
      void chosen.run()
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

  const fieldStyle: JSX.CSSProperties = {
    padding: '6px 10px',
    'border-radius': '8px',
    border: '1px solid rgba(127,127,127,0.35)',
    background: 'rgba(255,255,255,0.5)',
    color: 'inherit',
    outline: 'none',
    'font-size': '13px',
  }

  const Bubble = (t: Turn): JSX.Element => {
    const mine = t.role === 'you'
    return (
      <div style={{ display: 'flex', 'justify-content': mine ? 'flex-end' : 'flex-start' }}>
        <div style={{ 'max-width': '85%', display: 'grid', gap: '6px' }}>
          <div
            style={{
              padding: '8px 12px',
              'border-radius': '12px',
              'font-size': '14px',
              'line-height': 1.5,
              background: mine
                ? 'color-mix(in srgb, var(--os-accent) 85%, transparent)'
                : 'rgba(127,127,127,0.16)',
              color: mine ? '#fff' : 'inherit',
            }}
          >
            {t.text}
          </div>
          <Show when={t.actions && t.actions.length > 0}>
            <div style={{ display: 'flex', gap: '6px', 'flex-wrap': 'wrap' }}>
              <span style={{ 'font-size': '12px', opacity: 0.6, 'align-self': 'center' }}>or:</span>
              <For each={t.actions}>
                {(c) => (
                  <button
                    type="button"
                    onClick={() => runCommand(c)}
                    style={{
                      'font-size': '12px',
                      padding: '3px 10px',
                      'border-radius': '999px',
                      cursor: 'pointer',
                      border: '1px solid rgba(127,127,127,0.4)',
                      background: 'transparent',
                      color: 'inherit',
                    }}
                  >
                    {c.icon ? `${c.icon} ` : ''}
                    {c.title}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
      <div
        ref={bodyRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          display: 'grid',
          gap: '12px',
          'align-content': 'start',
        }}
      >
        <For each={turns()}>{(t) => <Bubble {...t} />}</For>
        <Show when={pending()}>
          <div style={{ display: 'flex', 'justify-content': 'flex-start' }}>
            <div
              style={{
                padding: '8px 12px',
                'border-radius': '12px',
                'font-size': '14px',
                background: 'rgba(127,127,127,0.16)',
                opacity: 0.7,
              }}
            >
              {aiActive() ? 'Asking Claude…' : 'Thinking…'}
            </div>
          </div>
        </Show>
      </div>

      <Show when={showSettings()}>
        <div
          style={{
            display: 'grid',
            gap: '8px',
            padding: '12px',
            'border-top': '1px solid rgba(127,127,127,0.2)',
            background: 'rgba(127,127,127,0.06)',
          }}
        >
          <label
            style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'font-size': '13px' }}
          >
            <input
              type="checkbox"
              checked={aiOn()}
              onChange={(e) => setAiOn(e.currentTarget.checked)}
            />
            Use Claude to pick the command (tool-use over the registry)
          </label>
          <input
            type="password"
            value={aiKey()}
            onInput={(e) => setAiKey(e.currentTarget.value)}
            placeholder="Anthropic API key (sk-ant-…)"
            autocomplete="off"
            style={fieldStyle}
          />
          <input
            type="text"
            value={aiModel()}
            onInput={(e) => setAiModel(e.currentTarget.value)}
            placeholder={DEFAULT_MODEL}
            style={fieldStyle}
          />
          <p style={{ margin: 0, 'font-size': '11px', opacity: 0.65, 'line-height': 1.45 }}>
            ⚠️ Demo only: the key is sent straight from the browser to Anthropic (
            <code>dangerouslyAllowBrowser</code>) and kept in memory for this session only — never
            persisted. In production, proxy the call through a server that holds the key. Falls back
            to the deterministic planner if the call fails.
          </p>
        </div>
      </Show>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px',
          'border-top': '1px solid rgba(127,127,127,0.2)',
        }}
      >
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          aria-label="AI planner settings"
          aria-pressed={showSettings()}
          title={aiActive() ? 'AI planner: on' : 'AI planner: off'}
          style={{
            width: '38px',
            'border-radius': '999px',
            cursor: 'pointer',
            border: '1px solid rgba(127,127,127,0.35)',
            background: aiActive()
              ? 'color-mix(in srgb, var(--os-accent) 85%, transparent)'
              : 'transparent',
            color: aiActive() ? '#fff' : 'inherit',
            'font-size': '16px',
          }}
        >
          ⚙
        </button>
        <input
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          placeholder="Ask the desktop to do something…"
          style={{
            flex: 1,
            padding: '9px 14px',
            'border-radius': '999px',
            border: '1px solid rgba(127,127,127,0.35)',
            background: 'rgba(255,255,255,0.5)',
            color: 'inherit',
            outline: 'none',
            'font-size': '14px',
          }}
        />
        <IrisButton type="submit" variant="solid" disabled={pending()}>
          Send
        </IrisButton>
      </form>
    </div>
  )
}
