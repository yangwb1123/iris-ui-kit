import { createSignal, createEffect, onCleanup, For, type JSX } from 'solid-js'
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
  class?: string
}

/**
 * Visual query builder for SolidJS: stacked rule rows (column → operator → value)
 * over a {@link FilterBuilder}, emitting compiled `FilterRule[]` via `onChange`
 * (wire it to `dataSource.setFilterRules`). All logic lives in the builder.
 * Bridges the core Store directly via a signal (no adapter `useStore`).
 */
export function IrisQueryBuilder(props: IrisQueryBuilderProps): JSX.Element {
  const [state, setState] = createSignal(props.builder.getState())
  onCleanup(props.builder.subscribe(setState))

  // Emit the compiled rules whenever the rule set changes (state() tracked).
  createEffect(() => {
    state()
    props.onChange?.(props.builder.toFilterRules())
  })

  return (
    <div data-iris-query-builder="" class={props.class}>
      <For each={state().rules}>
        {(rule) => (
          <div data-iris-query-rule="">
            <select
              data-iris-query-column=""
              value={rule.key}
              aria-label="Column"
              onChange={(e) => props.builder.updateRule(rule.id, { key: e.currentTarget.value })}
            >
              <For each={props.builder.columns}>
                {(c) => <option value={c.key}>{c.label}</option>}
              </For>
            </select>
            <select
              data-iris-query-operator=""
              value={rule.operator}
              aria-label="Operator"
              onChange={(e) =>
                props.builder.updateRule(rule.id, {
                  operator: e.currentTarget.value as FilterOperator,
                })
              }
            >
              <For each={props.builder.operatorsFor(rule.key)}>
                {(op) => <option value={op}>{operatorLabels[op]}</option>}
              </For>
            </select>
            <input
              data-iris-query-value=""
              value={rule.value}
              aria-label="Value"
              onInput={(e) => props.builder.updateRule(rule.id, { value: e.currentTarget.value })}
            />
            <button
              type="button"
              data-iris-query-remove=""
              aria-label="Remove rule"
              onClick={() => props.builder.removeRule(rule.id)}
            >
              ×
            </button>
          </div>
        )}
      </For>
      <button type="button" data-iris-query-add="" onClick={() => props.builder.addRule()}>
        {props.addLabel ?? 'Add rule'}
      </button>
    </div>
  )
}
