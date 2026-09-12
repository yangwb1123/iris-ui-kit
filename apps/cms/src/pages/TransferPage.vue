<script setup lang="ts">
import { computed, ref } from 'vue'
import { IrisTransfer, type IrisTransferItem } from '@iris-ui-kit/vue'

const permissions: IrisTransferItem[] = [
  { label: 'Read articles', value: 'read-articles' },
  { label: 'Edit articles', value: 'edit-articles' },
  { label: 'Publish articles', value: 'publish-articles' },
  { label: 'Delete users', value: 'delete-users', disabled: true },
]

const assignedValues = ref<string[]>(['read-articles'])
const assignedLabels = computed(() =>
  permissions
    .filter((permission) => assignedValues.value.includes(permission.value))
    .map((permission) => permission.label),
)
</script>

<template>
  <section data-page="transfer" style="max-width: 960px">
    <h1 class="page-title">Transfer</h1>
    <p class="page-desc">
      Controlled permission assignment with searchable available and assigned panes. The summary
      below is derived from the <code>v-model</code> value.
    </p>

    <div
      data-testid="assignment-summary"
      role="status"
      aria-live="polite"
      style="
        margin-block-end: var(--iris-space-lg, 24px);
        padding: var(--iris-space-md, 16px);
        border: 1px solid var(--iris-border);
        border-radius: var(--iris-radius-md, 6px);
        background: var(--iris-surface);
      "
    >
      <strong>Assigned permissions</strong>
      <span style="margin-inline-start: var(--iris-space-xs, 8px)">
        {{ assignedLabels.length > 0 ? assignedLabels.join(', ') : 'None' }}
      </span>
    </div>

    <h2 style="margin: 0 0 var(--iris-space-xs, 8px); font-size: var(--iris-font-size-lg, 16px)">
      Permission assignment
    </h2>
    <p
      style="
        margin: 0 0 var(--iris-space-md, 16px);
        color: var(--iris-muted);
        font-size: var(--iris-font-size-sm, 13px);
      "
    >
      Search either pane, select permissions, and use the built-in move controls. Delete users is
      disabled and remains available for review only.
    </p>

    <IrisTransfer
      v-model="assignedValues"
      :options="permissions"
      :titles="['Available permissions', 'Assigned permissions']"
      searchable
      aria-label="Permission assignment"
    />
  </section>
</template>
