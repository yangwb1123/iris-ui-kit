<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { IrisButton, useSkin, type Skin, type SkinManifestEntry } from '@iris-ui-kit/vue'
import { demoCatalog, sampleSkinJson, STORAGE_KEY } from '../demo-skins'

const {
  skin,
  setSkin,
  setMode,
  getMode,
  getActiveId,
  availableSkins,
  loadSkin,
  useFromCatalog,
  patch,
  resetPatch,
} = useSkin()

const skins = computed(() => availableSkins())
const customEntries = computed(() => Object.entries(skin.value.custom))

// The engine is the single source of truth: the logical selection (pre
// system-variant remap) and mode drive the gallery, header picker, and toggle.
// Read through `skin` so these recompute whenever the resolved skin changes.
const activeId = computed(() => {
  void skin.value.id
  return getActiveId()
})
const following = computed(() => {
  void skin.value.id
  return getMode() === 'system'
})

const editorColors = ['iris.primary', 'iris.background', 'iris.accent'] as const

function hex(value: string | undefined): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#888888'
}
function swatchColor(s: Skin, token: string): string {
  const v = s.tokens?.[token as keyof NonNullable<Skin['tokens']>]
  return typeof v === 'string' ? v : 'var(--iris-muted)'
}

// Picking 'auto' follows the system; any other id pins a fixed skin.
function selectSkin(id: string) {
  if (id === 'auto') setMode('system')
  else setMode('fixed')
  setSkin(id)
}
function toggleFollow(e: Event) {
  selectSkin((e.target as HTMLInputElement).checked ? 'auto' : 'light')
}

// Live editor
function setColor(token: string, e: Event) {
  patch({ tokens: { [token]: (e.target as HTMLInputElement).value } as Skin['tokens'] })
}
function setRadius(e: Event) {
  patch({ tokens: { 'iris.radius.md': Number((e.target as HTMLInputElement).value) } })
}

// Catalog
const entries = ref<SkinManifestEntry[]>([])
const installing = ref<string | null>(null)
const installed = ref<string[]>([])
const installError = ref<string | null>(null)
onMounted(async () => {
  try {
    entries.value = await demoCatalog.load()
  } catch {
    entries.value = []
  }
})
async function install(id: string) {
  installing.value = id
  installError.value = null
  try {
    await useFromCatalog(id)
    if (!installed.value.includes(id)) installed.value = [...installed.value, id]
  } catch (e) {
    installError.value = e instanceof Error ? e.message : String(e)
  } finally {
    installing.value = null
  }
}

