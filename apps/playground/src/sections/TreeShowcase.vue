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
          resolve([
            {
              id: 'audit-log-events',
              label: 'View audit events',
              isLeaf: true,
            },
          ])
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
  <section class="section tree-showcase" data-testid="tree-showcase">
    <h2 class="section-title">Tree — Permission cascade</h2>
    <p class="tree-description">
      This uncontrolled permission tree starts collapsed. Row selection is independent from checkbox
      selection. Checking Workspace cascades only to enabled descendants; Manage billing is
      disabled. Audit log loads its child asynchronously after 250 ms.
    </p>

    <div class="tree-scenario">
      <h3 class="scenario-title">Permission selection</h3>
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
      <p class="scenario-note">
        Expand Workspace to inspect nested permissions. The Audit log chevron shows the loading
        marker while its cached child resolves.
      </p>
    </div>

    <div class="tree-feedback">
      <h3 class="scenario-title">Event feedback</h3>
      <p class="feedback-description">
        The readouts show the latest selected and reconciled checked ID arrays independently.
      </p>
      <div data-testid="tree-selected-readout" aria-live="polite">
        Selected IDs: {{ selectedIds.length > 0 ? selectedIds.join(', ') : 'none' }}
      </div>
      <div data-testid="tree-checked-readout" aria-live="polite">
        Checked IDs: {{ checkedIds.length > 0 ? checkedIds.join(', ') : 'none' }}
      </div>
    </div>
  </section>
</template>

<style scoped>
.tree-showcase {
  display: flex;
  flex-direction: column;
  gap: var(--iris-gap-lg, 20px);
}

.tree-description,
.scenario-note,
.feedback-description {
  margin: 0;
  color: var(--iris-muted);
  font-size: var(--iris-font-size-sm, 13px);
  line-height: 1.5;
}

.tree-description {
  max-width: 720px;
}

.tree-scenario,
.tree-feedback {
  display: flex;
  flex-direction: column;
  gap: var(--iris-gap-sm, 12px);
  padding: var(--iris-space-md, 16px);
  border: 1px solid var(--iris-border);
  border-radius: var(--iris-radius-md, 8px);
  background: var(--iris-background);
}

.scenario-title {
  margin: 0;
  font-size: var(--iris-font-size-md, 14px);
  font-weight: 600;
}

.tree-feedback {
  background: var(--iris-surface);
}

.tree-feedback [data-testid] {
  color: var(--iris-foreground);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: var(--iris-font-size-sm, 13px);
}
</style>
