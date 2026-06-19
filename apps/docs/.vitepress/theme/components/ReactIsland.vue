<script setup lang="ts">
// ReactIsland — mounts a single @iris-ui/react primitive into its own root via the
// React client API (createRoot().render). Used INSIDE the Explorer's live preview
// for the `react` framework tab.
//
// The foreign runtime (@iris-ui/react + react / react-dom/client) is loaded with a
// DYNAMIC import inside onMounted — never at module top — so it stays out of
// VitePress's SSR build graph. Combined with the caller's <ClientOnly>, React only
// ever runs in the browser.
//
// It renders exactly one selected primitive with the live control props (+ optional
// text child), mirroring the Vue live preview. If the component name isn't a
// standalone-renderable React export, mounting throws and we emit `unrenderable` so
// the Explorer falls back to code-only (never crashing the page).
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  name: string
  componentProps: Record<string, unknown>
  childText?: string
}>()
const emit = defineEmits<{ (e: 'unrenderable'): void }>()

const host = ref<HTMLDivElement | null>(null)
// Lazily-loaded runtime handles (browser only).
let ReactIris: Record<string, unknown> | null = null
let createElement: ((type: unknown, props: unknown, ...children: unknown[]) => unknown) | null =
  null
let root: { render: (n: unknown) => void; unmount: () => void } | null = null
let createRootFn: ((el: Element) => typeof root) | null = null
let ready = false

function render() {
  if (!ready || !host.value || !ReactIris || !createElement || !createRootFn) return
  const Comp = ReactIris[props.name] as ((p: unknown) => unknown) | undefined
  if (!Comp) {
    emit('unrenderable')
    return
  }
  try {
    if (!root) root = createRootFn(host.value)
    const child = props.childText ? props.childText : undefined
    root!.render(createElement(Comp, props.componentProps, child))
  } catch {
    emit('unrenderable')
  }
}

onMounted(async () => {
  try {
    const [iris, react, client] = await Promise.all([
      import('@iris-ui/react'),
      import('react'),
      import('react-dom/client'),
    ])
    ReactIris = iris as Record<string, unknown>
    createElement = (react.createElement ?? react.default?.createElement) as never
    createRootFn = client.createRoot as never
    ready = true
    render()
  } catch {
    emit('unrenderable')
  }
})
watch(() => [props.name, props.componentProps, props.childText], render, { deep: true })

onBeforeUnmount(() => {
  if (root) {
    root.unmount()
    root = null
  }
})
</script>

<template>
  <div ref="host" class="iris-island iris-island--react"></div>
</template>
