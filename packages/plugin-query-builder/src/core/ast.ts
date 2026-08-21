import { compareValues, type FilterOperator } from '@iris-ui-kit/core'
import { claimQueryId, isRecord, SAFE_QUERY_ID } from './internal'
import {
  MAX_QUERY_DEPTH,
  operatorLabels,
  operatorsByType,
  QUERY_AST_VERSION,
  type CompiledQueryGroup,
  type CompiledQueryNode,
  type CompiledQueryRule,
  type QueryColumn,
  type QueryCombinator,
  type QueryGroup,
  type QueryRuleNode,
  type QueryValidationIssue,
  type QueryValidationResult,
} from './model'

const FILTER_OPERATORS = Object.keys(operatorLabels) as FilterOperator[]

interface QueryNormalizationContext {
  columns: readonly QueryColumn[]
  seen: Set<string>
}

function normalizeQueryRule(value: unknown, context: QueryNormalizationContext): QueryRuleNode {
  const source = isRecord(value) ? value : {}
  const fallbackColumn = context.columns[0]
  const key = typeof source.key === 'string' ? source.key : (fallbackColumn?.key ?? '')
  const column = context.columns.find((candidate) => candidate.key === key)
  const fallbackOperator = column
    ? operatorsByType[column.type][0]
    : fallbackColumn
      ? operatorsByType[fallbackColumn.type][0]
      : 'eq'
  const operator =
    typeof source.operator === 'string' &&
    FILTER_OPERATORS.includes(source.operator as FilterOperator)
      ? (source.operator as FilterOperator)
      : fallbackOperator
  return {
    type: 'rule',
    id: claimQueryId(source.id, 'query-rule', context.seen),
    key,
    operator,
    value:
      typeof source.value === 'string'
        ? source.value
        : source.value == null
          ? ''
          : String(source.value),
  }
}

function normalizeQueryGroup(
  value: unknown,
  depth: number,
  context: QueryNormalizationContext,
): QueryGroup {
  const source = isRecord(value) ? value : {}
  const id = claimQueryId(source.id, 'query-group', context.seen)
  const combinator: QueryCombinator = source.combinator === 'or' ? 'or' : 'and'
  const rawChildren = Array.isArray(source.children) ? source.children : []
  const children =
    depth >= MAX_QUERY_DEPTH
      ? []
      : rawChildren.map((child) =>
          isRecord(child) && (child.type === 'group' || Array.isArray(child.children))
            ? normalizeQueryGroup(child, depth + 1, context)
            : normalizeQueryRule(child, context),
        )
  return { type: 'group', id, combinator, children }
}

/**
 * Normalize unknown/deserialized input into a bounded recursive AST. Safe,
 * unique IDs are preserved; missing, duplicate, and unsafe IDs are replaced.
 */
export function normalizeQuery(input: unknown, columns: readonly QueryColumn[]): QueryGroup {
  const context: QueryNormalizationContext = { columns, seen: new Set<string>() }
  const rootInput = Array.isArray(input)
    ? { type: 'group', combinator: 'and', children: input }
    : isRecord(input) && (input.type === 'group' || Array.isArray(input.children))
      ? input
      : { type: 'group', combinator: 'and', children: [] }
  return normalizeQueryGroup(rootInput, 0, context)
}

function splitValue(value: string): string[] {
  return value.split(',').map((part) => part.trim())
}

function valueIssue(
  column: QueryColumn,
  operator: FilterOperator,
  value: string,
): { code: 'missing-value' | 'invalid-value'; message: string } | undefined {
  if (value.trim() === '') {
    return { code: 'missing-value', message: `${column.label} requires a value` }
  }
  const parts = splitValue(value)
  if (operator === 'between' && parts.length !== 2) {
    return { code: 'invalid-value', message: `${column.label} requires two comma-separated values` }
  }
  if (operator === 'in' && parts.some((part) => part === '')) {
    return { code: 'invalid-value', message: `${column.label} contains an empty list value` }
  }
  const checked = operator === 'between' || operator === 'in' ? parts : [value.trim()]
  if (column.type === 'number' && checked.some((part) => !Number.isFinite(Number(part)))) {
    return { code: 'invalid-value', message: `${column.label} requires finite numbers` }
  }
  if (column.type === 'date' && checked.some((part) => Number.isNaN(Date.parse(part)))) {
    return { code: 'invalid-value', message: `${column.label} requires valid dates` }
  }
  if (
    column.type === 'boolean' &&
    checked.some((part) => part.toLowerCase() !== 'true' && part.toLowerCase() !== 'false')
  ) {
    return { code: 'invalid-value', message: `${column.label} requires true or false` }
  }
  return undefined
}

