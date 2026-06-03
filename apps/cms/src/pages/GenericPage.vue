<script setup lang="ts">
import { computed, ref } from 'vue'
import { IrisButton } from '@iris-ui/vue'

const props = defineProps<{ title: string; description?: string }>()

const FALLBACK =
  'A placeholder page rendered inside IrisAdminLayout. Increment the counter, switch to another tab, then come back — the value survives because the content is kept alive, keyed by the tab cache key.'
const text = computed(() => props.description ?? FALLBACK)

// Local state to prove the keep-alive cache preserves a tab across switches.
const count = ref(0)
</script>

<template>
  <section>
    <h1 class="page-title">{{ title }}</h1>
    <p class="page-desc">{{ text }}</p>
    <IrisButton size="sm" variant="outline" @click="count++">Local counter: {{ count }}</IrisButton>
  </section>
</template>