// Load from JSON
const jsonText = ref(sampleSkinJson)
const loadError = ref<string | null>(null)
async function loadFromJson() {
  loadError.value = null
  try {
    await loadSkin(JSON.parse(jsonText.value) as Skin)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

// Persistence — refresh the displayed stored value whenever the selection changes.
const stored = ref<string | null>(null)
function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
watch(
  () => skin.value.id,
  () => (stored.value = readStored()),
  { immediate: true },
)
</script>

<template>
  <div class="skins-view">
    <!-- Active skin + custom-token visuals -->
    <section class="section">
      <h2 class="section-title">Active skin</h2>
      <div class="skin-hero">
        <div class="skin-hero-name">{{ skin.name }}</div>
        <div class="skin-hero-meta">id: {{ skin.id }} · type: {{ skin.type }}</div>
      </div>
      <div class="skin-facts">
        <div>
          <div class="muted">lineage (base → leaf)</div>
          <div class="mono">{{ skin.lineage.join(' → ') }}</div>
        </div>
        <div>
          <div class="muted">custom tokens</div>
          <div v-if="customEntries.length === 0" class="mono">— none —</div>
          <div v-for="[k, v] in customEntries" :key="k" class="mono">
            {{ k }}: <span class="muted-inline">{{ v }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Gallery -->
    <section class="section">
      <h2 class="section-title">Skin gallery</h2>
      <p class="muted lead">
        Built-in <code>light</code>/<code>dark</code> base skins plus presets composed via
        <code>extends</code> + token overrides. Click to switch.
      </p>
      <div class="skin-grid">
        <button
          v-for="s in skins"
          :key="s.id"
          type="button"
          class="skin-card"
          :class="{ active: s.id === activeId }"
          :aria-pressed="s.id === activeId"
          @click="selectSkin(s.id)"
        >
          <div class="skin-swatches">
            <span
              v-for="t in ['iris.primary', 'iris.accent', 'iris.background']"
              :key="t"
              class="skin-swatch"
              :style="{ background: swatchColor(s, t) }"
            />
          </div>
          <div class="skin-card-name">{{ s.name ?? s.id }}</div>
          <div class="muted">
            {{ s.id }}<template v-if="s.extends"> · extends {{ String(s.extends) }}</template>
          </div>
        </button>
      </div>
    </section>

    <!-- Follow system -->
    <section class="section">
      <h2 class="section-title">Follow system</h2>
      <label class="follow-row">
        <input type="checkbox" :checked="following" @change="toggleFollow" />
        <span>
          Follow OS light/dark — uses the <code>auto</code> skin&rsquo;s <code>variants</code> ({
          light: sunrise, dark: ocean }) via <code>prefers-color-scheme</code>.
        </span>
      </label>
      <p class="muted">Toggle your OS appearance to see the resolved skin flip live.</p>
    </section>

    <!-- Live token editor -->
    <section class="section">
      <h2 class="section-title">Live token editor (non-destructive patch)</h2>
      <p class="muted lead">
        Edits overlay the active skin via <code>patch()</code> without mutating the registered skin
        — <code>resetPatch()</code> clears them.
      </p>
      <div class="editor-row">
        <label v-for="token in editorColors" :key="token" class="editor-field">
          <span class="mono">{{ token }}</span>
          <input
            type="color"
            :value="hex(skin.theme.colors[token])"
            @input="setColor(token, $event)"
          />
        </label>
        <label class="editor-field">
          <span class="mono">iris.radius.md: {{ skin.theme.radii['iris.radius.md'] }}px</span>
          <input
            type="range"
            min="0"
            max="24"
            :value="skin.theme.radii['iris.radius.md']"
            @input="setRadius"
          />
        </label>
        <IrisButton variant="outline" size="sm" @click="resetPatch()">Reset edits</IrisButton>
      </div>
    </section>

    <!-- Marketplace catalog -->
    <section class="section">
      <h2 class="section-title">Marketplace catalog</h2>
      <p class="muted lead">
        A manifest + skin documents served by an injected <code>fetch</code> (no server).
        &ldquo;Install&rdquo; lazy-fetches, validates, registers, and applies the skin.
      </p>
      <div v-if="entries.length === 0" class="muted">Loading catalog…</div>
      <div v-else class="catalog-row">
        <div v-for="e in entries" :key="e.id" class="catalog-item">
          <div>
            <div class="skin-card-name">{{ e.name ?? e.id }}</div>
            <div class="muted">{{ e.id }}</div>
          </div>
          <IrisButton size="sm" :disabled="installing === e.id" @click="install(e.id)">
            {{
              installing === e.id
                ? 'Installing…'
                : installed.includes(e.id)
                  ? 'Use again'
                  : 'Install'
            }}
          </IrisButton>
        </div>
      </div>
      <p v-if="installError" class="mono error">{{ installError }}</p>
    </section>

    <!-- Load from JSON -->
    <section class="section">
      <h2 class="section-title">Load a skin from JSON</h2>
      <p class="muted lead">
        Paste a skin document — <code>loadSkin()</code> validates it before applying.
      </p>
      <textarea v-model="jsonText" class="json-input" rows="10" spellcheck="false" />
      <div class="load-row">
        <IrisButton size="sm" @click="loadFromJson">Load skin</IrisButton>
        <span v-if="loadError" class="mono error">{{ loadError }}</span>
      </div>
    </section>

    <!-- Persistence -->
    <section class="section">
      <h2 class="section-title">Persistence</h2>
      <p class="muted lead">
        The selection is saved to <code>localStorage["{{ STORAGE_KEY }}"]</code> and restored on
        reload (FOUC-safe via <code>skinBootScript</code> in production).
      </p>
      <div class="mono">stored value: {{ stored ?? '—' }}</div>
    </section>
  </div>
</template>

<style scoped>
.skins-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.mono {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
.muted {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: var(--iris-muted);
}
.muted-inline {
  color: var(--iris-muted);
}
.lead {
  margin-top: 0;
}
.skin-hero {
  border-radius: 12px;
  padding: 20px;
  color: #fff;
  background: var(--brand-gradient, var(--iris-primary));
  box-shadow: var(--brand-shadow, none);
}
.skin-hero-name {
  font-size: 20px;
  font-weight: 700;
}
.skin-hero-meta {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  opacity: 0.9;
}
.skin-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-top: 16px;
}
.skin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.skin-card {
  text-align: left;
  cursor: pointer;
  padding: 12px;
  border-radius: 10px;
  background: var(--iris-background);
  border: 2px solid var(--iris-border);
  font: inherit;
  color: var(--iris-foreground);
}
.skin-card.active {
  border-color: var(--iris-primary);
}
.skin-swatches {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.skin-swatch {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid var(--iris-border);
}
.skin-card-name {
  font-weight: 600;
  font-size: 13px;
}
.follow-row {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.editor-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-end;
}
.editor-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.catalog-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.catalog-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  background: var(--iris-background);
  border: 1px solid var(--iris-border);
}
.json-input {
  width: 100%;
  box-sizing: border-box;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--iris-border);
  background: var(--iris-background);
  color: var(--iris-foreground);
  resize: vertical;
}
.load-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}
.error {
  color: var(--iris-danger);
}
.error-list {
  margin-top: 10px;
}
</style>
