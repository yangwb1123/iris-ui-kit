import * as React from 'react'
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
  /** Called with the recursive, typed AND/OR query whenever the AST changes. */
  onQueryChange?: (query: CompiledQueryGroup) => void
  /** Label for the add-rule button. Default `'Add rule'`. */
  addLabel?: string
  labels?: Partial<QueryBuilderLabels>
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
  onQueryChange,
  addLabel,
  labels,
  className,
}: IrisQueryBuilderProps): React.ReactElement {
  const state = React.useSyncExternalStore(builder.subscribe, builder.getState, builder.getState)
  const onChangeRef = React.useRef(onChange)
  const onQueryChangeRef = React.useRef(onQueryChange)
  onChangeRef.current = onChange
  onQueryChangeRef.current = onQueryChange
  React.useEffect(() => {
    onChangeRef.current?.(builder.toFilterRules())
    onQueryChangeRef.current?.(builder.toQuery())
  }, [state, builder])

  const copy: QueryBuilderLabels = {
    ...defaultQueryBuilderLabels,
    ...labels,
    ...(addLabel === undefined ? {} : { addRule: addLabel }),
  }
  const issues = builder.validate().issues
  const issuesFor = (id: string): QueryValidationIssue[] =>
    issues.filter((issue) => issue.nodeId === id)

  const renderRule = (rule: QueryRuleNode): React.ReactElement => {
    const ruleIssues = issuesFor(rule.id)
    const errorId = `${rule.id}-error`
    const invalid = ruleIssues.length > 0
    return (
      <div key={rule.id} data-iris-query-rule="" data-node-id={rule.id}>
        <select
          data-iris-query-column=""
          value={rule.key}
          aria-label={copy.column}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => builder.updateRule(rule.id, { key: event.target.value })}
        >
          {builder.columns.map((column) => (
            <option key={column.key} value={column.key}>
              {column.label}
            </option>
          ))}
        </select>
        <select
          data-iris-query-operator=""
          value={rule.operator}
          aria-label={copy.operator}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) =>
            builder.updateRule(rule.id, {
              operator: event.target.value as FilterOperator,
            })
          }
        >
          {builder.operatorsFor(rule.key).map((operator) => (
            <option key={operator} value={operator}>
              {operatorLabels[operator]}
            </option>
          ))}
        </select>
        <input
          data-iris-query-value=""
          value={rule.value}
          aria-label={copy.value}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => builder.updateRule(rule.id, { value: event.target.value })}
        />
        <button
          type="button"
          data-iris-query-remove=""
          aria-label={copy.removeRule}
          onClick={() => builder.removeRule(rule.id)}
        >
          ×
        </button>
        {invalid && (
          <span id={errorId} data-iris-query-error="" role="alert">
            {ruleIssues.map((issue) => issue.message).join('. ')}
          </span>
        )}
      </div>
    )
  }

  const renderGroup = (group: QueryGroup, depth: number, root = false): React.ReactElement => (
    <fieldset key={group.id} data-iris-query-group="" data-group-id={group.id} data-depth={depth}>
      <legend>{root ? copy.rootGroup : copy.nestedGroup}</legend>
      <label>
        <span>{copy.combinator}</span>
        <select
          data-iris-query-combinator=""
          value={group.combinator}
          aria-label={`${copy.combinator}: ${root ? copy.rootGroup : copy.nestedGroup}`}
          onChange={(event) =>
            builder.updateGroup(group.id, {
              combinator: event.target.value as QueryGroup['combinator'],
            })
          }
        >
          <option value="and">{copy.matchAll}</option>
          <option value="or">{copy.matchAny}</option>
        </select>
      </label>
      <div data-iris-query-children="">
        {group.children.map((node) =>
          node.type === 'group' ? renderGroup(node, depth + 1) : renderRule(node),
        )}
      </div>
      <div data-iris-query-group-actions="">
        <button
          type="button"
          data-iris-query-add-rule=""
          {...(root ? { 'data-iris-query-add': '' } : {})}
          onClick={() => builder.addRule(group.id)}
        >
          {copy.addRule}
        </button>
        <button
          type="button"
          data-iris-query-add-group=""
          onClick={() => builder.addGroup(group.id)}
        >
          {copy.addGroup}
        </button>
        {!root && (
          <button
            type="button"
            data-iris-query-remove-group=""
            aria-label={copy.removeGroup}
            onClick={() => builder.removeGroup(group.id)}
          >
            {copy.removeGroup}
          </button>
        )}
      </div>
    </fieldset>
  )

  return (
    <div data-iris-query-builder="" className={className}>
      {renderGroup(state.root, 0, true)}
    </div>
  )
}
