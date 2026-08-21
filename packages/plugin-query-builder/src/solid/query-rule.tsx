import { For, type Accessor, type JSX } from 'solid-js'
import {
  operatorLabels,
  type FilterBuilder,
  type FilterOperator,
  type QueryBuilderLabels,
  type QueryRuleNode,
  type QueryValidationIssue,
} from '@iris-ui-kit/plugin-query-builder/core'

export interface QueryRuleViewProps {
  builder: FilterBuilder
  rule: QueryRuleNode
  labels: Accessor<QueryBuilderLabels>
  issuesFor: (id: string) => QueryValidationIssue[]
}

function QueryRuleControls(props: {
  builder: FilterBuilder
  rule: QueryRuleNode
  labels: Accessor<QueryBuilderLabels>
  invalid: Accessor<boolean>
  errorId: string
}): JSX.Element {
  return (
    <>
      <select
        data-iris-query-column=""
        value={props.rule.key}
        aria-label={props.labels().column}
        aria-invalid={props.invalid() || undefined}
        aria-describedby={props.invalid() ? props.errorId : undefined}
        onChange={(event) =>
          props.builder.updateRule(props.rule.id, { key: event.currentTarget.value })
        }
      >
        <For each={props.builder.columns}>
          {(column) => <option value={column.key}>{column.label}</option>}
        </For>
      </select>
      <select
        data-iris-query-operator=""
        value={props.rule.operator}
        aria-label={props.labels().operator}
        aria-invalid={props.invalid() || undefined}
        aria-describedby={props.invalid() ? props.errorId : undefined}
        onChange={(event) =>
          props.builder.updateRule(props.rule.id, {
            operator: event.currentTarget.value as FilterOperator,
          })
        }
      >
        <For each={props.builder.operatorsFor(props.rule.key)}>
          {(operator) => <option value={operator}>{operatorLabels[operator]}</option>}
        </For>
      </select>
      <input
        data-iris-query-value=""
        value={props.rule.value}
        aria-label={props.labels().value}
        aria-invalid={props.invalid() || undefined}
        aria-describedby={props.invalid() ? props.errorId : undefined}
        onInput={(event) =>
          props.builder.updateRule(props.rule.id, { value: event.currentTarget.value })
        }
      />
      <button
        type="button"
        data-iris-query-remove=""
        aria-label={props.labels().removeRule}
        onClick={() => props.builder.removeRule(props.rule.id)}
      >
        ×
      </button>
    </>
  )
}

/** Render one column/operator/value row over the shared FilterBuilder. */
export function QueryRuleView(props: QueryRuleViewProps): JSX.Element {
  const issues = () => props.issuesFor(props.rule.id)
  const invalid = () => issues().length > 0
  const errorId = `${props.rule.id}-error`

  return (
    <div data-iris-query-rule="" data-node-id={props.rule.id}>
      <QueryRuleControls
        builder={props.builder}
        rule={props.rule}
        labels={props.labels}
        invalid={invalid}
        errorId={errorId}
      />
      {invalid() && (
        <span id={errorId} data-iris-query-error="" role="alert">
          {issues()
            .map((issue) => issue.message)
            .join('. ')}
        </span>
      )}
    </div>
  )
}
