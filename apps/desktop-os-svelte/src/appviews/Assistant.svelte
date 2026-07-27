<script lang="ts">
  /**
   * The agent layer for the Svelte 5 shell: a natural-ish command runner over
   * `@iris-ui-kit/core/commands`. The deterministic `fuzzyPlanner` (fuzzy-match → top
   * command) is the default. When the user enables the AI planner and supplies a
   * key, a Claude-backed planner (`createLlmPlanner`) takes over — it asks the
   * model to pick a command via tool-use over the SAME registry, falling back to
   * the deterministic planner on any miss. Every desktop capability is a
   * registered Command, so this is a real cross-app agent with zero shell changes.
   *
   * Mirrors `apps/desktop-os/src/appviews/Assistant.tsx` (React), in idiomatic
   * Svelte 5 runes.
   */
  import { IrisButton } from '@iris-ui-kit/svelte'
  import type { Command } from '@iris-ui-kit/core/commands'
  import { useCommands } from '../commands.svelte'
  import { createAnthropicCall, createLlmPlanner, fuzzyPlanner, type Planner } from '../planner'

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

  const registry = useCommands()

  let input = $state('')
  let turns = $state<Turn[]>([GREETING])
  let pending = $state(false)
  let bodyEl: HTMLDivElement | undefined = $state()

  // ── AI-planner config (in-memory only; the key is NEVER persisted) ──────────
  let showSettings = $state(false)
  let aiOn = $state(false)
  let aiKey = $state('')
  let aiModel = $state(DEFAULT_MODEL)

  const aiActive = $derived(aiOn && aiKey.trim().length > 0)

  // The planner is the seam: deterministic fuzzy by default, Claude tool-use when
  // enabled + keyed. `createLlmPlanner` falls back to `fuzzyPlanner` on any miss.
  const effectivePlanner = $derived<Planner>(
    aiActive
      ? createLlmPlanner(
          createAnthropicCall({ apiKey: aiKey.trim(), model: aiModel.trim() || undefined }),
          fuzzyPlanner,
        )
      : fuzzyPlanner,
  )

  // Keep the transcript scrolled to the latest turn / pending indicator.
  $effect(() => {
    void turns
    void pending
    bodyEl?.scrollTo({ top: bodyEl.scrollHeight })
  })

  function runCommand(c: Command) {
    void c.run()
    turns = [...turns, { role: 'iris', text: `✓ ${c.title}` }]
  }

  async function submit(e?: SubmitEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || pending) return
    input = ''
    turns = [...turns, { role: 'you', text }]
    pending = true
    try {
      // The planner chooses a command id (fuzzy, or Claude tool-use). May be async.
      const plan = await effectivePlanner(text, registry)
      if (!plan) {
        turns = [
          ...turns,
          {
            role: 'iris',
            text: 'I couldn’t find an action for that. Try naming an app or a window action.',
          },
        ]
        return
      }
      const chosen = registry.list().find((c) => c.id === plan.commandId)
      if (!chosen) {
        turns = [
          ...turns,
          { role: 'iris', text: `The planner picked “${plan.commandId}”, but it isn’t available.` },
        ]
        return
      }
      void chosen.run(plan.args)
      // Offer up to 3 other near-matches as one-tap alternatives.
      const alts = registry
        .search(text, 5)
        .map((h) => h.command)
        .filter((c) => c.id !== chosen.id)
        .slice(0, 3)
      turns = [...turns, { role: 'iris', text: plan.say, actions: alts }]
    } catch (err) {
      turns = [
        ...turns,
        {
          role: 'iris',
          text: `The planner failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]
    } finally {
      pending = false
    }
  }
</script>

<div class="assistant">
  <div class="body" bind:this={bodyEl}>
    {#each turns as turn, i (i)}
      <div class="row" class:row--mine={turn.role === 'you'}>
        <div class="stack">
          <div class="bubble" class:bubble--mine={turn.role === 'you'}>{turn.text}</div>
          {#if turn.actions && turn.actions.length > 0}
            <div class="chips">
              <span class="chips-label">or:</span>
              {#each turn.actions as c (c.id)}
                <button type="button" class="chip" onclick={() => runCommand(c)}>
                  {c.icon ? `${c.icon} ` : ''}{c.title}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/each}
    {#if pending}
      <div class="row">
        <div class="bubble bubble--pending">{aiActive ? 'Asking Claude…' : 'Thinking…'}</div>
      </div>
    {/if}
  </div>

  {#if showSettings}
    <div class="settings">
      <label class="check">
        <input type="checkbox" bind:checked={aiOn} />
        Use Claude to pick the command (tool-use over the registry)
      </label>
      <input
        type="password"
        class="field"
        bind:value={aiKey}
        placeholder="Anthropic API key (sk-ant-…)"
        autocomplete="off"
      />
      <input type="text" class="field" bind:value={aiModel} placeholder={DEFAULT_MODEL} />
      <p class="warn">
        ⚠️ Demo only: the key is sent straight from the browser to Anthropic (<code
          >dangerouslyAllowBrowser</code
        >) and kept in memory for this session only — never persisted. In production, proxy the call
        through a server that holds the key. Falls back to the deterministic planner if the call
        fails.
      </p>
    </div>
  {/if}

  <form class="composer" onsubmit={submit}>
    <button
      type="button"
      class="gear"
      class:gear--on={aiActive}
      aria-label="AI planner settings"
      aria-pressed={showSettings}
      title={aiActive ? 'AI planner: on' : 'AI planner: off'}
      onclick={() => (showSettings = !showSettings)}
    >
      ⚙
    </button>
    <input class="input" bind:value={input} placeholder="Ask the desktop to do something…" />
    <IrisButton type="submit" variant="solid" disabled={pending}>Send</IrisButton>
  </form>
</div>

<style>
  .assistant {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .body {
    flex: 1;
    overflow: auto;
    padding: 16px;
    display: grid;
    gap: 12px;
    align-content: start;
  }
  .row {
    display: flex;
    justify-content: flex-start;
  }
  .row--mine {
    justify-content: flex-end;
  }
  .stack {
    max-width: 85%;
    display: grid;
    gap: 6px;
  }
  .bubble {
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.5;
    background: rgba(127, 127, 127, 0.16);
    color: inherit;
  }
  .bubble--mine {
    background: color-mix(in srgb, var(--os-accent) 85%, transparent);
    color: #fff;
  }
  .bubble--pending {
    opacity: 0.7;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chips-label {
    font-size: 12px;
    opacity: 0.6;
    align-self: center;
  }
  .chip {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 999px;
    cursor: pointer;
    border: 1px solid rgba(127, 127, 127, 0.4);
    background: transparent;
    color: inherit;
  }
  .settings {
    display: grid;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid rgba(127, 127, 127, 0.2);
    background: rgba(127, 127, 127, 0.06);
  }
  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .field {
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(127, 127, 127, 0.35);
    background: rgba(255, 255, 255, 0.5);
    color: inherit;
    outline: none;
    font-size: 13px;
  }
  .warn {
    margin: 0;
    font-size: 11px;
    opacity: 0.65;
    line-height: 1.45;
  }
  .composer {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid rgba(127, 127, 127, 0.2);
  }
  .gear {
    width: 38px;
    border-radius: 999px;
    cursor: pointer;
    border: 1px solid rgba(127, 127, 127, 0.35);
    background: transparent;
    color: inherit;
    font-size: 16px;
  }
  .gear--on {
    background: color-mix(in srgb, var(--os-accent) 85%, transparent);
    color: #fff;
  }
  .input {
    flex: 1;
    padding: 9px 14px;
    border-radius: 999px;
    border: 1px solid rgba(127, 127, 127, 0.35);
    background: rgba(255, 255, 255, 0.5);
    color: inherit;
    outline: none;
    font-size: 14px;
  }
</style>
