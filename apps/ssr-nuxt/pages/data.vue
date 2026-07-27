<template>
  <header style="margin-bottom: 28px">
    <IrisBadge tone="success" variant="solid">Nuxt useAsyncData</IrisBadge>
    <h1 style="margin: 12px 0 6px; font-size: 28px">Server data</h1>
    <p style="margin: 0; color: var(--iris-muted-foreground)">
      The team query ran during SSR and Nuxt serialized its result for hydration.
    </p>
  </header>

  <section aria-labelledby="team-heading" data-ssr-source="nuxt-use-async-data">
    <div
      style="
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      "
    >
      <h2 id="team-heading" style="font-size: 18px; margin: 0">Loaded on the server</h2>
      <span style="color: var(--iris-muted-foreground); font-size: 13px">
        {{ data?.generatedAt }}
      </span>
    </div>
    <IrisTable :columns="columns" :data="data?.rows ?? []" row-key="id" />
  </section>
</template>

<script setup lang="ts">
import { useFetch } from '#app'
import { IrisBadge, IrisTable } from '@iris-ui-kit/vue'

interface TeamPayload {
  source: string
  generatedAt: string
  rows: Record<string, unknown>[]
}

const { data } = await useFetch<TeamPayload>('/api/team', { key: 'ssr-team' })

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role' },
  { key: 'status', title: 'Status' },
]
</script>
