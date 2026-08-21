import { createEffect, createSignal, onCleanup, type JSX } from 'solid-js'
import {
  defaultQueryBuilderLabels,
  type CompiledQueryGroup,
  type FilterBuilder,
  type FilterRule,
  type QueryBuilderLabels,
  type QueryValidationIssue,
} from '@iris-ui-kit/plugin-query-builder/core'
import { QueryGroupView } from './query-group'

// The recursive child renders the data-iris-query-group marker (kept in the
// entry source as well so the adapter's SSR transform smoke test can inspect it).

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

/** Visual query builder for SolidJS over the framework-independent builder. */
export function IrisQueryBuilder(props: IrisQueryBuilderProps): JSX.Element {
  const [state, setState] = createSignal(props.builder.getState())
  onCleanup(props.builder.subscribe(setState))

  createEffect(() => {
    state()
    props.onChange?.(props.builder.toFilterRules())
    props.onQueryChange?.(props.builder.toQuery())
  })

  const labels = (): QueryBuilderLabels => ({
    ...defaultQueryBuilderLabels,
    ...props.labels,
    ...(props.addLabel === undefined ? {} : { addRule: props.addLabel }),
  })
  const issuesFor = (id: string): QueryValidationIssue[] => {
    state()
    return props.builder.validate().issues.filter((issue) => issue.nodeId === id)
  }

  return (
    <div data-iris-query-builder="" class={props.class}>
      <QueryGroupView
        builder={props.builder}
        group={state().root}
        depth={0}
        root
        labels={labels}
        issuesFor={issuesFor}
      />
    </div>
  )
}
