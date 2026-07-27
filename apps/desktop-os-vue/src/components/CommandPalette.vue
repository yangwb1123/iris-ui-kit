<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { type Command, type CommandHit } from '@iris-ui-kit/core/commands'
import { useCommands } from '../commands'
import { useWmState } from '../wm'

/**
 * ⌘K / Ctrl+K command palette — a centered, token-skinned overlay that fuzzy-
 * searches the shared command registry and runs the chosen command. ↑/↓ move the
 * selection, Enter runs it (then closes), Esc + click-outside close. The Vue twin
 * of the React demo's CommandPalette.
 */
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const registry = useCommands()
// Re-derive search results when the registry contents change (apps/windows).
const wmState = useWmState()

const query = ref('')
const active = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    query.value = ''
    active.value = 0
    nextTick(() => inputRef.value?.focus())
  },
)

const hits = computed<CommandHit[]>(() => {
  // `wmState`/registry store are the change signals; re-search on either + query.
  void wmState.value
  void registry.getState()
  return registry.search(query.value)
})

// Clamp the selection into range whenever the result set shrinks.
const selectedIndex = computed(() =>
  hits.value.length === 0 ? -1 : Math.min(active.value, hits.value.length - 1),
)

// Group hits in best-score order, preserving first-seen group order, and assign
// each a flat index so ↑/↓ selection maps across groups.
const groups = computed(() => {
  const out: { group: string; items: { hit: CommandHit; flat: number }[] }[] = []
  let flat = -1
  for (const hit of hits.value) {
    flat += 1
    const group = hit.command.group ?? 'Commands'
    const bucket = out.find((g) => g.group === group)
    const entry = { hit, flat }
    if (bucket) bucket.items.push(entry)
    else out.push({ group, items: [entry] })
  }
  return out
})

function run(command: Command) {
  void registry.run(command.id)
  emit('close')
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = Math.min(active.value + 1, hits.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = Math.max(active.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const hit = hits.value[selectedIndex.value]
    if (hit) run(hit.command)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}
</script>

<template>
  <div v-if="open" class="palette-backdrop" @pointerdown="emit('close')">
    <div role="dialog" aria-label="Command palette" class="palette" @pointerdown.stop>
      <div class="palette-search">
        <span style="font-size: 18px; opacity: 0.6">⌘</span>
        <input
          ref="inputRef"
          v-model="query"
          aria-label="Search commands"
          placeholder="Type a command…"
          class="palette-input"
          @input="active = 0"
          @keydown="onKeyDown"
        />
      </div>
      <div class="palette-list">
        <div v-for="g in groups" :key="g.group">
          <div class="palette-group">{{ g.group }}</div>
          <button
            v-for="{ hit, flat } in g.items"
            :key="hit.command.id"
            type="button"
            class="palette-item"
            :class="{ 'palette-item--active': flat === selectedIndex }"
            @click="run(hit.command)"
            @pointerenter="active = flat"
          >
            <span class="palette-item-icon">{{ hit.command.icon ?? '•' }}</span>
            <span style="flex: 1">{{ hit.command.title }}</span>
          </button>
        </div>
        <div v-if="hits.length === 0" class="palette-empty">No commands found.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.palette-backdrop {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 16vh;
  background: rgba(0, 0, 0, 0.18);
  z-index: 100001;
}
.palette {
  width: min(620px, 92vw);
  max-height: 64vh;
  display: flex;
  flex-direction: column;
  border-radius: var(--os-window-radius);
  overflow: hidden;
  background: var(--os-window-bg);
  color: var(--os-window-fg);
  border: var(--os-window-border);
  box-shadow: var(--os-window-shadow);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
}
.palette-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(127, 127, 127, 0.2);
}
.palette-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font-size: 18px;
}
.palette-list {
  overflow: auto;
  padding: 6px 0;
}
.palette-group {
  padding: 8px 16px 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  opacity: 0.45;
}
.palette-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 16px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font-size: 15px;
}
.palette-item--active {
  background: color-mix(in srgb, var(--os-accent) 22%, transparent);
}
.palette-item-icon {
  width: 22px;
  text-align: center;
  font-size: 16px;
}
.palette-empty {
  padding: 16px;
  opacity: 0.6;
  font-size: 14px;
}
</style>
