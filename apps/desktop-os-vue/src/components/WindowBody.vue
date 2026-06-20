<script setup lang="ts">
import { computed } from 'vue'
import { getManifest } from '../catalog'

/**
 * Renders the body of a managed window for an app id — a `component` app mounts
 * its Vue view; an `iframe` app embeds its URL (with an always-available "Open in
 * new tab" escape hatch, since sites that refuse embedding render blank under
 * X-Frame-Options / CSP). Mirrors the React Window's body switch.
 */
const props = defineProps<{ appId: string }>()

const app = computed(() => getManifest(props.appId))
const isIframe = computed(() => app.value?.kind === 'iframe' && Boolean(app.value.url))

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener')
}
</script>

<template>
  <div v-if="!app" style="padding: 16px">Unknown app: {{ appId }}</div>
  <div v-else-if="isIframe" class="iframe-wrap">
    <iframe
      :src="app.url"
      :title="app.url"
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
      class="iframe-frame"
    />
    <div class="iframe-hint">
      <span style="flex: 1; opacity: 0.75"
        >If this stays blank, the site disallows embedding —</span
      >
      <button type="button" class="iframe-open" @click="openExternal(app.url!)">
        Open in new tab
      </button>
    </div>
  </div>
  <component :is="app.component" v-else-if="app.component" />
  <div v-else style="padding: 16px">{{ app.name }} has no view.</div>
</template>

<style scoped>
.iframe-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.iframe-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.iframe-hint {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
  background: color-mix(in srgb, var(--os-window-bg) 88%, transparent);
  color: var(--os-window-fg);
  border: 1px solid rgba(127, 127, 127, 0.3);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  backdrop-filter: var(--os-blur);
  -webkit-backdrop-filter: var(--os-blur);
}
.iframe-open {
  border: 1px solid var(--os-accent);
  background: var(--os-accent);
  color: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
</style>
