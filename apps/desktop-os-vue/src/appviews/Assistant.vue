<script setup lang="ts">
import { computed, nextTick, ref, watch, type Ref } from 'vue'
import { IrisButton } from '@iris-ui-kit/vue'
import type { Command } from '@iris-ui-kit/core/commands'
import { useCommands } from '../commands'
import { createAnthropicCall, createLlmPlanner, fuzzyPlanner, type Planner } from '../planner'

/**
 * The agent layer (Vue): a natural-ish command runner over `@iris-ui-kit/core/commands`.
 * The default planner is deterministic (fuzzy-match → top command). When the user
 * enables the AI planner and supplies a key, a Claude-backed planner
 * ({@link createLlmPlanner}) takes over — it asks the model to pick a command via
 * tool-use over the same registry, falling back to fuzzy on any miss. Every
 * desktop capability is a registered Command, so this is a real cross-app agent
 * with zero shell changes. The Vue twin of the React demo's Assistant.
 */

interface Turn {
  role: 'you' | 'iris'
  text: string
  /** Alternative commands offered as clickable chips. */
  actions?: Command[]
}

const DEFAULT_MODEL = 'claude-opus-4-8'

const GREETING: Turn = {
  role: 'iris',
  text:
    'Tell me what to do — e.g. “open settings”, “switch to macOS”, “close window”, ' +
    '“open app store”. I map your words to desktop actions via the command registry and run them. ' +
    'The default planner is deterministic (fuzzy match). Flip on the AI planner (⚙) to have ' +
    'Claude pick the command via tool-use over the same registry.',
}

const registry = useCommands()

const input = ref('')
const turns = ref<Turn[]>([GREETING])
const pending = ref(false)
const bodyRef = ref<HTMLDivElement | null>(null)

// ── AI-planner config (in-memory only; the key is NEVER persisted) ────────────
const showSettings = ref(false)
const aiOn = ref(false)
const aiKey = ref('')
const aiModel = ref(DEFAULT_MODEL)

const aiActive = computed(() => aiOn.value && aiKey.value.trim().length > 0)

/**
 * The effective planner: Claude-backed when enabled with a key, else the
 * deterministic fuzzy planner. Recomputes when enable / key / model change.
 */
const effectivePlanner = computed<Planner>(() => {
  if (!aiActive.value) return fuzzyPlanner
  return createLlmPlanner(
    createAnthropicCall({ apiKey: aiKey.value.trim(), model: aiModel.value.trim() || undefined }),
    fuzzyPlanner,
  )
})

// Auto-scroll to the latest message as the conversation grows.
function scrollToEnd() {
  void nextTick(() => {
    const el = bodyRef.value
    if (el) el.scrollTo({ top: el.scrollHeight })
  })
}
watch([turns, pending], scrollToEnd, { deep: true })

function runCommand(c: Command) {
  void c.run()
  turns.value.push({ role: 'iris', text: `✓ ${c.title}` })
}

async function submit() {
  const text = input.value.trim()
  if (!text || pending.value) return
  input.value = ''
  turns.value.push({ role: 'you', text })
  pending.value = true
  try {
    // The planner is the seam: it chooses a command id (fuzzy, or Claude tool-use).
    const plan = await effectivePlanner.value(text, registry)
    if (!plan) {
      turns.value.push({
        role: 'iris',
        text: 'I couldn’t find an action for that. Try naming an app or a window action.',
      })
      return
    }
    const chosen = registry.list().find((c) => c.id === plan.commandId)
    if (!chosen) {
      turns.value.push({
        role: 'iris',
        text: `The planner picked “${plan.commandId}”, but it isn’t available.`,
      })
      return
    }
    void chosen.run(plan.args)
    // Offer up to 3 other near-matches as one-tap alternatives.
    const alts = registry
      .search(text, 5)
      .map((h) => h.command)
      .filter((c) => c.id !== chosen.id)
      .slice(0, 3)
    turns.value.push({ role: 'iris', text: plan.say, actions: alts })
  } catch (err) {
    turns.value.push({
      role: 'iris',
      text: `The planner failed: ${err instanceof Error ? err.message : String(err)}`,
    })
  } finally {
    pending.value = false
  }
}

// Plain refs typed for the template (avoids unwrap quirks in some setups).
const inputModel = input as Ref<string>
const keyModel = aiKey as Ref<string>
const modelModel = aiModel as Ref<string>
</script>

<template>
  <div class="assistant">
    <div ref="bodyRef" class="body">
      <div v-for="(t, i) in turns" :key="i" class="row" :class="{ 'row--mine': t.role === 'you' }">
        <div class="stack">
          <div class="bubble" :class="t.role === 'you' ? 'bubble--mine' : 'bubble--iris'">
            {{ t.text }}
          </div>
          <div v-if="t.actions && t.actions.length" class="chips">
            <span class="chips-label">or:</span>
            <button
              v-for="c in t.actions"
              :key="c.id"
              type="button"
              class="chip"
              @click="runCommand(c)"
            >
              <template v-if="c.icon">{{ c.icon }} </template>{{ c.title }}
            </button>
          </div>
        </div>
      </div>
      <div v-if="pending" class="row">
        <div class="bubble bubble--iris bubble--pending">
          {{ aiActive ? 'Asking Claude…' : 'Thinking…' }}
        </div>
      </div>
    </div>

    <div v-if="showSettings" class="settings">
      <label class="check">
        <input v-model="aiOn" type="checkbox" />
        Use Claude to pick the command (tool-use over the registry)
      </label>
      <input
        v-model="keyModel"
        type="password"
        class="field"
        placeholder="Anthropic API key (sk-ant-…)"
        autocomplete="off"
      />
      <input v-model="modelModel" type="text" class="field" :placeholder="DEFAULT_MODEL" />
      <p class="warn">
        ⚠️ Demo only: the key is sent straight from the browser to Anthropic
        (<code>dangerouslyAllowBrowser</code>) and kept in memory for this session only — never
        persisted. In production, proxy the call through a server that holds the key. Falls back to
        the deterministic planner if the call fails.
      </p>
    </div>

    <form class="composer" @submit.prevent="submit">
      <button
        type="button"
        class="gear"
        :class="{ 'gear--on': aiActive }"
        aria-label="AI planner settings"
        :aria-pressed="showSettings"
        :title="aiActive ? 'AI planner: on' : 'AI planner: off'"
        @click="showSettings = !showSettings"
      >
        ⚙
      </button>
      <input
        v-model="inputModel"
        class="text-input"
        placeholder="Ask the desktop to do something…"
      />
      <IrisButton type="submit" variant="solid" :disabled="pending">Send</IrisButton>
    </form>
  </div>
</template>

<style scoped>
.assistant {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--os-window-fg);
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
}
.bubble--iris {
  background: rgba(127, 127, 127, 0.16);
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
.text-input {
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
