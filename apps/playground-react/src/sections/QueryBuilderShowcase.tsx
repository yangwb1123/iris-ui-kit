import { useRef, useState } from 'react'
import {
  createFilterBuilder,
  IrisQueryBuilder,
  type FilterRule,
} from '@iris-ui-kit/plugin-query-builder/react'
import type { QueryColumn } from '@iris-ui-kit/plugin-query-builder/react'
import { IrisBadge } from '@iris-ui-kit/react'

const COLUMNS: QueryColumn[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'email', label: 'Email', type: 'string' },
  { key: 'age', label: 'Age', type: 'number' },
  {
    key: 'role',
    label: 'Role',
    type: 'enum',
    options: [
      { label: 'Admin', value: 'admin' },
      { label: 'Editor', value: 'editor' },
      { label: 'Viewer', value: 'viewer' },
    ],
  },
  { key: 'active', label: 'Active', type: 'boolean' },
  { key: 'created', label: 'Created', type: 'date' },
]

export function QueryBuilderShowcase() {
  const [rules, setRules] = useState<FilterRule[]>([])
  const builderRef = useRef<ReturnType<typeof createFilterBuilder> | null>(null)

  if (!builderRef.current) {
    builderRef.current = createFilterBuilder({ columns: COLUMNS })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section className="section">
        <h2 className="section-title">Query Builder</h2>
        <p style={{ color: 'var(--iris-muted)', fontSize: 14, margin: '0 0 16px' }}>
          Visual filter builder from <code>@iris-ui-kit/plugin-query-builder</code>. Add rules, pick
          columns and operators, and watch the compiled output update.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div
            style={{
              padding: 16,
              background: 'var(--iris-surface)',
              borderRadius: 'var(--iris-radius-md, 6px)',
              border: '1px solid var(--iris-border)',
            }}
          >
            <IrisQueryBuilder
              builder={builderRef.current}
              onChange={(r) => setRules(r)}
              addLabel="+ Add Rule"
            />
          </div>

          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              Compiled Rules{' '}
              <IrisBadge tone="neutral" variant="subtle">
                {rules.length}
              </IrisBadge>
            </div>
            <pre
              style={{
                margin: 0,
                padding: 12,
                fontSize: 12,
                fontFamily: 'var(--iris-font-mono, monospace)',
                background: 'var(--iris-surface)',
                border: '1px solid var(--iris-border)',
                borderRadius: 'var(--iris-radius-md, 6px)',
                minHeight: 200,
                whiteSpace: 'pre-wrap',
              }}
            >
              {rules.length === 0
                ? '// No rules yet — click "Add Rule" to start building a filter.\n// The output feeds directly into createDataSource.setFilterRules().'
                : JSON.stringify(rules, null, 2)}
            </pre>
          </div>
        </div>
      </section>
    </div>
  )
}