interface ValidationContext {
  columns: readonly QueryColumn[]
  issues: QueryValidationIssue[]
  seen: Set<string>
}

function validateIdentity(
  node: Record<string, unknown>,
  path: number[],
  context: ValidationContext,
): string | undefined {
  const nodeId = typeof node.id === 'string' ? node.id : undefined
  if (!nodeId || !SAFE_QUERY_ID.test(nodeId)) {
    context.issues.push({ code: 'invalid-id', nodeId, path, message: 'Query node id is invalid' })
  } else if (context.seen.has(nodeId)) {
    context.issues.push({
      code: 'duplicate-id',
      nodeId,
      path,
      message: `Duplicate query id: ${nodeId}`,
    })
  } else {
    context.seen.add(nodeId)
  }
  return nodeId
}

function validateRule(
  node: Record<string, unknown>,
  nodeId: string | undefined,
  path: number[],
  context: ValidationContext,
): void {
  const key = typeof node.key === 'string' ? node.key : ''
  const column = context.columns.find((candidate) => candidate.key === key)
  if (!column) {
    context.issues.push({ code: 'unknown-field', nodeId, path, message: `Unknown field: ${key}` })
    return
  }
  const operator = node.operator as FilterOperator
  if (
    typeof node.operator !== 'string' ||
    !FILTER_OPERATORS.includes(operator) ||
    !operatorsByType[column.type].includes(operator)
  ) {
    context.issues.push({
      code: 'invalid-operator',
      nodeId,
      path,
      message: `${String(node.operator)} is not valid for ${column.label}`,
    })
    return
  }
  const issue =
    typeof node.value === 'string'
      ? valueIssue(column, operator, node.value)
      : { code: 'invalid-value' as const, message: `${column.label} value must be a string` }
  if (issue) context.issues.push({ ...issue, nodeId, path })
}

function visitForValidation(
  node: unknown,
  path: number[],
  depth: number,
  context: ValidationContext,
): void {
  if (!isRecord(node) || (node.type !== 'group' && node.type !== 'rule')) {
    context.issues.push({
      code: 'invalid-node',
      path,
      message: 'Query node must be a rule or group',
    })
    return
  }
  const nodeId = validateIdentity(node, path, context)
  if (depth > MAX_QUERY_DEPTH) {
    context.issues.push({
      code: 'max-depth',
      nodeId,
      path,
      message: `Query depth exceeds ${MAX_QUERY_DEPTH}`,
    })
    return
  }
  if (node.type === 'rule') {
    validateRule(node, nodeId, path, context)
    return
  }
  if (node.combinator !== 'and' && node.combinator !== 'or') {
    context.issues.push({
      code: 'invalid-combinator',
      nodeId,
      path,
      message: 'Group combinator must be and or or',
    })
  }
  if (!Array.isArray(node.children)) {
    context.issues.push({
      code: 'invalid-node',
      nodeId,
      path,
      message: 'Group children must be an array',
    })
    return
  }
  node.children.forEach((child, index) =>
    visitForValidation(child, [...path, index], depth + 1, context),
  )
}

/** Validate arbitrary AST input without mutating or repairing it. */
export function validateQuery(
  query: unknown,
  columns: readonly QueryColumn[],
): QueryValidationResult {
  const context: ValidationContext = { columns, issues: [], seen: new Set<string>() }
  visitForValidation(query, [], 0, context)
  return { valid: context.issues.length === 0, issues: context.issues }
}

