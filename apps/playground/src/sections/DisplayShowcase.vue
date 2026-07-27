<script setup lang="ts">
import { ref } from 'vue'
import {
  IrisBadge,
  IrisAvatar,
  IrisSpinner,
  IrisSkeleton,
  IrisProgress,
  IrisAlert,
  IrisBanner,
  IrisChip,
  IrisKbd,
  IrisCard,
  IrisDivider,
  IrisEmptyState,
  IrisButton,
} from '@iris-ui-kit/vue'

const progress = ref(35)
const bannerOpen = ref(true)
</script>

<template>
  <section class="section">
    <h2 class="section-title">Display Primitives</h2>

    <div class="row">
      <span class="row-label">badge</span>
      <IrisBadge>Default</IrisBadge>
      <IrisBadge tone="primary">Primary</IrisBadge>
      <IrisBadge tone="success">Success</IrisBadge>
      <IrisBadge tone="warning">Warning</IrisBadge>
      <IrisBadge tone="danger">Danger</IrisBadge>
    </div>

    <div class="row">
      <span class="row-label">avatar</span>
      <IrisAvatar size="sm" fallback="JS" />
      <IrisAvatar size="md" fallback="MC" />
      <IrisAvatar size="lg" fallback="LL" />
      <IrisAvatar size="md" src="https://i.pravatar.cc/100?img=12" fallback="?" />
    </div>

    <div class="row">
      <span class="row-label">spinner</span>
      <IrisSpinner size="sm" />
      <IrisSpinner size="md" />
      <IrisSpinner size="lg" />
    </div>

    <div class="row">
      <span class="row-label">progress</span>
      <div style="flex: 1; min-width: 200px">
        <IrisProgress :value="progress" />
      </div>
      <IrisButton size="sm" variant="ghost" @click="progress = Math.max(0, progress - 10)">
        −10
      </IrisButton>
      <IrisButton size="sm" variant="ghost" @click="progress = Math.min(100, progress + 10)">
        +10
      </IrisButton>
      <span style="font-size: 12px; color: var(--iris-muted)">{{ progress }}%</span>
    </div>

    <div class="row" style="align-items: stretch; flex-direction: column">
      <span class="row-label">skeleton</span>
      <div style="display: flex; gap: 8px; align-items: center">
        <IrisSkeleton shape="circle" :width="40" :height="40" />
        <div style="display: flex; flex-direction: column; gap: 6px; flex: 1">
          <IrisSkeleton :height="14" />
          <IrisSkeleton :height="14" style="width: 60%" />
        </div>
      </div>
    </div>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">alert</span>
      <IrisAlert tone="info" title="Heads up">This is an info alert.</IrisAlert>
      <IrisAlert tone="success" title="Saved" closable />
      <IrisAlert tone="warning" title="Watch out">Disk space is low.</IrisAlert>
      <IrisAlert tone="danger" title="Error">Something went wrong.</IrisAlert>
    </div>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">banner</span>
      <IrisBanner v-model:open="bannerOpen" tone="info" closable>
        Site-wide announcement — banners are edge-to-edge.
      </IrisBanner>
      <IrisButton v-if="!bannerOpen" size="sm" variant="outline" @click="bannerOpen = true">
        Show banner
      </IrisButton>
    </div>

    <div class="row">
      <span class="row-label">chip</span>
      <IrisChip>plain</IrisChip>
      <IrisChip tone="primary" closable>react</IrisChip>
      <IrisChip tone="success">vue</IrisChip>
      <IrisChip tone="warning" closable>typescript</IrisChip>
    </div>

    <div class="row">
      <span class="row-label">kbd</span>
      <IrisKbd>⌘</IrisKbd>
      <IrisKbd>K</IrisKbd>
      <span style="color: var(--iris-muted)">opens command palette</span>
    </div>

    <div class="row">
      <span class="row-label">card</span>
      <IrisCard style="max-width: 280px">
        <h3 style="margin: 0 0 6px 0; font-size: 14px">A card</h3>
        <p style="margin: 0; font-size: 13px; color: var(--iris-muted)">
          Cards are simple surfaces with token-driven padding + border.
        </p>
      </IrisCard>
    </div>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">divider</span>
      <IrisDivider />
      <IrisDivider label="OR" />
    </div>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">empty</span>
      <IrisEmptyState title="No items yet" description="Add your first item to get started.">
        <template #actions>
          <IrisButton variant="solid">Add item</IrisButton>
        </template>
      </IrisEmptyState>
    </div>
  </section>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: var(--iris-gap-md);
  flex-wrap: wrap;
}
.row + .row {
  margin-top: var(--iris-gap-md);
}
.row-label {
  width: 72px;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--iris-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
