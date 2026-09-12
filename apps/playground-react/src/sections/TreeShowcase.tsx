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
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 'var(--iris-gap-sm, 12px)',
  padding: 'var(--iris-space-md, 16px)',
  border: '1px solid var(--iris-border)',
  borderRadius: 'var(--iris-radius-md, 8px)',
  background: 'var(--iris-background)',
}

export function TreeShowcase() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [checkedIds, setCheckedIds] = useState<string[]>([])

  const handleSelectedChange = (ids: string[]): void => {
    setSelectedIds(ids)
  }

  const handleCheckedChange = (ids: string[]): void => {
    setCheckedIds(ids)
  }

  return (
    <section className="section" data-testid="tree-showcase">
      <h2 className="section-title">Tree — Permission cascade</h2>
      <p
        style={{
          maxWidth: 720,
          margin: '0 0 16px',
          color: 'var(--iris-muted)',
          fontSize: 'var(--iris-font-size-sm, 13px)',
          lineHeight: 1.5,
        }}
      >
        This uncontrolled permission tree starts collapsed. Row selection is independent from
        checkbox selection. Checking Workspace cascades only to enabled descendants; Manage billing
        is disabled. Audit log loads its child asynchronously after 250 ms.
      </p>

      <div style={panelStyle}>
        <h3 style={{ margin: 0, fontSize: 'var(--iris-font-size-md, 14px)', fontWeight: 600 }}>
          Permission selection
        </h3>
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
        <p
          style={{
            margin: 0,
            color: 'var(--iris-muted)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            lineHeight: 1.5,
          }}
        >
          Expand Workspace to inspect nested permissions. The Audit log toggle shows the loading
          marker while its cached child resolves.
        </p>
      </div>

      <div
        style={{
          ...panelStyle,
          marginBlockStart: 'var(--iris-gap-lg, 20px)',
          background: 'var(--iris-surface)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 'var(--iris-font-size-md, 14px)', fontWeight: 600 }}>
          Event feedback
        </h3>
        <p
          style={{
            margin: 0,
            color: 'var(--iris-muted)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
          }}
        >
          The readouts show the latest selected and reconciled checked ID arrays independently.
        </p>
        <div data-testid="tree-selected-readout" aria-live="polite">
          Selected IDs: {selectedIds.length > 0 ? selectedIds.join(', ') : 'none'}
        </div>
        <div data-testid="tree-checked-readout" aria-live="polite">
          Checked IDs: {checkedIds.length > 0 ? checkedIds.join(', ') : 'none'}
        </div>
      </div>
    </section>
  )
}
