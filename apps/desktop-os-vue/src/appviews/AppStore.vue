<script setup lang="ts">
import { computed, ref } from 'vue'
import { IrisButton, IrisBadge, IrisInput } from '@iris-ui/vue'
import { CATALOG, INSTALLABLE_APPS, type AppManifest } from '../catalog'
import {
  useProfile,
  useProfileState,
  useCustomApps,
  addCustomApp,
  removeCustomApp,
  launchApp,
} from '../profile'

/**
 * App Store — browse the catalog and install link / iframe apps into the user
 * profile (persisted to this device). Add ANY external service via "Add a web
 * app"; manage them under "My apps". Built-in component apps are shown for
 * reference but can't be removed. The Vue twin of the React demo's AppStore.
 */

const KIND_LABEL: Record<AppManifest['kind'], string> = {
  component: 'Built-in',
  link: 'Link',
  iframe: 'Embed',
  remote: 'Remote',
}
const KIND_TONE: Record<AppManifest['kind'], 'primary' | 'success' | 'warning'> = {
  component: 'primary',
  link: 'success',
  iframe: 'warning',
  remote: 'warning',
}

const profile = useProfile()
// Subscribe so install/uninstall re-renders button + list state.
const state = useProfileState()

const customApps = useCustomApps()
const links = INSTALLABLE_APPS.filter((a) => a.kind === 'link')
const iframes = INSTALLABLE_APPS.filter((a) => a.kind === 'iframe')
const builtins = CATALOG.filter((a) => a.builtin)

function isInstalled(app: AppManifest): boolean {
  void state.value.installed // dependency: re-derive on install/uninstall
  return Boolean(app.builtin) || profile.isInstalled(app.id)
}

// ── Add-a-web-app form ──────────────────────────────────────────────────────
const name = ref('')
const url = ref('')
const icon = ref('')
const kind = ref<'link' | 'iframe'>('iframe')
const canAdd = computed(() => url.value.trim().length > 0)

function submit() {
  if (!canAdd.value) return
  const manifest = addCustomApp({
    name: name.value,
    url: url.value,
    kind: kind.value,
    icon: icon.value,
  })
  // Install so it shows up across launchers immediately (custom apps are removable).
  profile.install(manifest.id)
  name.value = ''
  url.value = ''
  icon.value = ''
}
</script>

