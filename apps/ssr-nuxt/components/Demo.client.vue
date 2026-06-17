<template>
  <ThemeProvider :store="themeStore">
    <section style="display: grid; gap: 24px">
      <!-- Basics: button + input + badge -->
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
        <IrisButton variant="solid">Primary action</IrisButton>
        <IrisInput v-model="name" placeholder="Type your name…" style="max-width: 240px" />
        <IrisBadge tone="primary" variant="solid">{{
          name ? `Hi, ${name}` : 'live badge'
        }}</IrisBadge>
      </div>

      <!-- Overlay: Dialog — closed by default, opens on hydration-driven click -->
      <div style="display: flex; gap: 12px; flex-wrap: wrap">
        <IrisDialog :open="dialogOpen" @update:open="dialogOpen = $event">
          <IrisDialogTrigger as-child>
            <IrisButton variant="outline">Open dialog</IrisButton>
          </IrisDialogTrigger>
          <IrisDialogContent>
            <IrisDialogTitle>Hydrated overlay</IrisDialogTitle>
            <IrisDialogDescription>
              This dialog was server-rendered closed and became interactive on hydration.
            </IrisDialogDescription>
            <div style="margin-top: 16px; text-align: right">
              <IrisDialogClose as-child>
                <IrisButton variant="solid">Close</IrisButton>
              </IrisDialogClose>
            </div>
          </IrisDialogContent>
        </IrisDialog>
      </div>

      <!-- Data component: Table -->
      <div>
        <h2 style="font-size: 16px; margin: 0 0 8px">Team</h2>
        <IrisTable :columns="columns" :data="rows" row-key="id" />
      </div>
    </section>
  </ThemeProvider>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  ThemeProvider,
  IrisButton,
  IrisInput,
  IrisBadge,
  IrisDialog,
  IrisDialogTrigger,
  IrisDialogContent,
  IrisDialogTitle,
  IrisDialogDescription,
  IrisDialogClose,
  IrisTable,
} from '@iris-ui/vue'
import { createThemeStore } from '@iris-ui/theme'
import { lightTheme, darkTheme } from '@iris-ui/tokens'

const name = ref('')
const dialogOpen = ref(false)
const themeStore = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})

interface Row {
  id: number
  name: string
  role: string
  status: string
}
const rows: Record<string, unknown>[] = [
  { id: 1, name: 'Ada Lovelace', role: 'Engineer', status: 'active' },
  { id: 2, name: 'Alan Turing', role: 'Researcher', status: 'active' },
  { id: 3, name: 'Grace Hopper', role: 'Architect', status: 'away' },
]
const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role' },
  { key: 'status', title: 'Status' },
]
</script>
