<script setup lang="ts">
// Interactive Component Explorer (ROADMAP v3 R17).
//
// Given a component `name`, this renders three manifest-driven panels:
//  1. CONTROLS — one control per documented prop (a <select> for an enum prop with
//     options = the manifest enum and default = the manifest default; a checkbox
//     for boolean; a number/text input for number/string). Seeded from the
//     manifest defaults.
//  2. LIVE PREVIEW — the real `@iris-ui/vue` component bound to the current control
//     values (VitePress is Vue). Updates reactively. Curated, live-preview-wired
//     components only; others gracefully show controls + code tabs with a note.
//  3. CODE TABS — per-framework (react/vue/solid/svelte) usage for the current
//     control values, generated deterministically from the manifest (same wiring
//     rules as @iris-ui/mcp — see explorer-codegen.ts), each with a copy button.
//
// All three panels read from the SAME committed manifest (EXPLORER_MANIFEST, a
// slim slice emitted by generate-components.mjs), so they can't drift from the
// packages.
//
// LIVE PREVIEW is now 4-framework (ROADMAP v3 final item): the active framework tab
// drives the preview. Vue renders inline (VitePress is Vue); React / Solid / Svelte
// each render via a client-only ISLAND component (ReactIsland / SolidIsland /
// SvelteIsland) that mounts the real `@iris-ui/<fw>` primitive into its own root via
// that runtime's client API (createRoot / render / mount). Islands are gated behind
// <ClientOnly> so the foreign runtimes never run during VitePress SSR; if an island
// can't render a given component it emits `unrenderable` and we fall back to the
// code view for that framework (never crashing the page).
import { computed, ref, shallowRef } from 'vue'
import * as Iris from '@iris-ui/vue'
import { EXPLORER_MANIFEST } from '../explorer-data'
import { PREVIEW_SPECS } from '../explorer-preview'
import ReactIsland from './ReactIsland.vue'
import SolidIsland from './SolidIsland.vue'
import SvelteIsland from './SvelteIsland.vue'
import {
  detectControlledPair,
  snippetFor,
  type Framework,
  type ManifestComponent,
  type ManifestProp,
} from '../explorer-codegen'

const props = defineProps<{ name: string }>()

const FRAMEWORKS: Framework[] = ['react', 'vue', 'solid', 'svelte']

const component = computed<ManifestComponent | undefined>(() =>
  EXPLORER_MANIFEST.find((c) => c.name === props.name),
)
const spec = computed(() => PREVIEW_SPECS[props.name])
const isLive = computed(() => !!spec.value && !!(Iris as Record<string, unknown>)[props.name])

// ---- Which props get a control --------------------------------------------
// If the component has a curated preview spec we honor its control list (so the
// preview only binds cleanly-mappable props); otherwise we expose every documented
// prop that maps to a renderable control (enum / boolean / number / string).
function isControllable(p: ManifestProp): boolean {
  if (p.enum && p.enum.length) return true
  const t = p.type.toLowerCase()
  return /\bboolean\b/.test(t) || /\bnumber\b/.test(t) || /\bstring\b/.test(t)
}

const controlProps = computed<ManifestProp[]>(() => {
  const all = component.value?.props ?? []
  if (spec.value) {
    return spec.value.controls
      .map((n) => all.find((p) => p.name === n))
      .filter((p): p is ManifestProp => !!p)
  }
  return all.filter(isControllable)
})

const controlNames = computed(() => controlProps.value.map((p) => p.name))

// ---- Events / Slots (read-only docs) ---------------------------------------
// The manifest carries `events`/`slots` as bare name lists; an event's
// type/description is the matching prop entry (e.g. `onClick`), so we look it up
// to surface a richer row. Slots are name-only with an optional matching-prop
// description (e.g. the `icon`/`prefix` adornment props).
interface DocRow {
  name: string
  type?: string
  description?: string
}
const eventRows = computed<DocRow[]>(() => {
  const all = component.value?.props ?? []
  return (component.value?.events ?? []).map((name) => {
    const p = all.find((x) => x.name === name)
    return { name, type: p?.type, description: p?.description }
  })
})
const slotRows = computed<DocRow[]>(() => {
  const all = component.value?.props ?? []
  return (component.value?.slots ?? []).map((name) => {
    // `default` is the children slot; named slots often mirror a node prop.
    const p = all.find((x) => x.name === name)
    return { name, description: p?.description }
  })
})

