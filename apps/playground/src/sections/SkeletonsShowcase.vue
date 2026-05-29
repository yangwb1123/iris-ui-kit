<script setup lang="ts">
import { ref } from 'vue'
import {
  IrisLoginTemplate,
  IrisDashboardTemplate,
  IrisButton,
  IrisCard,
  useToast,
  type IrisLoginSubmitPayload,
  type IrisDashboardNavItem,
  type IrisDashboardCardSpec,
} from '@iris-ui/vue'

const toast = useToast()

const onLogin = (payload: IrisLoginSubmitPayload) => {
  toast.success({
    title: 'Submitted',
    description: `${payload.email} (remember = ${payload.remember})`,
  })
}

const dashNav: IrisDashboardNavItem[] = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'team', label: 'Team', icon: '👥' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]
const dashActive = ref('home')

const dashCards: IrisDashboardCardSpec[] = [
  { id: 'a', title: 'Revenue', body: '$128,400', colSpan: 4 },
  { id: 'b', title: 'New Users', body: '+512', colSpan: 4 },
  { id: 'c', title: 'Open Issues', body: '47', colSpan: 4 },
  { id: 'd', title: 'Recent Activity', body: 'Loading…', colSpan: 'full' },
]
</script>

<template>
  <section class="section">
    <h2 class="section-title">Layer 4 · System Skeletons</h2>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">login template</span>
      <IrisCard style="padding: 0; overflow: hidden">
        <div style="height: 600px; overflow: hidden; position: relative">
          <IrisLoginTemplate
            title="Welcome back"
            description="Sign in to your workspace"
            @submit="onLogin"
          />
        </div>
      </IrisCard>
    </div>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">dashboard template</span>
      <IrisCard style="padding: 0; overflow: hidden">
        <div style="height: 520px; overflow: hidden">
          <IrisDashboardTemplate
            title="Iris Dashboard"
            sidebar-title="Workspace"
            :nav="dashNav"
            :active-id="dashActive"
            :cards="dashCards"
            @update:active-id="(id) => (dashActive = id)"
          />
        </div>
      </IrisCard>
      <span style="font-size: 12px; color: var(--iris-muted)">
        active section → {{ dashActive }} · click sidebar items, click ≡ to collapse
      </span>
      <IrisButton size="sm" variant="ghost" @click="dashActive = 'projects'"
        >go to Projects</IrisButton
      >
    </div>
  </section>
</template>

<style scoped>
.row {
  display: flex;
  gap: var(--iris-gap-md);
}
.row + .row {
  margin-top: var(--iris-gap-lg);
}
.row-label {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--iris-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
