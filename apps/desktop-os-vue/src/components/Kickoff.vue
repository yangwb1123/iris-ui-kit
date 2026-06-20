<script setup lang="ts">
/**
 * KDE Kickoff — the Vue mirror of the React `Kickoff`. The bottom-left,
 * panel-anchored application launcher: a user header, a search field, and a body
 * split into a category rail (left) + an app list (right). Searching spans every
 * app; otherwise the list is scoped to the selected category. Reuses the shell's
 * `useApps` + `launchApp` (the same substrate the Panel + ⌘K palette read).
 * Enter launches the first result; Esc / click-outside close. Token-styled.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { type AppManifest } from '../catalog'
import { useApps, launchApp } from '../profile'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

/** A left-rail category in the Kickoff launcher. */
interface Category {
  id: string
  label: string
  icon: string
  /** App ids this category contains; undefined = all applications. */
  apps?: string[]
}

const FAVORITE_IDS = ['files', 'notepad', 'settings']

const CATEGORIES: Category[] = [
  { id: 'favorites', label: 'Favorites', icon: '⭐', apps: FAVORITE_IDS },
  { id: 'all', label: 'All Applications', icon: '🗂️' },
  { id: 'utilities', label: 'Utilities', icon: '🛠️', apps: ['files', 'notepad', 'taskmgr'] },
  { id: 'system', label: 'System', icon: '⚙️', apps: ['settings', 'about', 'taskmgr'] },
]

const apps = useApps()
const query = ref('')
const category = ref('favorites')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) {
      query.value = ''
      category.value = 'favorites'
      nextTick(() => inputRef.value?.focus())
    }
  },
)

const q = computed(() => query.value.trim().toLowerCase())

const results = computed<AppManifest[]>(() => {
  const cat = CATEGORIES.find((c) => c.id === category.value) ?? CATEGORIES[1]
  // Searching spans every app; otherwise scope to the selected category.
  const scoped: AppManifest[] = q.value
    ? apps.value
    : cat.apps
      ? cat.apps
          .map((id) => apps.value.find((a) => a.id === id))
          .filter((a): a is AppManifest => Boolean(a))
      : apps.value
  return q.value ? scoped.filter((a) => a.name.toLowerCase().includes(q.value)) : scoped
})

function launch(id: string) {
  launchApp(id)
  emit('close')
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && results.value[0]) launch(results.value[0].id)
  else if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <div v-if="open" class="kickoff-backdrop" @pointerdown="emit('close')">
    <div class="kickoff" @pointerdown.stop>
      <!-- User header. -->
      <div class="kickoff-header">
        <span aria-hidden="true" class="kickoff-avatar">👤</span>
        <div style="display: flex; flex-direction: column; line-height: 1.25">
          <strong style="font-size: 14px">user@iris-os</strong>
          <span style="font-size: 11px; opacity: 0.65">Plasma Desktop</span>
        </div>
      </div>

      <!-- Search box. -->
      <div class="kickoff-search">
        <input
          ref="inputRef"
          v-model="query"
          class="kickoff-input"
          placeholder="Search applications…"
          @keydown="onKeyDown"
        />
      </div>

      <!-- Body: category rail (left) + app list (right). -->
      <div class="kickoff-body">
        <div role="tablist" aria-label="Categories" class="kickoff-rail">
          <button
            v-for="c in CATEGORIES"
            :key="c.id"
            type="button"
            role="tab"
            :aria-selected="!q && c.id === category"
            :disabled="Boolean(q)"
            class="kickoff-cat"
            :class="{ 'is-selected': !q && c.id === category, 'is-disabled': Boolean(q) }"
            @click="category = c.id"
          >
            <span aria-hidden="true" style="font-size: 15px">{{ c.icon }}</span>
            {{ c.label }}
          </button>
        </div>

        <div class="kickoff-list">
          <button
            v-for="app in results"
            :key="app.id"
            type="button"
            class="kickoff-app"
            @click="launch(app.id)"
          >
            <span style="font-size: 22px">{{ app.icon }}</span>
            {{ app.name }}
          </button>
          <div v-if="results.length === 0" style="padding: 12px; opacity: 0.6">
            No applications found.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Transparent backdrop just to capture the click-outside; the menu sits bottom-left. */
.kickoff-backdrop {
  position: absolute;
  inset: 0;
  z-index: 100000;
}
.kickoff {
  position: absolute;
  bottom: calc(var(--os-bar-h) + 6px);
  left: 6px;
  width: 440px;
  height: 62vh;
  max-height: 520px;
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  overflow: hidden;
  background: var(--os-bar-bg);
  color: var(--os-bar-fg);
  border: 1px solid rgba(61, 174, 233, 0.5);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
  font-family: var(--os-font);
}
.kickoff-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.18);
}
.kickoff-avatar {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 20px;
  color: #fff;
  background: linear-gradient(135deg, var(--os-accent) 0%, var(--os-accent-strong) 100%);
}
.kickoff-search {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.kickoff-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid rgba(61, 174, 233, 0.5);
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  outline: none;
  font-family: inherit;
}
.kickoff-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.kickoff-rail {
  width: 140px;
  flex-shrink: 0;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.12);
  overflow: auto;
}
.kickoff-cat {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-left: 3px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  font-family: inherit;
}
.kickoff-cat:not(.is-selected):not(.is-disabled):hover {
  background: rgba(255, 255, 255, 0.06);
}
.kickoff-cat.is-selected {
  border-left: 3px solid var(--os-accent);
  background: color-mix(in srgb, var(--os-accent) 22%, transparent);
}
.kickoff-cat.is-disabled {
  cursor: default;
  opacity: 0.4;
}
.kickoff-list {
  flex: 1;
  overflow: auto;
  padding: 6px;
}
.kickoff-app {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}
.kickoff-app:hover {
  background: var(--os-accent);
  color: #fff;
}
</style>