<template>
  <div class="store">
    <header class="store-head">
      <h2 style="margin: 0">App Store</h2>
      <p class="muted">
        Install apps into your profile (persisted to this device). Link &amp; iframe apps aggregate
        external services — most major sites block iframe embedding, so those open in a new tab
        instead. Runs on the same <code>@iris-ui/core/profile</code> store as the React demo.
      </p>
    </header>

    <!-- Add a web app -->
    <section class="add-form">
      <div style="display: grid; gap: 4px">
        <strong style="font-size: 14px">Add a web app</strong>
        <p class="muted" style="margin: 0">
          Aggregate any service by URL. It appears across the desktop (Start menu, taskbar, command
          palette).
        </p>
      </div>
      <form class="form-grid" @submit.prevent="submit">
        <div class="fields">
          <label class="field"
            >Name
            <IrisInput v-model="name" placeholder="My Service" />
          </label>
          <label class="field"
            >URL
            <IrisInput v-model="url" placeholder="https://example.com" />
          </label>
          <label class="field"
            >Icon (emoji)
            <IrisInput v-model="icon" placeholder="🔗" />
          </label>
          <label class="field"
            >How it opens
            <div style="display: flex; gap: 6px">
              <button
                v-for="k in ['iframe', 'link'] as const"
                :key="k"
                type="button"
                class="kind-btn"
                :class="{ 'kind-btn--on': kind === k }"
                @click="kind = k"
              >
                {{ k === 'iframe' ? '🪟 Embed' : '🔗 New tab' }}
              </button>
            </div>
          </label>
        </div>
        <div>
          <IrisButton type="submit" variant="solid" :disabled="!canAdd">Add to desktop</IrisButton>
        </div>
      </form>
    </section>

    <!-- My apps -->
    <section v-if="customApps.length" class="section">
      <h3 class="section-title">My apps</h3>
      <div class="cards">
        <div v-for="app in customApps" :key="app.id" class="card">
          <div class="card-icon">{{ app.icon }}</div>
          <div class="card-body">
            <div class="card-head">
              <strong>{{ app.name }}</strong>
              <IrisBadge :tone="KIND_TONE[app.kind]" variant="subtle" size="sm">{{
                KIND_LABEL[app.kind]
              }}</IrisBadge>
              <IrisBadge tone="primary" variant="subtle" size="sm">Yours</IrisBadge>
            </div>
            <p v-if="app.description" class="muted card-desc">{{ app.description }}</p>
            <div class="card-actions">
              <IrisButton variant="solid" @click="launchApp(app.id)">Open</IrisButton>
              <IrisButton variant="outline" @click="removeCustomApp(app.id)">Remove</IrisButton>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Installable sections -->
    <section
      v-for="grp in [
        { title: 'Embedded apps', apps: iframes },
        { title: 'Web links', apps: links },
        { title: 'Built-in', apps: builtins },
      ]"
      :key="grp.title"
      class="section"
    >
      <h3 v-if="grp.apps.length" class="section-title">{{ grp.title }}</h3>
      <div v-if="grp.apps.length" class="cards">
        <div v-for="app in grp.apps" :key="app.id" class="card">
          <div class="card-icon">{{ app.icon }}</div>
          <div class="card-body">
            <div class="card-head">
              <strong>{{ app.name }}</strong>
              <IrisBadge :tone="KIND_TONE[app.kind]" variant="subtle" size="sm">{{
                KIND_LABEL[app.kind]
              }}</IrisBadge>
            </div>
            <p v-if="app.description" class="muted card-desc">{{ app.description }}</p>
            <div class="card-actions">
              <IrisBadge v-if="app.builtin" tone="neutral" variant="subtle" size="sm"
                >Built-in</IrisBadge
              >
              <template v-else-if="isInstalled(app)">
                <IrisButton variant="solid" @click="launchApp(app.id)">Open</IrisButton>
                <IrisButton variant="outline" @click="profile.uninstall(app.id)"
                  >Uninstall</IrisButton
                >
              </template>
              <IrisButton v-else variant="solid" @click="profile.install(app.id)"
                >Install</IrisButton
              >
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.store {
  padding: 18px;
  display: grid;
  gap: 20px;
  color: var(--os-window-fg);
}
.store-head {
  display: grid;
  gap: 6px;
}
.muted {
  font-size: 12px;
  opacity: 0.7;
  line-height: 1.5;
}
.add-form {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  border: 1px dashed rgba(127, 127, 127, 0.4);
  background: color-mix(in srgb, var(--os-accent) 6%, transparent);
}
.form-grid {
  display: grid;
  gap: 10px;
}
.fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}
.field {
  font-size: 12px;
  opacity: 0.85;
  display: grid;
  gap: 4px;
}
.kind-btn {
  flex: 1;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  color: inherit;
  border: 1px solid rgba(127, 127, 127, 0.3);
  background: transparent;
}
.kind-btn--on {
  border: 2px solid var(--os-accent);
  background: color-mix(in srgb, var(--os-accent) 14%, transparent);
}
.section {
  display: grid;
  gap: 10px;
}
.section-title {
  margin: 0;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.6;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.card {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid rgba(127, 127, 127, 0.25);
  background: color-mix(in srgb, var(--os-window-fg) 4%, transparent);
}
.card-icon {
  font-size: 30px;
  line-height: 1;
  text-align: center;
}
.card-body {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.card-desc {
  margin: 0;
}
.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 2px;
}
</style>
