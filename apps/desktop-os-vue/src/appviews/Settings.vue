<script setup lang="ts">
/**
 * A genuine, portable Settings pane. Two appearance controls plus privacy:
 *  - an OS-SKIN picker (Win11 / macOS) — switches the whole desktop chrome (top
 *    menu bar, bottom dock, spotlight, traffic-lights) AND its token palette live,
 *    persisted to the profile (`os` pref) so it survives a reload. Mirrors the
 *    React demo's Appearance pane.
 *  - an ACCENT-COLOR picker: applies the chosen color to the live `--os-accent`
 *    CSS variable and persists it (the `accent` pref).
 * Both read + re-apply on mount. Self-contained — no shell wiring beyond the
 * shared profile + the `useOs` skin state.
 */
import { computed, onMounted } from 'vue'
import { IrisBadge, IrisButton } from '@iris-ui/vue'
import { useProfile, useProfileState, useApps } from '../profile'
import { useOs } from '../os-state'
import { OS_ORDER, CHROMES } from '../os'
import { PERMISSION_META, useGrants } from '../permissions'

// ── OS skin ───────────────────────────────────────────────────────────────────
const { os, setOs } = useOs()

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

// ── Privacy & permissions ───────────────────────────────────────────────────
// Every surfaced app (built-in + installed + custom). Exposing them all keeps the
// model honest and lets users tighten even built-ins. Mirrors React's Privacy UI.
const apps = useApps()
const { isGranted, grant, revoke } = useGrants()
</script>

<template>
  <div class="pane">
    <h3 style="margin: 0">OS skin</h3>
    <p style="margin: 0; opacity: 0.7">
      Switch the desktop skin. The window manager and every open window stay exactly the same — only
      the chrome changes: macOS gets a top menu bar, a bottom dock, Spotlight, and left
      traffic-lights; Windows 11 gets the taskbar + Start menu. Your choice is saved to your profile
      and survives a reload.
    </p>
    <div class="swatches">
      <button
        v-for="id in OS_ORDER"
        :key="id"
        type="button"
        class="swatch"
        :class="{ active: os === id }"
        :aria-pressed="os === id"
        @click="setOs(id)"
      >
        <span
          class="os-preview"
          aria-hidden="true"
          :style="{ background: CHROMES[id].vars['--os-wallpaper'] }"
        />
        <span class="swatch-label">
          {{ CHROMES[id].label }}
          <br />
          <span style="font-size: 12px; opacity: 0.65; font-weight: 400">
            controls {{ CHROMES[id].controls }} · {{ CHROMES[id].bottomBar }} ·
            {{ CHROMES[id].launcher }}
          </span>
        </span>
        <IrisBadge v-if="os === id" tone="primary" variant="solid">active</IrisBadge>
      </button>
    </div>

    <h3 style="margin: 0">Accent color</h3>
    <p style="margin: 0; opacity: 0.7">
      Pick an accent color. It applies instantly to the live <code>--os-accent</code> CSS variable —
      the taskbar, buttons, and window highlights follow — and is saved to your profile, so it
      survives a reload.
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

    <h3 style="margin: 0">Privacy &amp; permissions</h3>
    <p style="margin: 0; opacity: 0.7">
      Each app declares the capabilities it wants. Grant or revoke them per app — your choices
      persist in your profile. (Enforcement is advisory in this demo; the transparent contract is
      the point.)
    </p>
    <div class="perm-apps">
      <div v-for="app in apps" :key="app.id" class="perm-app">
        <div class="perm-app-head">
          <span class="perm-app-icon">{{ app.icon }}</span>
          <strong class="perm-app-name">{{ app.name }}</strong>
          <IrisBadge v-if="app.custom" tone="primary" variant="subtle" size="sm">Yours</IrisBadge>
        </div>
        <span v-if="!app.permissions?.length" class="perm-none">No permissions requested.</span>
        <div v-else class="perm-rows">
          <div
            v-for="perm in app.permissions"
            :key="perm"
            class="perm-row"
            :title="PERMISSION_META[perm].description"
          >
            <span class="perm-row-icon" aria-hidden="true">{{ PERMISSION_META[perm].icon }}</span>
            <span class="perm-row-text">
              <strong>{{ PERMISSION_META[perm].label }}</strong>
              <br />
              <span class="perm-row-desc">{{ PERMISSION_META[perm].description }}</span>
            </span>
            <IrisBadge v-if="isGranted(app.id, perm)" tone="success" variant="subtle" size="sm"
              >Granted</IrisBadge
            >
            <IrisBadge v-else tone="neutral" variant="subtle" size="sm">Blocked</IrisBadge>
            <IrisButton
              :variant="isGranted(app.id, perm) ? 'outline' : 'solid'"
              size="sm"
              @click="isGranted(app.id, perm) ? revoke(app.id, perm) : grant(app.id, perm)"
            >
              {{ isGranted(app.id, perm) ? 'Revoke' : 'Grant' }}
            </IrisButton>
          </div>
        </div>
      </div>
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
.os-preview {
  width: 44px;
  height: 30px;
  border-radius: 6px;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.4);
}
.swatch-label {
  flex: 1;
  font-weight: 600;
}
.perm-apps {
  display: grid;
  gap: 10px;
}
.perm-app {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid rgba(127, 127, 127, 0.25);
  background: color-mix(in srgb, var(--os-window-fg) 4%, transparent);
}
.perm-app-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.perm-app-icon {
  font-size: 18px;
}
.perm-app-name {
  font-size: 13px;
  flex: 1;
}
.perm-none {
  font-size: 12px;
  opacity: 0.6;
}
.perm-rows {
  display: grid;
  gap: 6px;
}
.perm-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.perm-row-icon {
  font-size: 15px;
}
.perm-row-text {
  flex: 1;
  min-width: 0;
  font-size: 12px;
}
.perm-row-desc {
  font-size: 11px;
  opacity: 0.6;
}
</style>
