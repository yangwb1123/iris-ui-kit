<script setup lang="ts">
// SolidIsland — mounts a single @iris-ui/solid primitive into its own root via the
// Solid client API (`render(() => <Comp/>, el)` from solid-js/web). Same role as
// ReactIsland for the `solid` framework tab.
//
// The foreign runtime (@iris-ui/solid + solid-js/web) is loaded with a DYNAMIC
// import inside onMounted — never at module top — so it stays out of VitePress's
// SSR build graph entirely (solid-js/web's server build throws if a client-only API
// is reached during SSR). Combined with the caller's <ClientOnly>, the Solid runtime
// only ever runs in the browser.
//
// Solid component props are captured at create time (no Vue-style reactive bridge),
// so on any prop change we dispose the old root and render a fresh one. Children are
// passed as the `children` prop (a plain string), matching how the Solid adapters
// read `props.children`.
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  name: string
  componentProps: Record<string, unknown>
  childText?: string
}>()
const emit = defineEmits<{ (e: 'unrenderable'): void }>()

const host = ref<HTMLDivElement | null>(null)
let dispose: (() => void) | null = null
// Lazily-loaded runtime handles (browser only).
let SolidIris: Record<string, unknown> | null = null
let solidRender: ((code: () => unknown, el: Element) => () => void) | null = null
let ready = false

function teardown() {
  if (dispose) {
    dispose()
    dispose = null
  }
}

function draw() {
  if (!ready || !host.value || !SolidIris || !solidRender) return
  const Comp = SolidIris[props.name] as ((p: unknown) => unknown) | undefined
  if (!Comp) {
    emit('unrenderable')
    return
  }
  teardown()
  try {
    const p: Record<string, unknown> = { ...props.componentProps }
    if (props.childText) p.children = props.childText
    dispose = solidRender(() => (Comp as (x: unknown) => unknown)(p), host.value!)
  } catch {
    emit('unrenderable')
  }
}

onMounted(async () => {
  try {
    const [iris, web] = await Promise.all([import('@iris-ui/solid'), import('solid-js/web')])
    SolidIris = iris as Record<string, unknown>
    solidRender = web.render as never
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
  <div ref="host" class="iris-island iris-island--solid"></div>
</template>
