import { createSignal, type JSX } from 'solid-js'
import { IrisTree, type IrisTreeNode } from '@iris-ui-kit/solid'

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

const panelStyle: import('solid-js').JSX.CSSProperties = {
  padding: '16px',
  border: '1px solid var(--iris-border)',
  'border-radius': 'var(--iris-radius-md, 6px)',
  background: 'var(--iris-surface)',
}

export function TreeExamplePage(): JSX.Element {
  const [selectedIds, setSelectedIds] = createSignal<string[]>([])
  const [checkedIds, setCheckedIds] = createSignal<string[]>([])

  return (
    <section data-page="tree-example" style={{ 'max-width': '720px' }}>
      <h1 class="page-title">Tree Example</h1>
      <p class="page-desc">
        An uncontrolled permission tree starts collapsed. Expand branches to explore nested access,
        check a parent to cascade to enabled descendants, or expand Audit log to load its child.
      </p>

      <section aria-labelledby="tree-permissions-heading" style={panelStyle}>
        <h2 id="tree-permissions-heading" style={{ margin: '0 0 4px' }}>
          Permission selection
        </h2>
        <p
          style={{
            margin: '0 0 12px',
            color: 'var(--iris-muted)',
            'font-size': 'var(--iris-font-size-sm, 13px)',
          }}
        >
          Manage billing is disabled; the IrisTree cascade skips it while checking Workspace.
        </p>
        <IrisTree
          nodes={permissionNodes}
          selectionMode="multi"
          checkable
          defaultSelectedIds={[]}
          defaultExpandedIds={[]}
          defaultChecked={[]}
          ariaLabel="Permission selection tree"
          onSelect={(ids) => setSelectedIds(ids)}
          onCheckedChange={(ids) => setCheckedIds(ids)}
        />
      </section>

      <section
        aria-labelledby="tree-feedback-heading"
        style={{ ...panelStyle, 'margin-top': '16px' }}
      >
        <h2 id="tree-feedback-heading" style={{ margin: '0 0 12px' }}>
          Callback feedback
        </h2>
        <div
          data-testid="tree-selected-readout"
          aria-live="polite"
          style={{ 'font-size': 'var(--iris-font-size-sm, 13px)' }}
        >
          Selected IDs: {selectedIds().length > 0 ? selectedIds().join(', ') : 'none'}
        </div>
        <div
          data-testid="tree-checked-readout"
          aria-live="polite"
          style={{
            'margin-top': '8px',
            'font-size': 'var(--iris-font-size-sm, 13px)',
          }}
        >
          Checked IDs: {checkedIds().length > 0 ? checkedIds().join(', ') : 'none'}
        </div>
      </section>
    </section>
  )
}
