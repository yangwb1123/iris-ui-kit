<template>
  <div style="display: flex; flex-direction: column; gap: 24px">
    <section class="section">
      <h2 class="section-title">Data &amp; Resilience</h2>
      <p style="color: var(--iris-muted); font-size: 14px; margin: 0 0 16px">
        Framework-agnostic resilience primitives from <code>@iris-ui/core</code>. Each demo below
        runs live in this page.
      </p>

      <div
        style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 16px;
        "
      >
        <!-- Resilient Fetcher -->
        <div class="card" style="padding: 16px">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
            <strong>Resilient Fetcher</strong>
            <IrisBadge tone="success" variant="subtle">cache: TTL 3s</IrisBadge>
          </div>
          <div style="font-size: 13px; color: var(--iris-muted); margin-bottom: 8px">
            Cache + Circuit breaker + Rate limiter
          </div>
          <div class="log" ref="rfLog"></div>
        </div>

        <!-- Outbox -->
        <div class="card" style="padding: 16px">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
            <strong>Offline Outbox</strong>
            <IrisBadge tone="success" variant="subtle">at-least-once</IrisBadge>
          </div>
          <div style="display: flex; gap: 8px; margin-bottom: 8px">
            <IrisButton size="sm" @click="enqueueMut">Enqueue</IrisButton>
            <IrisButton size="sm" variant="outline" @click="toggleOnline">
              {{ online ? 'Go Offline' : 'Go Online' }}
            </IrisButton>
          </div>
          <div class="log" ref="outboxLog">
            <div v-if="outboxItems.length === 0" style="color: var(--iris-muted)">
              No mutations yet
            </div>
            <div
              v-for="item in outboxItems"
              :key="item.id"
              :style="{
                color: item.status === 'failed' ? 'var(--iris-danger)' : 'var(--iris-muted)',
              }"
            >
              [{{ item.status }}] {{ item.payload.text }}
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { createResilientFetcher, createOutbox, createDisposableScope } from '@iris-ui/core'
import { IrisBadge, IrisButton } from '@iris-ui/vue'

const online = ref(true)
const outboxItems = ref<Array<{ id: string; status: string; payload: { text: string } }>>([])

// ---- Resilient Fetcher demo ----
const rf = createResilientFetcher<{ ok: boolean }>({ ttlMs: 3000 })
const rfLog = ref<HTMLDivElement | null>(null)

// ---- Outbox demo ----
const onlineRef = { current: true }
const outbox = createOutbox<{ text: string }>({
  execute: async () => {
    if (!onlineRef.current) throw new Error('Offline')
    await new Promise((r) => setTimeout(r, 300))
  },
  maxAttempts: 3,
})

outbox.subscribe((snap: Array<{ id: string; status: string; payload: { text: string } }>) => {
  outboxItems.value = snap.map((i) => ({ id: i.id, status: i.status, payload: i.payload }))
})

function enqueueMut() {
  outbox.enqueue({ text: `Mutation #${Date.now() % 1000}` })
  outbox.flush()
}

function toggleOnline() {
  online.value = !online.value
  onlineRef.current = online.value
}

// Cleanup
const scope = createDisposableScope()
scope.add(() => rf.cache.clear())
scope.add(() => outbox.clear())
onUnmounted(() => scope.destroy())
</script>
