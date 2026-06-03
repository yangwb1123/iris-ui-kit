<script setup lang="ts">
import { SkinProvider } from '@iris-ui/vue'
import { skinEngine } from './skin'
import Shell from './Shell.vue'
</script>

<template>
  <SkinProvider :engine="skinEngine">
    <Shell />
  </SkinProvider>
</template>