// ---- Control kind ----------------------------------------------------------
function kindOf(p: ManifestProp): 'enum' | 'boolean' | 'number' | 'string' {
  if (p.enum && p.enum.length) return 'enum'
  const t = p.type.toLowerCase()
  if (/\bboolean\b/.test(t)) return 'boolean'
  if (/\bnumber\b/.test(t)) return 'number'
  return 'string'
}

// ---- Seed control values from manifest defaults ----------------------------
function seed(p: ManifestProp): unknown {
  const k = kindOf(p)
  if (p.default !== undefined) {
    if (k === 'boolean') return p.default === 'true'
    if (k === 'number') return p.default === 'null' ? null : Number(p.default)
    if (k === 'enum') return p.default.replace(/^'|'$/g, '')
    return p.default
  }
  if (k === 'boolean') return false
  if (k === 'number') return p.enum ? Number(p.enum[0]) : 0
  if (k === 'enum') return p.enum![0]
  return ''
}

// Reactive control state, keyed by manifest prop name. Re-seeded if `name` changes.
const values = ref<Record<string, unknown>>({})
const childText = ref<string>('')
const initFor = shallowRef<string | null>(null)
// Islands that failed to mount a given (framework, component) — that tab falls back
// to the code view. Reset by ensureInit() on component change. Declared here so
// ensureInit (called at top level below) can reference it without a TDZ error.
const unrenderable = ref<Record<string, boolean>>({})
function markUnrenderable(fw: Framework) {
  unrenderable.value = { ...unrenderable.value, [`${fw}:${props.name}`]: true }
}
function ensureInit() {
  if (initFor.value === props.name) return
  const next: Record<string, unknown> = {}
  for (const p of controlProps.value) next[p.name] = seed(p)
  values.value = next
  childText.value = spec.value?.childText ?? ''
  unrenderable.value = {}
  initFor.value = props.name
}
ensureInit()
const hasChildText = computed(() => !!spec.value?.hasChildText)

// ---- Live preview binding --------------------------------------------------
// Manifest props are React-derived; map them to the Vue adapter prop names for the
// live binding (e.g. the controlled `checked`/`value` props are `modelValue` on
// the Vue side). Skip the controlled-pair handler (not a renderable control) and
// any value the live preview can't bind.
const PreviewComp = computed(() => (Iris as Record<string, unknown>)[props.name])

// Build the live-preview prop object for a given framework. The control `values`
// use manifest (React-derived) names; `bind` remaps the few props an adapter
// renamed (e.g. Vue's `modelValue`, Svelte checkbox's `value`). The controlled-pair
// handler prop is dropped (not a renderable control), as are empty strings.
function bindProps(bind: Record<string, string>): Record<string, unknown> {
  ensureInit()
  if (!component.value) return {}
  const pair = detectControlledPair(component.value)
  const out: Record<string, unknown> = {}
  for (const p of controlProps.value) {
    if (pair && p.name === pair.handler) continue
    let v = values.value[p.name]
    if (kindOf(p) === 'number') v = v === '' || v === null ? undefined : Number(v)
    if (kindOf(p) === 'string' && v === '') continue
    out[(bind[p.name] ?? p.name) as string] = v
  }
  return out
}

// Vue live binding (modelValue etc. via vueBind). The component still renders from
// the prop; toggling a control updates `values`, which flows back here.
const previewProps = computed<Record<string, unknown>>(() => bindProps(spec.value?.vueBind ?? {}))
// Per-framework island bindings (React/Solid/Vue mostly share manifest names; the
// *Bind maps only cover renamed controlled props).
const reactProps = computed<Record<string, unknown>>(() => bindProps(spec.value?.reactBind ?? {}))
const solidProps = computed<Record<string, unknown>>(() => bindProps(spec.value?.solidBind ?? {}))
const svelteProps = computed<Record<string, unknown>>(() => bindProps(spec.value?.svelteBind ?? {}))

// ---- Code tabs -------------------------------------------------------------
const activeFw = ref<Framework>('react')
const code = computed(() => {
  ensureInit()
  if (!component.value) return ''
  return snippetFor(component.value, activeFw.value, {
    values: values.value,
    childText: hasChildText.value ? childText.value : undefined,
    controlledPropNames: controlNames.value,
  })
})

const availableFws = computed<Framework[]>(() =>
  FRAMEWORKS.filter((f) => component.value?.frameworks.includes(f)),
)