function coerceValue(column: QueryColumn, operator: FilterOperator, value: string): unknown {
  const parts = splitValue(value)
  const coerceOne = (part: string): unknown => {
    if (column.type === 'number') return Number(part)
    if (column.type === 'boolean') return part.toLowerCase() === 'true'
    return part
  }
  if (operator === 'between' || operator === 'in') return parts.map(coerceOne)
  return coerceOne(value.trim())
}

function compileRule(
  rule: QueryRuleNode,
  columns: readonly QueryColumn[],
): CompiledQueryRule | undefined {
  const column = columns.find((candidate) => candidate.key === rule.key)
  if (
    !column ||
    !operatorsByType[column.type].includes(rule.operator) ||
    valueIssue(column, rule.operator, rule.value)
  ) {
    return undefined
  }
  return {
    type: 'rule',
    id: rule.id,
    key: rule.key,
    operator: rule.operator,
    value: coerceValue(column, rule.operator, rule.value),
  }
}

function compileGroup(
  group: QueryGroup,
  columns: readonly QueryColumn[],
  isRoot = false,
): CompiledQueryGroup | undefined {
  const children = group.children.flatMap<CompiledQueryNode>((node) => {
    const compiled =
      node.type === 'group' ? compileGroup(node, columns) : compileRule(node, columns)
    return compiled ? [compiled] : []
  })
  if (!isRoot && children.length === 0) return undefined
  return { type: 'group', id: group.id, combinator: group.combinator, children }
}

/** Compile editable string values into typed recursive rules; invalid leaves drop. */
export function compileQuery(
  query: QueryGroup,
  columns: readonly QueryColumn[],
): CompiledQueryGroup {
  return compileGroup(query, columns, true)!
}

export function serializeQuery(query: QueryGroup): string {
  return JSON.stringify({ version: QUERY_AST_VERSION, query })
}

export function deserializeQuery(serialized: string, columns: readonly QueryColumn[]): QueryGroup {
  try {
    const parsed: unknown = JSON.parse(serialized)
    const candidate = isRecord(parsed) && 'query' in parsed ? parsed.query : parsed
    return normalizeQuery(candidate, columns)
  } catch {
    return normalizeQuery(undefined, columns)
  }
}

type ValueMatcher = (actual: unknown, expected: unknown) => boolean

const text = (value: unknown): string => String(value ?? '').toLowerCase()

const valueMatchers: Record<FilterOperator, ValueMatcher> = {
  eq: (actual, expected) => compareValues(actual, expected) === 0,
  ne: (actual, expected) => compareValues(actual, expected) !== 0,
  gt: (actual, expected) => compareValues(actual, expected) > 0,
  gte: (actual, expected) => compareValues(actual, expected) >= 0,
  lt: (actual, expected) => compareValues(actual, expected) < 0,
  lte: (actual, expected) => compareValues(actual, expected) <= 0,
  contains: (actual, expected) => text(actual).includes(text(expected)),
  startsWith: (actual, expected) => text(actual).startsWith(text(expected)),
  endsWith: (actual, expected) => text(actual).endsWith(text(expected)),
  in: (actual, expected) =>
    Array.isArray(expected) && expected.some((item) => compareValues(actual, item) === 0),
  between: (actual, expected) =>
    Array.isArray(expected) &&
    expected.length >= 2 &&
    compareValues(actual, expected[0]) >= 0 &&
    compareValues(actual, expected[1]) <= 0,
}

/** Evaluate a compiled nested query with true AND/OR semantics. Empty groups match. */
export function matchesQuery<Row>(
  row: Row,
  query: CompiledQueryGroup,
  getValue: (row: Row, key: string) => unknown = (item, key) =>
    (item as Record<string, unknown> | null | undefined)?.[key],
): boolean {
  const matchesNode = (node: CompiledQueryNode): boolean =>
    node.type === 'rule'
      ? valueMatchers[node.operator](getValue(row, node.key), node.value)
      : node.children.length === 0
        ? true
        : node.combinator === 'and'
          ? node.children.every(matchesNode)
          : node.children.some(matchesNode)
  return matchesNode(query)
}

export function filterByQuery<Row>(
  rows: readonly Row[],
  query: CompiledQueryGroup,
  getValue?: (row: Row, key: string) => unknown,
): Row[] {
  return rows.filter((row) => matchesQuery(row, query, getValue))
}
