import { For, type Accessor, type JSX } from 'solid-js'
import {
  type FilterBuilder,
  type QueryBuilderLabels,
  type QueryGroup,
  type QueryRuleNode,
  type QueryValidationIssue,
} from '@iris-ui-kit/plugin-query-builder/core'
import { QueryRuleView } from './query-rule'

export interface QueryGroupViewProps {
  builder: FilterBuilder
  group: QueryGroup
  depth: number
  root?: boolean
  labels: Accessor<QueryBuilderLabels>
  issuesFor: (id: string) => QueryValidationIssue[]
}

function QueryGroupHeader(props: {
  builder: FilterBuilder
  group: QueryGroup
  root: boolean
  labels: Accessor<QueryBuilderLabels>
}): JSX.Element {
  return (
    <>
      <legend>{props.root ? props.labels().rootGroup : props.labels().nestedGroup}</legend>
      <label>
        <span>{props.labels().combinator}</span>
        <select
          data-iris-query-combinator=""
          value={props.group.combinator}
          aria-label={`${props.labels().combinator}: ${props.root ? props.labels().rootGroup : props.labels().nestedGroup}`}
          onChange={(event) =>
            props.builder.updateGroup(props.group.id, {
              combinator: event.currentTarget.value as QueryGroup['combinator'],
            })
          }
        >
          <option value="and">{props.labels().matchAll}</option>
          <option value="or">{props.labels().matchAny}</option>
        </select>
      </label>
    </>
  )
}

function QueryGroupChildren(
  props: Omit<QueryGroupViewProps, 'depth' | 'root'> & { depth: number },
): JSX.Element {
  return (
    <div data-iris-query-children="">
      <For each={props.group.children}>
        {(node) =>
          node.type === 'group' ? (
            <QueryGroupView
              builder={props.builder}
              group={node}
              depth={props.depth + 1}
              labels={props.labels}
              issuesFor={props.issuesFor}
            />
          ) : (
            <QueryRuleView
              builder={props.builder}
              rule={node as QueryRuleNode}
              labels={props.labels}
              issuesFor={props.issuesFor}
            />
          )
        }
      </For>
    </div>
  )
}

function QueryGroupActions(props: {
  builder: FilterBuilder
  group: QueryGroup
  root: boolean
  labels: Accessor<QueryBuilderLabels>
}): JSX.Element {
  return (
    <div data-iris-query-group-actions="">
      <button
        type="button"
        data-iris-query-add-rule=""
        data-iris-query-add={props.root ? '' : undefined}
        onClick={() => props.builder.addRule(props.group.id)}
      >
        {props.labels().addRule}
      </button>
      <button
        type="button"
        data-iris-query-add-group=""
        onClick={() => props.builder.addGroup(props.group.id)}
      >
        {props.labels().addGroup}
      </button>
      {!props.root && (
        <button
          type="button"
          data-iris-query-remove-group=""
          aria-label={props.labels().removeGroup}
          onClick={() => props.builder.removeGroup(props.group.id)}
        >
          {props.labels().removeGroup}
        </button>
      )}
    </div>
  )
}

/** Recursive group renderer used by the Solid query builder adapter. */
export function QueryGroupView(props: QueryGroupViewProps): JSX.Element {
  const root = props.root ?? false
  return (
    <fieldset data-iris-query-group="" data-group-id={props.group.id} data-depth={props.depth}>
      <QueryGroupHeader
        builder={props.builder}
        group={props.group}
        root={root}
        labels={props.labels}
      />
      <QueryGroupChildren
        builder={props.builder}
        group={props.group}
        depth={props.depth}
        labels={props.labels}
        issuesFor={props.issuesFor}
      />
      <QueryGroupActions
        builder={props.builder}
        group={props.group}
        root={root}
        labels={props.labels}
      />
    </fieldset>
  )
}
