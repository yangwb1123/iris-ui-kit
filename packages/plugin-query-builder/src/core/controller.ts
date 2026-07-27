import { createStore, type FilterOperator, type FilterRule } from '@iris-ui-kit/core'
import {
  compileQuery,
  filterByQuery,
  matchesQuery,
  normalizeQuery,
  serializeQuery,
  validateQuery,
} from './ast'
import { collectQueryIds, createDefaultQueryRule, freshQueryId } from './internal'
import {
  operatorsByType,
  type CompiledQueryNode,
  type FilterBuilder,
  type FilterBuilderConfig,
  type FilterBuilderState,
  type QueryColumn,
  type QueryCombinator,
  type QueryGroup,
  type QueryGroupInput,
  type QueryNode,
  type QueryRule,
  type QueryRuleNode,
} from './model'

function legacyRules(root: QueryGroup): QueryRule[] {
  return root.children.flatMap((node) =>
    node.type === 'rule'
      ? [{ id: node.id, key: node.key, operator: node.operator, value: node.value }]
      : [],
  )
}

function stateWithRoot(root: QueryGroup): FilterBuilderState {
  return { root, rules: legacyRules(root) }
}

function appendToGroup(
  group: QueryGroup,
  targetId: string,
  node: QueryNode,
): [QueryGroup, boolean] {
  if (group.id === targetId) {
    return [{ ...group, children: [...group.children, node] }, true]
  }
  let found = false
  const children = group.children.map((child) => {
    if (found || child.type === 'rule') return child
    const [next, nestedFound] = appendToGroup(child, targetId, node)
    if (nestedFound) found = true
    return next
  })
  return [found ? { ...group, children } : group, found]
}

function removeNode(group: QueryGroup, id: string, type: QueryNode['type']): QueryGroup {
  const children = group.children
    .filter((child) => !(child.id === id && child.type === type))
    .map((child) => (child.type === 'group' ? removeNode(child, id, type) : child))
  return children.length === group.children.length &&
    children.every((child, index) => child === group.children[index])
    ? group
    : { ...group, children }
}

function mapRule(
  group: QueryGroup,
  id: string,
  update: (rule: QueryRuleNode) => QueryRuleNode,
): QueryGroup {
  const children = group.children.map((child) =>
    child.type === 'rule' ? (child.id === id ? update(child) : child) : mapRule(child, id, update),
  )
  return children.every((child, index) => child === group.children[index])
    ? group
    : { ...group, children }
}

function mapGroup(
  group: QueryGroup,
  id: string,
  update: (value: QueryGroup) => QueryGroup,
): QueryGroup {
  const current = group.id === id ? update(group) : group
  const children = current.children.map((child) =>
    child.type === 'group' ? mapGroup(child, id, update) : child,
  )
  return children.every((child, index) => child === current.children[index])
    ? current
    : { ...current, children }
}

function initialQuery(config: FilterBuilderConfig): QueryGroupInput {
  return (
    config.initialQuery ?? {
      type: 'group',
      combinator: 'and',
      children: (config.initialRules ?? []).map((rule) => ({ type: 'rule', ...rule })),
    }
  )
}

/**
 * Create the framework-independent recursive query controller. The legacy flat
 * rule API remains available as a root-rule projection.
 */
export function createFilterBuilder(config: FilterBuilderConfig): FilterBuilder {
  const columns = config.columns
  const columnFor = (key: string): QueryColumn | undefined =>
    columns.find((column) => column.key === key)
  const operatorsFor = (key: string): FilterOperator[] => {
    const column = columnFor(key)
    return column ? operatorsByType[column.type] : []
  }
  const store = createStore<FilterBuilderState>(
    stateWithRoot(normalizeQuery(initialQuery(config), columns)),
  )
  const setRoot = (update: (root: QueryGroup) => QueryGroup): void => {
    store.setState((state) => stateWithRoot(update(state.root)))
  }
  const makeRule = (): QueryRuleNode =>
    createDefaultQueryRule(columns, collectQueryIds(store.getState().root))
  const makeGroup = (combinator: QueryCombinator): QueryGroup => ({
    type: 'group',
    id: freshQueryId('query-group', collectQueryIds(store.getState().root)),
    combinator,
    children: [],
  })

  const builder: FilterBuilder = {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    columns,
    operatorsFor,
    columnFor,
    addRule(groupId) {
      const rule = makeRule()
      setRoot((root) => {
        const [next, found] = appendToGroup(root, groupId ?? root.id, rule)
        return found ? next : { ...root, children: [...root.children, rule] }
      })
      return rule.id
    },
    addGroup(parentGroupId, combinator = 'and') {
      const group = makeGroup(combinator)
      setRoot((root) => {
        const [next, found] = appendToGroup(root, parentGroupId ?? root.id, group)
        return found ? next : { ...root, children: [...root.children, group] }
      })
      return group.id
    },
    removeRule(id) {
      setRoot((root) => removeNode(root, id, 'rule'))
    },
    removeGroup(id) {
      setRoot((root) => (root.id === id ? root : removeNode(root, id, 'group')))
    },
    updateRule(id, patch) {
      setRoot((root) =>
        mapRule(root, id, (rule) => {
          const next = { ...rule, ...patch }
          if (patch.key !== undefined && patch.operator === undefined) {
            const operators = operatorsFor(patch.key)
            if (!operators.includes(next.operator)) next.operator = operators[0] ?? 'eq'
          }
          return next
        }),
      )
    },
    updateGroup(id, patch) {
      setRoot((root) =>
        mapGroup(root, id, (group) => ({
          ...group,
          combinator: patch.combinator ?? group.combinator,
        })),
      )
    },
    replaceQuery(query) {
      store.setState(stateWithRoot(normalizeQuery(query, columns)))
    },
    clear() {
      setRoot((root) => ({ ...root, children: [] }))
    },
    validate() {
      return validateQuery(store.getState().root, columns)
    },
    toQuery() {
      return compileQuery(store.getState().root, columns)
    },
    serialize() {
      return serializeQuery(store.getState().root)
    },
    matches(row, getValue) {
      return matchesQuery(row, builder.toQuery(), getValue)
    },
    filter(rows, getValue) {
      return filterByQuery(rows, builder.toQuery(), getValue)
    },
    toFilterRules() {
      const leaves: FilterRule[] = []
      const visit = (node: CompiledQueryNode): void => {
        if (node.type === 'group') node.children.forEach(visit)
        else leaves.push({ key: node.key, operator: node.operator, value: node.value })
      }
      visit(builder.toQuery())
      return leaves
    },
  }
  return builder
}