// ---- Live preview per framework -------------------------------------------
// An island that fails to mount a component emits `unrenderable` (recorded above);
// that tab then falls back to the code view and never retries into a crash.
function canIsland(fw: Framework): boolean {
  return (
    isLive.value &&
    !!component.value?.frameworks.includes(fw) &&
    !unrenderable.value[`${fw}:${props.name}`]
  )
}
// What to show in the preview panel for the active tab:
//  - 'vue'    → inline Vue <component :is>
//  - 'react' | 'solid' | 'svelte' → the matching ClientOnly island
//  - 'none'   → no live preview available; show the note (code tab still works)
const previewKind = computed<'vue' | Framework | 'none'>(() => {
  if (activeFw.value === 'vue') return isLive.value ? 'vue' : 'none'
  return canIsland(activeFw.value) ? activeFw.value : 'none'
})

const copied = ref(false)
async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* clipboard unavailable (e.g. insecure context) — no-op */
  }
}

function resetControls() {
  initFor.value = null
  ensureInit()
}
</script>

<template>
  <ClientOnly>
    <div v-if="!component" class="iris-explorer iris-explorer--missing">
      Unknown component: <code>{{ name }}</code>
    </div>
    <div v-else class="iris-explorer">
      <div class="iris-explorer__head">
        <strong>{{ name }}</strong>
        <span class="iris-explorer__fw">{{ component.frameworks.join(' · ') }}</span>
        <button class="iris-explorer__reset" type="button" @click="resetControls">Reset</button>
      </div>

      <div class="iris-explorer__body">
        <!-- CONTROLS -->
        <div class="iris-explorer__controls">
          <div class="iris-explorer__panel-title">Controls</div>
          <label v-for="p in controlProps" :key="p.name" class="iris-explorer__control">
            <span class="iris-explorer__label" :title="p.type">{{ p.name }}</span>
            <select
              v-if="p.enum && p.enum.length"
              v-model="values[p.name]"
              class="iris-explorer__select"
            >
              <option v-for="opt in p.enum" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <input
              v-else-if="/\bboolean\b/.test(p.type.toLowerCase())"
              v-model="values[p.name]"
              type="checkbox"
              class="iris-explorer__checkbox"
            />
            <input
              v-else-if="/\bnumber\b/.test(p.type.toLowerCase())"
              v-model.number="values[p.name]"
              type="number"
              class="iris-explorer__input"
            />
            <input v-else v-model="values[p.name]" type="text" class="iris-explorer__input" />
          </label>
          <label v-if="hasChildText" class="iris-explorer__control">
            <span class="iris-explorer__label">children</span>
            <input v-model="childText" type="text" class="iris-explorer__input" />
          </label>

          <!-- EVENTS (read-only) -->
          <div v-if="eventRows.length" class="iris-explorer__meta">
            <div class="iris-explorer__panel-title">Events</div>
            <div v-for="ev in eventRows" :key="ev.name" class="iris-explorer__meta-row">
              <code class="iris-explorer__meta-name">{{ ev.name }}</code>
              <span v-if="ev.type" class="iris-explorer__meta-type" :title="ev.type">{{
                ev.type
              }}</span>
              <span v-if="ev.description" class="iris-explorer__meta-desc">{{
                ev.description
              }}</span>
            </div>
          </div>

          <!-- SLOTS (read-only) -->
          <div v-if="slotRows.length" class="iris-explorer__meta">
            <div class="iris-explorer__panel-title">Slots</div>
            <div v-for="sl in slotRows" :key="sl.name" class="iris-explorer__meta-row">
              <code class="iris-explorer__meta-name">{{ sl.name }}</code>
              <span v-if="sl.description" class="iris-explorer__meta-desc">{{
                sl.description
              }}</span>
            </div>
          </div>
        </div>

        <!-- LIVE PREVIEW — follows the active framework tab -->
        <div class="iris-explorer__preview">
          <div class="iris-explorer__panel-title">
            Live preview <small>({{ activeFw }})</small>
          </div>
          <div class="iris-explorer__stage">
            <!-- Vue: inline (VitePress is Vue) -->
            <component :is="PreviewComp" v-if="previewKind === 'vue'" v-bind="previewProps">
              <template v-if="hasChildText">{{ childText }}</template>
            </component>
            <!-- React / Solid / Svelte: client-only foreign-runtime islands -->
            <ClientOnly v-else-if="previewKind === 'react'">
              <ReactIsland
                :name="name"
                :component-props="reactProps"
                :child-text="hasChildText ? childText : undefined"
                @unrenderable="markUnrenderable('react')"
              />
            </ClientOnly>
            <ClientOnly v-else-if="previewKind === 'solid'">
              <SolidIsland
                :name="name"
                :component-props="solidProps"
                :child-text="hasChildText ? childText : undefined"
                @unrenderable="markUnrenderable('solid')"
              />
            </ClientOnly>
            <ClientOnly v-else-if="previewKind === 'svelte'">
              <SvelteIsland
                :name="name"
                :component-props="svelteProps"
                :child-text="hasChildText ? childText : undefined"
                @unrenderable="markUnrenderable('svelte')"
              />
            </ClientOnly>
            <p v-else class="iris-explorer__note">
              No live <code>{{ activeFw }}</code> preview for this component — see the code below.
            </p>
          </div>
        </div>
      </div>

      <!-- CODE TABS -->
      <div class="iris-explorer__code">
        <div class="iris-explorer__tabs">
          <button
            v-for="f in availableFws"
            :key="f"
            type="button"
            class="iris-explorer__tab"
            :class="{ 'is-active': activeFw === f }"
            @click="activeFw = f"
          >
            {{ f }}
          </button>
          <button class="iris-explorer__copy" type="button" @click="copyCode">
            {{ copied ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <pre class="iris-explorer__pre"><code>{{ code }}</code></pre>
      </div>
    </div>
  </ClientOnly>
</template>

<style>
.iris-explorer {
  margin: 16px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
.iris-explorer--missing {
  padding: 16px;
  color: var(--vp-c-danger-1, #d33);
}
.iris-explorer__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 14px;
}
.iris-explorer__fw {
  color: var(--vp-c-text-2);
  font-size: 12px;
}
.iris-explorer__reset {
  margin-left: auto;
  font-size: 12px;
  padding: 2px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  cursor: pointer;
}
.iris-explorer__body {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
}
@media (max-width: 640px) {
  .iris-explorer__body {
    grid-template-columns: 1fr;
  }
}
.iris-explorer__controls {
  padding: 14px;
  border-right: 1px solid var(--vp-c-divider);
}
@media (max-width: 640px) {
  .iris-explorer__controls {
    border-right: none;
    border-bottom: 1px solid var(--vp-c-divider);
  }
}
.iris-explorer__panel-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
  margin-bottom: 10px;
}
.iris-explorer__control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}
.iris-explorer__label {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-1);
}
.iris-explorer__select,
.iris-explorer__input {
  flex: 0 0 auto;
  min-width: 120px;
  padding: 3px 6px;
  font-size: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.iris-explorer__checkbox {
  width: 16px;
  height: 16px;
}
.iris-explorer__meta {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
}
.iris-explorer__meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12px;
}
.iris-explorer__meta-name {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 1px 5px;
}
.iris-explorer__meta-type {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: var(--vp-c-text-2);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.iris-explorer__meta-desc {
  flex-basis: 100%;
  color: var(--vp-c-text-2);
  font-size: 12px;
}
.iris-explorer__preview {
  padding: 14px;
}
.iris-explorer__stage {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  min-height: 80px;
  padding: 16px;
  border-radius: 8px;
  background: var(--iris-surface, var(--vp-c-bg));
  color: var(--iris-foreground, inherit);
}
.iris-explorer__note {
  color: var(--vp-c-text-2);
  font-size: 13px;
  margin: 0;
}
.iris-explorer__code {
  border-top: 1px solid var(--vp-c-divider);
}
.iris-explorer__tabs {
  display: flex;
  gap: 2px;
  padding: 6px 10px 0;
  align-items: center;
}
.iris-explorer__tab {
  padding: 5px 12px;
  font-size: 12px;
  font-family: var(--vp-font-family-mono);
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
}
.iris-explorer__tab.is-active {
  background: var(--vp-c-bg);
  border-color: var(--vp-c-divider);
  color: var(--vp-c-text-1);
}
.iris-explorer__copy {
  margin-left: auto;
  font-size: 12px;
  padding: 4px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.iris-explorer__pre {
  margin: 0;
  padding: 14px;
  overflow-x: auto;
  background: var(--vp-c-bg);
  font-size: 12.5px;
  line-height: 1.5;
}
.iris-explorer__pre code {
  font-family: var(--vp-font-family-mono);
  white-space: pre;
}
</style>
