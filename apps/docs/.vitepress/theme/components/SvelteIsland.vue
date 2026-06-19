<script setup lang="ts">
// SvelteIsland — mounts a single @iris-ui/svelte primitive into its own root via the
// Svelte 5 client API (`mount`/`unmount`). It actually mounts SvelteIslandInner.svelte
// (a tiny wrapper that resolves the primitive by name and supplies a plain-text
// children snippet, which raw `mount` props can't carry). Same role as React/Solid
// islands for the `svelte` tab.
//
// The Svelte runtime + the .svelte island chain are loaded with a DYNAMIC import
// inside onMounted — never at module top — so the SSR build never evaluates them.
// (The VitePress Vite config registers @sveltejs/vite-plugin-svelte so the raw
// `.svelte` source that @iris-ui/svelte ships gets compiled.) Combined with the
// caller's <ClientOnly>, Svelte only ever runs in the browser.
//
// We unmount + re-mount on any prop change (matches the React/Solid islands). If the
// import or mount throws, we emit `unrenderable` so the Explorer falls back to
// code-only instead of breaking the page.
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  name: string
  componentProps: Record<string, unknown>
  childText?: string
}>()
const emit = defineEmits<{ (e: 'unrenderable'): void }>()

const host = ref<HTMLDivElement | null>(null)
// Lazily-loaded runtime handles (browser only).
let svelteMount: ((comp: unknown, opts: unknown) => unknown) | null = null
let svelteUnmount: ((inst: unknown) => void) | null = null
let Inner: unknown = null
let instance: unknown = null
let ready = false

function teardown() {
  if (instance && svelteUnmount) {
    svelteUnmount(instance)
    instance = null
  }
}

function draw() {
  if (!ready || !host.value || !svelteMount || !Inner) return
  teardown()
  try {
    instance = svelteMount(Inner, {
      target: host.value,
      props: {
        name: props.name,
        componentProps: props.componentProps,
        childText: props.childText,
      },
    })
  } catch {
    emit('unrenderable')
  }
}

onMounted(async () => {
  try {
    const [svelte, inner] = await Promise.all([
      import('svelte'),
      import('./SvelteIslandInner.svelte'),
    ])
    svelteMount = svelte.mount as never
    svelteUnmount = svelte.unmount as never
    Inner = inner.default
    ready = true
    draw()
  } catch {
    emit('unrenderable')
  }
})
watch(() => [props.name, props.componentProps, props.childText], draw, { deep: true })
onBeforeUnmount(teardown)
</script>

<template>
  <div ref="host" class="iris-island iris-island--svelte"></div>
</template>
