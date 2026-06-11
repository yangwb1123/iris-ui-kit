import {
  createStore,
  createPlugin,
  generateId,
  type Store,
  type FilterRule,
  type FilterOperator,
} from '@iris-ui/core'

/**
 * `@iris-ui/plugin-query-builder` — a visual composer over the data engine's
 * typed filter operators. core/data-view's {@link FilterRule} + the filterSort /
 * createDataSource pipeline already support operators (eq/gt/contains/in/between
 * …) but had NO UI to build them; this plugin's `createFilterBuilder` manages a
 * list of editable rule rows and compiles them to `FilterRule[]` for
 * `createDataSource.setFilterRules()`. The four `IrisQueryBuilder` renderers draw
 * the rows; all logic lives here.
 */

export type { FilterRule, FilterOperator } from '@iris-ui/core'

export type QueryColumnType = 'string' | 'number' | 'date' | 'enum' | 'boolean'

export interface QueryColumn {
  key: string
  label: string
  type: QueryColumnType
  /** Selectable values for an `enum` column. */
  options?: { label: string; value: string }[]
}

/** One rule row: a column, an operator valid for its type, and a (string) value. */
export interface QueryRule {
  id: string
  key: string
  operator: FilterOperator
  value: string
}

/** Operators offered per column type (a subset of the engine's full set). */
export const operatorsByType: Record<QueryColumnType, FilterOperator[]> = {
  string: ['contains', 'startsWith', 'endsWith', 'eq', 'ne'],
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between'],
  date: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between'],
  enum: ['eq', 'ne', 'in'],
  boolean: ['eq', 'ne'],
}

/** Default English operator labels (override/localize at the renderer). */
export const operatorLabels: Record<FilterOperator, string> = {
  eq: 'equals',
  ne: 'not equals',
  gt: 'greater than',
  gte: 'at least',
  lt: 'less than',
  lte: 'at most',
  contains: 'contains',
  startsWith: 'starts with',
  endsWith: 'ends with',
  in: 'in (comma-sep)',
  between: 'between (a,b)',
}

export interface FilterBuilderConfig {
  columns: QueryColumn[]
  initialRules?: Omit<QueryRule, 'id'>[]
}

export interface FilterBuilderState {
  rules: QueryRule[]
}

export interface FilterBuilder {
  store: Store<FilterBuilderState>
  getState(): FilterBuilderState
  subscribe(listener: (s: FilterBuilderState) => void): () => void
  columns: QueryColumn[]
  /** Operators valid for a column key (empty if the key is unknown). */
  operatorsFor(key: string): FilterOperator[]
  columnFor(key: string): QueryColumn | undefined
  /** Append a rule (first column + its first operator + empty value). */
  addRule(): void
  removeRule(id: string): void
  /** Patch a rule; switching column resets the operator to a valid one. */
  updateRule(id: string, patch: Partial<Pick<QueryRule, 'key' | 'operator' | 'value'>>): void
  clear(): void
  /**
   * The COMPLETE rules compiled to core `FilterRule[]`: drops the row id + any
   * rule with an empty value, and coerces values per column type / operator
   * (numbers; `in` → array; `between` → `[a,b]`). Pass to
   * `createDataSource.setFilterRules()` / `filterSort`.
   */
  toFilterRules(): FilterRule[]
}

export function createFilterBuilder(config: FilterBuilderConfig): FilterBuilder {
  const columns = config.columns
  const columnFor = (key: string): QueryColumn | undefined => columns.find((c) => c.key === key)
  const operatorsFor = (key: string): FilterOperator[] => {
    const col = columnFor(key)
    return col ? operatorsByType[col.type] : []
  }
  const newRule = (): QueryRule => {
    const key = columns[0]?.key ?? ''
    return { id: generateId(), key, operator: operatorsFor(key)[0] ?? 'eq', value: '' }
  }

  const store = createStore<FilterBuilderState>({
    rules: (config.initialRules ?? []).map((r) => ({ ...r, id: generateId() })),
  })

  const coerce = (
    col: QueryColumn | undefined,
    operator: FilterOperator,
    value: string,
  ): unknown => {
    const num = (s: string): number => Number(s.trim())
    const numeric = col?.type === 'number'
    if (operator === 'between') {
      const [a, b] = value.split(',')
      return numeric ? [num(a ?? ''), num(b ?? '')] : [(a ?? '').trim(), (b ?? '').trim()]
    }
    if (operator === 'in') {
      return value.split(',').map((s) => (numeric ? num(s) : s.trim()))
    }
    return numeric ? Number(value) : value
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    columns,
    operatorsFor,
    columnFor,
    addRule() {
      store.setState((s) => ({ rules: [...s.rules, newRule()] }))
    },
    removeRule(id) {
      store.setState((s) => ({ rules: s.rules.filter((r) => r.id !== id) }))
    },
    updateRule(id, patch) {
      store.setState((s) => ({
        rules: s.rules.map((r) => {
          if (r.id !== id) return r
          const next = { ...r, ...patch }
          if (patch.key !== undefined && patch.operator === undefined) {
            const ops = operatorsFor(patch.key)
            if (!ops.includes(next.operator)) next.operator = ops[0] ?? 'eq'
          }
          return next
        }),
      }))
    },
    clear() {
      store.setState({ rules: [] })
    },
    toFilterRules() {
      return store
        .getState()
        .rules.filter((r) => r.key && r.value.trim() !== '')
        .map((r) => ({
          key: r.key,
          operator: r.operator,
          value: coerce(columnFor(r.key), r.operator, r.value),
        }))
    },
  }
}

/** CSS custom properties the query builder reads; overridable by the host theme. */
export const queryBuilderTokens: Record<string, string> = {
  '--iris-query-builder-gap': 'var(--iris-gap-md, 8px)',
}

/**
 * The query-builder plugin. Pass to `<IrisProvider plugins={[queryBuilderPlugin]}>`
 * to register its theme tokens. The builder itself is `createFilterBuilder` +
 * the per-adapter `IrisQueryBuilder` renderer.
 */
export const queryBuilderPlugin = createPlugin({
  name: 'query-builder',
  install(registry) {
    registry.registerTokens(queryBuilderTokens)
  },
})
