import { useState, type CSSProperties } from 'react'
import { IrisTree, type IrisTreeNode } from '@iris-ui-kit/react'

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

const panelStyle: CSSProperties = {
  padding: 'var(--iris-space-md, 16px)',
  border: '1px solid var(--iris-border)',
  borderRadius: 'var(--iris-radius-md, 6px)',
  background: 'var(--iris-surface)',
}

export function TreeExamplePage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [checkedIds, setCheckedIds] = useState<string[]>([])

  const handleSelectedChange = (ids: string[]): void => {
    setSelectedIds(ids)
  }

  const handleCheckedChange = (ids: string[]): void => {
    setCheckedIds(ids)
  }

  return (
    <section data-page="tree-example" style={{ maxWidth: 720 }}>
      <h1 className="page-title">Tree Example</h1>
      <p className="page-desc">
        This uncontrolled permission tree starts collapsed with no selected or checked IDs. Select
        rows independently from the checkbox cascade, or expand Audit log to load its child.
      </p>

      <section aria-labelledby="tree-permissions-heading" style={panelStyle}>
        <h2 id="tree-permissions-heading" style={{ margin: '0 0 4px' }}>
          Permission selection
        </h2>
        <p
          style={{
            margin: '0 0 12px',
            color: 'var(--iris-muted)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
          }}
        >
          Checking Workspace delegates the cascade to IrisTree: enabled descendants are checked,
          while disabled Manage billing remains unchecked. Audit log shows the per-node loading
          state while its child resolves.
        </p>
        <IrisTree
          nodes={permissionNodes}
          defaultExpanded={[]}
          defaultSelected={[]}
          onSelectedChange={handleSelectedChange}
          selectionMode="multi"
          checkable
          defaultChecked={[]}
          onCheckedChange={handleCheckedChange}
          ariaLabel="Permission selection tree"
        />
      </section>

      <section
        aria-labelledby="tree-feedback-heading"
        style={{
          ...panelStyle,
          display: 'grid',
          gap: 'var(--iris-space-xs, 8px)',
          marginBlockStart: 'var(--iris-space-md, 16px)',
        }}
      >
        <h2 id="tree-feedback-heading" style={{ margin: 0 }}>
          Callback feedback
        </h2>
        <p
          style={{
            margin: 0,
            color: 'var(--iris-muted)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
          }}
        >
          The live regions keep row selection and reconciled checkbox events visible separately.
        </p>
        <div data-testid="tree-selected-readout" aria-live="polite">
          Selected IDs: {selectedIds.length > 0 ? selectedIds.join(', ') : 'none'}
        </div>
        <div data-testid="tree-checked-readout" aria-live="polite">
          Checked IDs: {checkedIds.length > 0 ? checkedIds.join(', ') : 'none'}
        </div>
      </section>
    </section>
  )
}
