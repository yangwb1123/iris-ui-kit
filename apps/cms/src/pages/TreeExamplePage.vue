<script setup lang="ts">
import { ref } from 'vue'
import { IrisTree, type IrisTreeNode } from '@iris-ui-kit/vue'

const permissionNodes: IrisTreeNode[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    children: [
      { id: 'workspace-read', label: 'Read workspace', isLeaf: true },
      {
        id: 'workspace-manage',
        label: 'Manage workspace',
        children: [
          { id: 'workspace-users', label: 'Manage users', isLeaf: true },
          {
            id: 'workspace-billing',
            label: 'Manage billing',
            isLeaf: true,
            disabled: true,
          },
        ],
      },
    ],
  },
  {
    id: 'audit-log',
    label: 'Audit log',
    loadChildren: () =>
      new Promise<IrisTreeNode[]>((resolve) => {
        setTimeout(() => {
          resolve([{ id: 'audit-log-events', label: 'View audit events', isLeaf: true }])
        }, 250)
      }),
  },
]

const selectedIds = ref<string[]>([])
const checkedIds = ref<string[]>([])

function handleSelectedChange(ids: string[]): void {
  selectedIds.value = ids
}

function handleCheckedChange(ids: string[]): void {
  checkedIds.value = ids
}
</script>

<template>
  <section data-page="tree-example" style="max-width: 720px">
    <h1 class="page-title">Tree Example</h1>
    <p class="page-desc">
      This uncontrolled permission tree starts collapsed with no selected or checked IDs. Select
      rows independently from the checkbox cascade, or expand Audit log to load its child.
    </p>

    <section
      aria-labelledby="tree-permissions-heading"
      style="
        padding: var(--iris-space-md, 16px);
        border: 1px solid var(--iris-border);
        border-radius: var(--iris-radius-md, 6px);
        background: var(--iris-surface);
      "
    >
      <h2 id="tree-permissions-heading" style="margin: 0 0 4px">Permission selection</h2>
      <p
        style="
          margin: 0 0 12px;
          color: var(--iris-muted);
          font-size: var(--iris-font-size-sm, 13px);
        "
      >
        Checking Workspace delegates the cascade to IrisTree: enabled descendants are checked, while
        disabled Manage billing remains unchecked. Audit log shows the per-node loading state while
        its child resolves.
      </p>
      <IrisTree
        :nodes="permissionNodes"
        :defaultExpanded="[]"
        :defaultSelected="[]"
        selectionMode="multi"
        checkable
        :defaultChecked="[]"
        ariaLabel="Permission selection tree"
        @update:selected="handleSelectedChange"
        @checked-change="handleCheckedChange"
      />
    </section>

    <section
      aria-labelledby="tree-feedback-heading"
      style="
        display: grid;
        gap: var(--iris-space-xs, 8px);
        margin-block-start: var(--iris-space-md, 16px);
        padding: var(--iris-space-md, 16px);
        border: 1px solid var(--iris-border);
        border-radius: var(--iris-radius-md, 6px);
        background: var(--iris-surface);
      "
    >
      <h2 id="tree-feedback-heading" style="margin: 0">Callback feedback</h2>
      <p style="margin: 0; color: var(--iris-muted); font-size: var(--iris-font-size-sm, 13px)">
        The live regions keep row selection and reconciled checkbox events visible separately.
      </p>
      <div data-testid="tree-selected-readout" aria-live="polite">
        Selected IDs: {{ selectedIds.length > 0 ? selectedIds.join(', ') : 'none' }}
      </div>
      <div data-testid="tree-checked-readout" aria-live="polite">
        Checked IDs: {{ checkedIds.length > 0 ? checkedIds.join(', ') : 'none' }}
      </div>
    </section>
  </section>
</template>
