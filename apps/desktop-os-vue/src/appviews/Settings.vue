<script setup lang="ts">
/**
 * A genuine, portable Settings pane for the Win11-only Vue shell. The React demo
 * switches between three OS skins (which this build doesn't carry), so instead
 * this offers an ACCENT-COLOR picker: it applies the chosen color to the live
 * `--os-accent` CSS variable and persists it to the user profile (the `accent`
 * pref via `@iris-ui/core/profile`), so the choice survives a reload. On mount it
 * reads + re-applies the saved value. Self-contained — no shell wiring beyond the
 * shared profile.
 */
import { computed, onMounted } from 'vue'
import { IrisBadge } from '@iris-ui/vue'
import { useProfile, useProfileState } from '../profile'

const ACCENT_PREF = 'accent'

interface Swatch {
  id: string
  label: string
  color: string
}

const SWATCHES: Swatch[] = [
  { id: 'win-blue', label: 'Windows Blue', color: '#0067c0' },
  { id: 'violet', label: 'Violet', color: '#7c5cff' },
  { id: 'emerald', label: 'Emerald', color: '#10b981' },
  { id: 'rose', label: 'Rose', color: '#e11d48' },
  { id: 'amber', label: 'Amber', color: '#f59e0b' },
  { id: 'cyan', label: 'Cyan', color: '#0891b2' },
]

const profile = useProfile()
const profileState = useProfileState()

/** The currently-selected accent, read live from the profile prefs. */
const accent = computed<string>(
  () => (profileState.value.prefs[ACCENT_PREF] as string | undefined) ?? SWATCHES[0].color,
)

function applyAccent(color: string): void {
  document.documentElement.style.setProperty('--os-accent', color)
}

function pick(color: string): void {
  applyAccent(color)
  profile.setPref(ACCENT_PREF, color)
}

// Re-apply the persisted accent on mount so a reload restores the user's choice.
onMounted(() => {
  const saved = profileState.value.prefs[ACCENT_PREF] as string | undefined
  if (saved) applyAccent(saved)
})
</script>

<template>
  <div class="pane">
    <h3 style="margin: 0">Appearance</h3>
    <p style="margin: 0; opacity: 0.7">
      Pick an accent color. It applies instantly to the live <code>--os-accent</code> CSS variable —
      the taskbar, buttons, and window highlights follow — and is saved to your profile, so it
      survives a reload. (This Vue build ships a single Win11 skin; the React demo also switches the
      whole OS look.)
    </p>
    <div class="swatches">
      <button
        v-for="s in SWATCHES"
        :key="s.id"
        type="button"
        class="swatch"
        :class="{ active: accent === s.color }"
        :aria-pressed="accent === s.color"
        @click="pick(s.color)"
      >
        <span class="swatch-dot" :style="{ background: s.color }" />
        <span class="swatch-label">{{ s.label }}</span>
        <IrisBadge v-if="accent === s.color" tone="primary" variant="solid">active</IrisBadge>
      </button>
    </div>
  </div>
</template>

<style scoped>
.pane {
  padding: 20px;
  display: grid;
  gap: 14px;
  line-height: 1.6;
  color: var(--os-window-fg);
}
.swatches {
  display: grid;
  gap: 10px;
}
.swatch {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  border: 1px solid rgba(127, 127, 127, 0.3);
  background: transparent;
  color: inherit;
}
.swatch.active {
  border: 2px solid var(--os-accent);
  background: color-mix(in srgb, var(--os-accent) 12%, transparent);
}
.swatch-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.5);
}
.swatch-label {
  flex: 1;
  font-weight: 600;
}
</style>
