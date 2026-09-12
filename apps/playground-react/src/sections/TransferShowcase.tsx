import { useState } from 'react'
import { IrisTransfer, type IrisTransferItem } from '@iris-ui-kit/react'

const PERMISSION_OPTIONS: IrisTransferItem[] = [
  { label: 'Read users', value: 'users.read' },
  { label: 'Ops', value: 'ops' },
  { label: 'Export reports', value: 'reports.export' },
  { label: 'Manage billing', value: 'billing.manage', disabled: true },
]

export function TransferShowcase() {
  const [selectedValues, setSelectedValues] = useState<string[]>(['users.read'])

  return (
    <section className="section">
      <h2 className="section-title">Transfer</h2>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="row-label">permissions</span>
        <IrisTransfer
          options={PERMISSION_OPTIONS}
          value={selectedValues}
          onValueChange={setSelectedValues}
          titles={['Available permissions', 'Assigned permissions']}
          searchable
        />
        <span
          data-playground-transfer-selected-values=""
          aria-live="polite"
          style={{ fontSize: 12, color: 'var(--iris-muted)', alignSelf: 'center' }}
        >
          Selected values: {selectedValues.join(', ')}
        </span>
      </div>
    </section>
  )
}
