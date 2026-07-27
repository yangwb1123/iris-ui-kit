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
  operatorLabels,
  type FilterBuilder,
  type FilterBuilderState,
  type FilterOperator,
  type FilterRule,
} from '../core'

export type {
  FilterBuilder,
  FilterBuilderConfig,
  QueryColumn,
  QueryRule,
  FilterRule,
  FilterOperator,
} from '../core'
export { createFilterBuilder, queryBuilderPlugin, operatorsByType, operatorLabels } from '../core'

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
    /** Label for the add-rule button. Default `'Add rule'`. */
    addLabel: { type: String, default: 'Add rule' },
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
      })
    })
    onScopeDispose(() => unsub())

    return () => {
      const ruleNodes: VNode[] = state.value.rules.map((rule) =>
        h('div', { key: rule.id, 'data-iris-query-rule': '' }, [
          h(
            'select',
            {
              'data-iris-query-column': '',
              value: rule.key,
              'aria-label': 'Column',
              onChange: (e: Event) =>
                builder.updateRule(rule.id, { key: (e.target as HTMLSelectElement).value }),
            },
            builder.columns.map((c) => h('option', { key: c.key, value: c.key }, c.label)),
          ),
          h(
            'select',
            {
              'data-iris-query-operator': '',
              value: rule.operator,
              'aria-label': 'Operator',
              onChange: (e: Event) =>
                builder.updateRule(rule.id, {
                  operator: (e.target as HTMLSelectElement).value as FilterOperator,
                }),
            },
            builder
              .operatorsFor(rule.key)
              .map((op) => h('option', { key: op, value: op }, operatorLabels[op])),
          ),
          h('input', {
            'data-iris-query-value': '',
            value: rule.value,
            'aria-label': 'Value',
            onInput: (e: Event) =>
              builder.updateRule(rule.id, { value: (e.target as HTMLInputElement).value }),
          }),
          h(
            'button',
            {
              type: 'button',
              'data-iris-query-remove': '',
              'aria-label': 'Remove rule',
              onClick: () => builder.removeRule(rule.id),
            },
            '×',
          ),
        ]),
      )

      return h('div', { 'data-iris-query-builder': '', class: props.className }, [
        ...ruleNodes,
        h(
          'button',
          {
            type: 'button',
            'data-iris-query-add': '',
            onClick: () => builder.addRule(),
          },
          props.addLabel,
        ),
      ])
    }
  },
})
