import {
  defineComponent,
  h,
  onMounted,
  onScopeDispose,
  shallowRef,
  type PropType,
  type VNode,
} from 'vue'
import {
  defaultQueryBuilderLabels,
  operatorLabels,
  type CompiledQueryGroup,
  type FilterBuilder,
  type FilterBuilderState,
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

/**
 * Visual query builder for Vue (render-function authored to match the
 * `@iris-ui-kit/vue` convention — no `.vue` SFCs): stacked rule rows
 * (column → operator → value) over a {@link FilterBuilder}, emitting compiled
 * `FilterRule[]` via the `onChange` prop (wire it to `dataSource.setFilterRules`).
 * All logic lives in the builder. Bridges the core Store directly: a
 * `shallowRef` seeded from `store.getState()`, kept in sync via `store.subscribe`
 * in `onMounted` and detached in `onScopeDispose`.
 */
export const IrisQueryBuilder = defineComponent({
  name: 'IrisQueryBuilder',
  props: {
    builder: { type: Object as PropType<FilterBuilder>, required: true },
    /** Called with the compiled `FilterRule[]` whenever the rules change. */
    onChange: {
      type: Function as PropType<(rules: FilterRule[]) => void>,
      default: undefined,
    },
    onQueryChange: {
      type: Function as PropType<(query: CompiledQueryGroup) => void>,
      default: undefined,
    },
    /** Label for the add-rule button. Default `'Add rule'`. */
    addLabel: { type: String, default: undefined },
    labels: {
      type: Object as PropType<Partial<QueryBuilderLabels>>,
      default: undefined,
    },
    className: { type: String as PropType<string | undefined>, default: undefined },
  },
  setup(props) {
    const builder = props.builder
    const state = shallowRef<FilterBuilderState>(builder.getState())

    let unsub = () => {}
    onMounted(() => {
      unsub = builder.subscribe((s) => {
        state.value = s
        props.onChange?.(builder.toFilterRules())
        props.onQueryChange?.(builder.toQuery())
      })
    })
    onScopeDispose(() => unsub())

    return () => {
      const copy: QueryBuilderLabels = {
        ...defaultQueryBuilderLabels,
        ...props.labels,
        ...(props.addLabel === undefined ? {} : { addRule: props.addLabel }),
      }
      const issues = builder.validate().issues
      const issuesFor = (id: string): QueryValidationIssue[] =>
        issues.filter((issue) => issue.nodeId === id)

      const renderRule = (rule: QueryRuleNode): VNode => {
        const ruleIssues = issuesFor(rule.id)
        const invalid = ruleIssues.length > 0
        const errorId = `${rule.id}-error`
        return h('div', { key: rule.id, 'data-iris-query-rule': '', 'data-node-id': rule.id }, [
          h(
            'select',
            {
              'data-iris-query-column': '',
              value: rule.key,
              'aria-label': copy.column,
              'aria-invalid': invalid ? 'true' : undefined,
              'aria-describedby': invalid ? errorId : undefined,
              onChange: (event: Event) =>
                builder.updateRule(rule.id, {
                  key: (event.target as HTMLSelectElement).value,
                }),
            },
            builder.columns.map((column) =>
              h('option', { key: column.key, value: column.key }, column.label),
            ),
          ),
          h(
            'select',
            {
              'data-iris-query-operator': '',
              value: rule.operator,
              'aria-label': copy.operator,
              'aria-invalid': invalid ? 'true' : undefined,
              'aria-describedby': invalid ? errorId : undefined,
              onChange: (event: Event) =>
                builder.updateRule(rule.id, {
                  operator: (event.target as HTMLSelectElement).value as FilterOperator,
                }),
            },
            builder
              .operatorsFor(rule.key)
              .map((operator) =>
                h('option', { key: operator, value: operator }, operatorLabels[operator]),
              ),
          ),
          h('input', {
            'data-iris-query-value': '',
            value: rule.value,
            'aria-label': copy.value,
            'aria-invalid': invalid ? 'true' : undefined,
            'aria-describedby': invalid ? errorId : undefined,
            onInput: (event: Event) =>
              builder.updateRule(rule.id, {
                value: (event.target as HTMLInputElement).value,
              }),
          }),
          h(
            'button',
            {
              type: 'button',
              'data-iris-query-remove': '',
              'aria-label': copy.removeRule,
              onClick: () => builder.removeRule(rule.id),
            },
            '×',
          ),
          invalid
            ? h(
                'span',
                { id: errorId, 'data-iris-query-error': '', role: 'alert' },
                ruleIssues.map((issue) => issue.message).join('. '),
              )
            : null,
        ])
      }

      const renderGroup = (group: QueryGroup, depth: number, root = false): VNode =>
        h(
          'fieldset',
          {
            key: group.id,
            'data-iris-query-group': '',
            'data-group-id': group.id,
            'data-depth': depth,
          },
          [
            h('legend', root ? copy.rootGroup : copy.nestedGroup),
            h('label', [
              h('span', copy.combinator),
              h(
                'select',
                {
                  'data-iris-query-combinator': '',
                  value: group.combinator,
                  'aria-label': `${copy.combinator}: ${root ? copy.rootGroup : copy.nestedGroup}`,
                  onChange: (event: Event) =>
                    builder.updateGroup(group.id, {
                      combinator: (event.target as HTMLSelectElement)
                        .value as QueryGroup['combinator'],
                    }),
                },
                [
                  h('option', { value: 'and' }, copy.matchAll),
                  h('option', { value: 'or' }, copy.matchAny),
                ],
              ),
            ]),
            h(
              'div',
              { 'data-iris-query-children': '' },
              group.children.map((node) =>
                node.type === 'group' ? renderGroup(node, depth + 1) : renderRule(node),
              ),
            ),
            h('div', { 'data-iris-query-group-actions': '' }, [
              h(
                'button',
                {
                  type: 'button',
                  'data-iris-query-add-rule': '',
                  ...(root ? { 'data-iris-query-add': '' } : {}),
                  onClick: () => builder.addRule(group.id),
                },
                copy.addRule,
              ),
              h(
                'button',
                {
                  type: 'button',
                  'data-iris-query-add-group': '',
                  onClick: () => builder.addGroup(group.id),
                },
                copy.addGroup,
              ),
              root
                ? null
                : h(
                    'button',
                    {
                      type: 'button',
                      'data-iris-query-remove-group': '',
                      'aria-label': copy.removeGroup,
                      onClick: () => builder.removeGroup(group.id),
                    },
                    copy.removeGroup,
                  ),
            ]),
          ],
        )

      return h('div', { 'data-iris-query-builder': '', class: props.className }, [
        renderGroup(state.value.root, 0, true),
      ])
    }
  },
})
