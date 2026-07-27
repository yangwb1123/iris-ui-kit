import type { FilterOperator, FilterRule, Store } from '@iris-ui-kit/core'

export type { FilterOperator, FilterRule } from '@iris-ui-kit/core'

export type QueryColumnType = 'string' | 'number' | 'date' | 'enum' | 'boolean'

export interface QueryColumn {
  key: string
  label: string
  type: QueryColumnType
  /** Selectable values for an `enum` column. */
  options?: { label: string; value: string }[]
}

/** One legacy flat rule row. */
export interface QueryRule {
  id: string
  key: string
  operator: FilterOperator
  value: string
}

export type QueryCombinator = 'and' | 'or'

/** A rule in the recursive query AST. Kept separate from legacy `QueryRule`. */
export interface QueryRuleNode extends QueryRule {
  type: 'rule'
}

/** Recursive AND/OR group. IDs remain stable across edits and serialization. */
export interface QueryGroup {
  type: 'group'
  id: string
  combinator: QueryCombinator
  children: QueryNode[]
}

export type QueryNode = QueryRuleNode | QueryGroup

export interface QueryRuleInput {
  type?: 'rule'
  id?: string
  key?: string
  operator?: FilterOperator
  value?: string
}

export interface QueryGroupInput {
  type?: 'group'
  id?: string
  combinator?: QueryCombinator
  children?: readonly QueryNodeInput[]
}

export type QueryNodeInput = QueryRuleInput | QueryGroupInput

export interface CompiledQueryRule extends FilterRule {
  type: 'rule'
  id: string
}

export interface CompiledQueryGroup {
  type: 'group'
  id: string
  combinator: QueryCombinator
  children: CompiledQueryNode[]
}

export type CompiledQueryNode = CompiledQueryRule | CompiledQueryGroup

export type QueryValidationCode =
  | 'duplicate-id'
  | 'invalid-id'
  | 'invalid-node'
  | 'invalid-combinator'
  | 'unknown-field'
  | 'invalid-operator'
  | 'missing-value'
  | 'invalid-value'
  | 'max-depth'

export interface QueryValidationIssue {
  code: QueryValidationCode
  nodeId?: string
  path: number[]
  message: string
}

export interface QueryValidationResult {
  valid: boolean
  issues: QueryValidationIssue[]
}

export interface QueryBuilderLabels {
  addRule: string
  addGroup: string
  removeRule: string
  removeGroup: string
  rootGroup: string
  nestedGroup: string
  combinator: string
  matchAll: string
  matchAny: string
  column: string
  operator: string
  value: string
}

export const defaultQueryBuilderLabels: QueryBuilderLabels = {
  addRule: 'Add rule',
  addGroup: 'Add group',
  removeRule: 'Remove rule',
  removeGroup: 'Remove group',
  rootGroup: 'Filters',
  nestedGroup: 'Filter group',
  combinator: 'Match',
  matchAll: 'All',
  matchAny: 'Any',
  column: 'Column',
  operator: 'Operator',
  value: 'Value',
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
  /** Recursive initial AST. Takes precedence over `initialRules`. */
  initialQuery?: QueryGroupInput
}

export interface FilterBuilderState {
  /** Legacy root-level rule projection retained for existing consumers. */
  rules: QueryRule[]
  /** Canonical recursive query AST. */
  root: QueryGroup
}

export interface FilterBuilder {
  store: Store<FilterBuilderState>
  getState(): FilterBuilderState
  subscribe(listener: (state: FilterBuilderState) => void): () => void
  columns: QueryColumn[]
  operatorsFor(key: string): FilterOperator[]
  columnFor(key: string): QueryColumn | undefined
  addRule(groupId?: string): string
  addGroup(parentGroupId?: string, combinator?: QueryCombinator): string
  removeRule(id: string): void
  removeGroup(id: string): void
  updateRule(id: string, patch: Partial<Pick<QueryRule, 'key' | 'operator' | 'value'>>): void
  updateGroup(id: string, patch: Partial<Pick<QueryGroup, 'combinator'>>): void
  replaceQuery(query: QueryGroupInput): void
  clear(): void
  validate(): QueryValidationResult
  toQuery(): CompiledQueryGroup
  serialize(): string
  matches<Row>(row: Row, getValue?: (row: Row, key: string) => unknown): boolean
  filter<Row>(rows: readonly Row[], getValue?: (row: Row, key: string) => unknown): Row[]
  /**
   * Compile complete leaves to the legacy flat engine shape. Nested OR
   * semantics cannot be represented here; use `toQuery` or `matches` for them.
   */
  toFilterRules(): FilterRule[]
}

export const QUERY_AST_VERSION = 1
export const MAX_QUERY_DEPTH = 20
