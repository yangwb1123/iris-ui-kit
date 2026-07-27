<script setup lang="ts">
/**
 * Quick reference card — displays a summary of Iris UI primitives
 * with name, description, and import path. Used by the guide pages.
 */
defineProps<{
  items: Array<{ name: string; description: string; import: string }>
  title?: string
}>()
</script>

<template>
  <div class="quick-ref">
    <h3 v-if="title" class="quick-ref-title">{{ title }}</h3>
    <div class="quick-ref-grid">
      <div v-for="item in items" :key="item.name" class="quick-ref-card">
        <code class="quick-ref-name">{{ item.name }}</code>
        <p class="quick-ref-desc">{{ item.description }}</p>
        <code class="quick-ref-import">{{ item.import }}</code>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quick-ref {
  margin: 24px 0;
}
.quick-ref-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}
.quick-ref-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.quick-ref-card {
  padding: 12px;
  border: 1px solid var(--iris-border, #e2e8f0);
  border-radius: 8px;
  background: var(--iris-surface, #f8fafc);
}
.quick-ref-name {
  font-size: 14px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  color: var(--iris-primary, #6366f1);
}
.quick-ref-desc {
  font-size: 13px;
  margin: 6px 0;
  color: var(--iris-muted, #64748b);
  line-height: 1.4;
}
.quick-ref-import {
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--iris-foreground, #0f172a);
  background: var(--iris-background, #ffffff);
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}
</style>
