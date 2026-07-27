import { createSignal, createEffect, onCleanup, For, type JSX } from 'solid-js'
import {
  defaultQueryBuilderLabels,
  operatorLabels,
  type CompiledQueryGroup,
  type FilterBuilder,
  type FilterOperator,
  type FilterRule,
  type QueryBuilderLabels,
  type QueryGroup,
  type QueryRuleNode,
  type QueryValidationIssue,
} from '@iris-ui-kit/plugin-query-builder/core'

export type {
  CompiledQueryGroup,
  CompiledQueryNode,
  CompiledQueryRule,
  FilterBuilder,
  FilterBuilderConfig,
  QueryColumn,
  QueryCombinator,
  QueryGroup,
  QueryGroupInput,
  QueryNode,
  QueryNodeInput,
  QueryRule,
  QueryRuleInput,
  QueryRuleNode,
  QueryBuilderLabels,
  QueryValidationCode,
  QueryValidationIssue,
  QueryValidationResult,
  FilterRule,
  FilterOperator,
} from '@iris-ui-kit/plugin-query-builder/core'
export {
  createFilterBuilder,
  queryBuilderPlugin,
  operatorsByType,
  operatorLabels,
} from '@iris-ui-kit/plugin-query-builder/core'

export interface IrisQueryBuilderProps {
  builder: FilterBuilder
  /** Called with the compiled `FilterRule[]` whenever the rules change. */
  onChange?: (rules: FilterRule[]) => void
  onQueryChange?: (query: CompiledQueryGroup) => void
  /** Label for the add-rule button. Default `'Add rule'`. */
  addLabel?: string
  labels?: Partial<QueryBuilderLabels>
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
    props.onQueryChange?.(props.builder.toQuery())
  })

  const copy = (): QueryBuilderLabels => ({
    ...defaultQueryBuilderLabels,
    ...props.labels,
    ...(props.addLabel === undefined ? {} : { addRule: props.addLabel }),
  })
  const issuesFor = (id: string): QueryValidationIssue[] => {
    state()
    return props.builder.validate().issues.filter((issue) => issue.nodeId === id)
  }
  const renderRule = (rule: QueryRuleNode): JSX.Element => {
    const ruleIssues = () => issuesFor(rule.id)
    const invalid = () => ruleIssues().length > 0
    const errorId = `${rule.id}-error`
    return (
      <div data-iris-query-rule="" data-node-id={rule.id}>
        <select
          data-iris-query-column=""
          value={rule.key}
          aria-label={copy().column}
          aria-invalid={invalid() || undefined}
          aria-describedby={invalid() ? errorId : undefined}
          onChange={(event) =>
            props.builder.updateRule(rule.id, { key: event.currentTarget.value })
          }
        >
          <For each={props.builder.columns}>
            {(column) => <option value={column.key}>{column.label}</option>}
          </For>
        </select>
        <select
          data-iris-query-operator=""
          value={rule.operator}
          aria-label={copy().operator}
          aria-invalid={invalid() || undefined}
          aria-describedby={invalid() ? errorId : undefined}
          onChange={(event) =>
            props.builder.updateRule(rule.id, {
              operator: event.currentTarget.value as FilterOperator,
            })
          }
        >
          <For each={props.builder.operatorsFor(rule.key)}>
            {(operator) => <option value={operator}>{operatorLabels[operator]}</option>}
          </For>
        </select>
        <input
          data-iris-query-value=""
          value={rule.value}
          aria-label={copy().value}
          aria-invalid={invalid() || undefined}
          aria-describedby={invalid() ? errorId : undefined}
          onInput={(event) =>
            props.builder.updateRule(rule.id, { value: event.currentTarget.value })
          }
        />
        <button
          type="button"
          data-iris-query-remove=""
          aria-label={copy().removeRule}
          onClick={() => props.builder.removeRule(rule.id)}
        >
          ×
        </button>
        {invalid() && (
          <span id={errorId} data-iris-query-error="" role="alert">
            {ruleIssues()
              .map((issue) => issue.message)
              .join('. ')}
          </span>
        )}
      </div>
    )
  }
  const renderGroup = (group: QueryGroup, depth: number, root = false): JSX.Element => (
    <fieldset data-iris-query-group="" data-group-id={group.id} data-depth={depth}>
      <legend>{root ? copy().rootGroup : copy().nestedGroup}</legend>
      <label>
        <span>{copy().combinator}</span>
        <select
          data-iris-query-combinator=""
          value={group.combinator}
          aria-label={`${copy().combinator}: ${root ? copy().rootGroup : copy().nestedGroup}`}
          onChange={(event) =>
            props.builder.updateGroup(group.id, {
              combinator: event.currentTarget.value as QueryGroup['combinator'],
            })
          }
        >
          <option value="and">{copy().matchAll}</option>
          <option value="or">{copy().matchAny}</option>
        </select>
      </label>
      <div data-iris-query-children="">
        <For each={group.children}>
          {(node) => (node.type === 'group' ? renderGroup(node, depth + 1) : renderRule(node))}
        </For>
      </div>
      <div data-iris-query-group-actions="">
        <button
          type="button"
          data-iris-query-add-rule=""
          data-iris-query-add={root ? '' : undefined}
          onClick={() => props.builder.addRule(group.id)}
        >
          {copy().addRule}
        </button>
        <button
          type="button"
          data-iris-query-add-group=""
          onClick={() => props.builder.addGroup(group.id)}
        >
          {copy().addGroup}
        </button>
        {!root && (
          <button
            type="button"
            data-iris-query-remove-group=""
            aria-label={copy().removeGroup}
            onClick={() => props.builder.removeGroup(group.id)}
          >
            {copy().removeGroup}
          </button>
        )}
      </div>
    </fieldset>
  )

  return (
    <div data-iris-query-builder="" class={props.class}>
      {renderGroup(state().root, 0, true)}
    </div>
  )
}
