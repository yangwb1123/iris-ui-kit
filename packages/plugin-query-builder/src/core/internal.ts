import { generateId } from '@iris-ui-kit/core'
import { operatorsByType, type QueryColumn, type QueryNode, type QueryRuleNode } from './model'

export const SAFE_QUERY_ID = /^[A-Za-z][A-Za-z0-9_-]*$/

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function freshQueryId(prefix: 'query-rule' | 'query-group', seen: Set<string>): string {
  let id = generateId(prefix)
  while (seen.has(id)) id = generateId(prefix)
  seen.add(id)
  return id
}

export function claimQueryId(
  candidate: unknown,
  prefix: 'query-rule' | 'query-group',
  seen: Set<string>,
): string {
  if (typeof candidate === 'string' && SAFE_QUERY_ID.test(candidate) && !seen.has(candidate)) {
    seen.add(candidate)
    return candidate
  }
  return freshQueryId(prefix, seen)
}

export function createDefaultQueryRule(
  columns: readonly QueryColumn[],
  seen: Set<string>,
): QueryRuleNode {
  const column = columns[0]
  return {
    type: 'rule',
    id: freshQueryId('query-rule', seen),
    key: column?.key ?? '',
    operator: column ? operatorsByType[column.type][0] : 'eq',
    value: '',
  }
}

export function collectQueryIds(node: QueryNode, ids = new Set<string>()): Set<string> {
  ids.add(node.id)
  if (node.type === 'group') {
    for (const child of node.children) collectQueryIds(child, ids)
  }
  return ids
}
