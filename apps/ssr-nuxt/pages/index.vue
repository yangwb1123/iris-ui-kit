<template>
  <header style="margin-bottom: 28px">
    <IrisBadge tone="primary" variant="solid">SSR + hydration</IrisBadge>
    <h1 style="margin: 12px 0 6px; font-size: 28px">Iris UI Nuxt reference</h1>
    <p style="margin: 0; color: var(--iris-muted-foreground)">
      A file-routed Nuxt application. This page is rendered on the server, then its Iris controls
      hydrate into an interactive experience.
    </p>
  </header>
  <HydrationDemo />
</template>

<script setup lang="ts">
import { IrisBadge } from '@iris-ui-kit/vue'
</script>
