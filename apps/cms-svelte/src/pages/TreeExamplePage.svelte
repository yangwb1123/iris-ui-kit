<script lang="ts">
  import { IrisTree, type IrisTreeNode } from '@iris-ui-kit/svelte'

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

  const panelStyle =
    'padding: var(--iris-space-md, 16px); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); background: var(--iris-surface)'

  let selectedIds = $state<string[]>([])
  let checkedIds = $state<string[]>([])

  function handleSelectedChange(ids: string[]): void {
    selectedIds = ids
  }

  function handleCheckedChange(ids: string[]): void {
    checkedIds = ids
  }
</script>

<section data-page="tree-example" style="max-width: 720px">
  <h1 class="page-title">Tree Example</h1>
  <p class="page-desc">
    This uncontrolled permission tree starts collapsed. Expand nested branches, select multiple
    enabled nodes, or check Workspace to let IrisTree cascade checks. Audit log loads its child
    after a deterministic 250 ms delay.
  </p>

  <section aria-labelledby="tree-permissions-heading" style={panelStyle}>
    <h2 id="tree-permissions-heading" style="margin: 0 0 4px">Permission selection</h2>
    <p
      style="margin: 0 0 12px; color: var(--iris-muted); font-size: var(--iris-font-size-sm, 13px)"
    >
      Manage billing is disabled, so IrisTree excludes it from the Workspace checkbox cascade. Audit
      log shows the adapter loading marker while its child resolves.
    </p>
    <IrisTree
      nodes={permissionNodes}
      defaultExpanded={[]}
      defaultSelected={[]}
      selectionMode="multi"
      checkable
      defaultChecked={[]}
      ariaLabel="Permission selection tree"
      onSelectedChange={handleSelectedChange}
      onCheckedChange={handleCheckedChange}
    />
  </section>

  <section aria-labelledby="tree-feedback-heading" style={`${panelStyle}; margin-top: 16px`}>
    <h2 id="tree-feedback-heading" style="margin: 0 0 12px">Callback feedback</h2>
    <div data-testid="tree-selected-readout" aria-live="polite">
      Selected IDs: {selectedIds.length > 0 ? selectedIds.join(', ') : 'none'}
    </div>
    <div data-testid="tree-checked-readout" aria-live="polite" style="margin-top: 8px">
      Checked IDs: {checkedIds.length > 0 ? checkedIds.join(', ') : 'none'}
    </div>
  </section>
</section>
