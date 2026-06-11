import * as React from 'react'
import { operatorLabels, type FilterBuilder, type FilterOperator, type FilterRule } from '../core'

export type {
  FilterBuilder,
  FilterBuilderConfig,
  QueryColumn,
  QueryRule,
  FilterRule,
  FilterOperator,
} from '../core'
export { createFilterBuilder, queryBuilderPlugin, operatorsByType, operatorLabels } from '../core'

export interface IrisQueryBuilderProps {
  builder: FilterBuilder
  /** Called with the compiled `FilterRule[]` whenever the rules change. */
  onChange?: (rules: FilterRule[]) => void
  /** Label for the add-rule button. Default `'Add rule'`. */
  addLabel?: string
  className?: string
}

/**
 * Visual query builder for React: stacked rule rows (column → operator → value)
 * over a {@link FilterBuilder}, emitting compiled `FilterRule[]` via `onChange`
 * (wire it to `dataSource.setFilterRules`). All logic lives in the builder.
 */
export function IrisQueryBuilder({
  builder,
  onChange,
  addLabel = 'Add rule',
  className,
}: IrisQueryBuilderProps): React.ReactElement {
  const state = React.useSyncExternalStore(builder.subscribe, builder.getState, builder.getState)
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange
  React.useEffect(() => {
    onChangeRef.current?.(builder.toFilterRules())
  }, [state, builder])

  return (
    <div data-iris-query-builder="" className={className}>
      {state.rules.map((rule) => (
        <div key={rule.id} data-iris-query-rule="">
          <select
            data-iris-query-column=""
            value={rule.key}
            aria-label="Column"
            onChange={(e) => builder.updateRule(rule.id, { key: e.target.value })}
          >
            {builder.columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            data-iris-query-operator=""
            value={rule.operator}
            aria-label="Operator"
            onChange={(e) =>
              builder.updateRule(rule.id, { operator: e.target.value as FilterOperator })
            }
          >
            {builder.operatorsFor(rule.key).map((op) => (
              <option key={op} value={op}>
                {operatorLabels[op]}
              </option>
            ))}
          </select>
          <input
            data-iris-query-value=""
            value={rule.value}
            aria-label="Value"
            onChange={(e) => builder.updateRule(rule.id, { value: e.target.value })}
          />
          <button
            type="button"
            data-iris-query-remove=""
            aria-label="Remove rule"
            onClick={() => builder.removeRule(rule.id)}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" data-iris-query-add="" onClick={() => builder.addRule()}>
        {addLabel}
      </button>
    </div>
  )
}
