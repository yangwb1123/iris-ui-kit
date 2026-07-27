<script setup lang="ts">
import { computed, onUnmounted, shallowRef } from 'vue'
import { createCmsWorkspaceController, type CmsWorkspaceRoute } from '@iris-ui-kit/cms-shared'
import { IrisBadge, IrisButton, IrisInput } from '@iris-ui-kit/vue'

const props = defineProps<{ routeKey: CmsWorkspaceRoute }>()
const controller = createCmsWorkspaceController(props.routeKey)
const definition = controller.definition
const snapshot = shallowRef(controller.store.getState())
const unsubscribe = controller.store.subscribe((next) => {
  snapshot.value = next
})
onUnmounted(unsubscribe)

const rows = computed(() => {
  void snapshot.value
  return controller.visibleRecords()
})
const selected = computed(() => {
  void snapshot.value
  return controller.selectedRecord()
})
const period = computed(() => definition.periods?.[snapshot.value.periodIndex])
</script>

<template>
  <section :data-cms-workspace="routeKey">
    <header class="cms-workspace-header">
      <div>
        <h1 class="page-title">{{ definition.title }}</h1>
        <p class="page-desc">{{ definition.description }}</p>
      </div>
      <IrisButton variant="solid" @click="controller.runPrimaryAction">
        {{ definition.primaryActionLabel }}
      </IrisButton>
    </header>

    <div
      v-if="snapshot.metrics.length > 0"
      class="cms-workspace-metrics"
      aria-label="Current metrics"
    >
      <article v-for="metric in snapshot.metrics" :key="metric.label" class="cms-workspace-metric">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <IrisBadge :tone="metric.tone" variant="subtle">{{ metric.delta }}</IrisBadge>
      </article>
    </div>

    <div v-if="period" class="cms-workspace-period" aria-label="Calendar period">
      <IrisButton
        variant="outline"
        size="sm"
        aria-label="Previous period"
        @click="controller.shiftPeriod(-1)"
      >
        Previous
      </IrisButton>
      <strong aria-live="polite">{{ period }}</strong>
      <IrisButton
        variant="outline"
        size="sm"
        aria-label="Next period"
        @click="controller.shiftPeriod(1)"
      >
        Next
      </IrisButton>
    </div>

    <div class="cms-workspace-toolbar">
      <IrisInput
        type="search"
        :model-value="snapshot.query"
        :placeholder="definition.searchPlaceholder"
        :aria-label="`Search ${definition.title}`"
        style="width: min(100%, 320px)"
        @update:model-value="controller.setQuery"
      />
      <label class="cms-workspace-filter">
        <span>View</span>
        <select
          :value="snapshot.filter"
          :aria-label="`Filter ${definition.title}`"
          @change="controller.setFilter(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="filter in definition.filters" :key="filter.value" :value="filter.value">
            {{ filter.label }}
          </option>
        </select>
      </label>
    </div>

    <div v-if="snapshot.notice" class="cms-workspace-notice" role="status">
      {{ snapshot.notice }}
    </div>

    <div v-if="rows.length > 0" class="cms-workspace-table-shell">
      <table class="cms-table">
        <thead>
          <tr>
            <th v-for="column in definition.columns" :key="column" scope="col">{{ column }}</th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in rows"
            :key="item.id"
            :data-selected="snapshot.selectedId === item.id || undefined"
          >
            <td v-for="(cell, index) in item.cells" :key="definition.columns[index]">
              <button
                v-if="index === 0"
                class="cms-workspace-link"
                type="button"
                @click="controller.select(item.id)"
              >
                {{ cell }}
              </button>
              <template v-else>{{ cell }}</template>
            </td>
            <td>
              <IrisBadge :tone="item.tone" variant="subtle">{{ item.status }}</IrisBadge>
            </td>
            <td>
              <IrisButton variant="ghost" size="sm" @click="controller.runRowAction(item.id)">
                {{ definition.rowActionLabel }}
              </IrisButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="cms-workspace-empty" role="status">{{ definition.emptyMessage }}</p>

    <aside v-if="selected" class="cms-workspace-selection" aria-label="Selected record">
      <strong>Selected: {{ selected.cells[0] }}</strong>
      <span>
        {{
          definition.columns
            .slice(1)
            .map((column, index) => `${column}: ${selected?.cells[index + 1]}`)
            .join(' · ')
        }}
      </span>
    </aside>
  </section>
</template>
