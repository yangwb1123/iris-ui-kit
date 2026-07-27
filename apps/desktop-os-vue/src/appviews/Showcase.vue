<script setup lang="ts">
import { ref } from 'vue'
import { IrisButton, IrisBadge, IrisInput } from '@iris-ui-kit/vue'

const name = ref('')
</script>

<template>
  <div class="pane">
    <p style="margin: 0">
      Real <code>@iris-ui-kit/vue</code> components, rendered inside a managed window — they inherit
      the OS skin via tokens.
    </p>
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center">
      <IrisButton variant="solid">Solid</IrisButton>
      <IrisButton variant="outline">Outline</IrisButton>
      <IrisButton variant="ghost">Ghost</IrisButton>
    </div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap">
      <IrisBadge tone="primary" variant="solid">primary</IrisBadge>
      <IrisBadge tone="success" variant="subtle">success</IrisBadge>
      <IrisBadge tone="warning" variant="subtle">warning</IrisBadge>
      <IrisBadge tone="danger" variant="subtle">danger</IrisBadge>
    </div>
    <IrisInput v-model="name" placeholder="IrisInput…" />
    <p v-if="name" style="margin: 0">Hello, {{ name }} 👋</p>
  </div>
</template>

<style scoped>
.pane {
  padding: 20px;
  display: grid;
  gap: 14px;
  line-height: 1.6;
}
</style>
