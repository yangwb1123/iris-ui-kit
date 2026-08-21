import { firstLeaf, type NavNode } from '@iris-ui-kit/core'
import type {
  AdminAppSchema,
  AdminColumn,
  AdminDataPage,
  AdminMessageKey,
  AdminMessages,
  AdminPage,
  AdminPermission,
  AdminSchemaIssue,
} from './types'
import { adminMessageDefaults } from './types'

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function inspectNav(nodes: readonly unknown[], issues: AdminSchemaIssue[]): string[] {
  const leaves: string[] = []
  const visit = (value: unknown, path: string): void => {
    if (
      !isObject(value) ||
      typeof value.key !== 'string' ||
      !value.key.trim() ||
      typeof value.title !== 'string'
    ) {
      issues.push({
        path,
        code: 'invalid-schema',
        severity: 'error',
        message: 'Each nav node requires non-empty key and title values.',
      })
      return
    }
    if (value.children !== undefined && !Array.isArray(value.children)) {
      issues.push({
        path: `${path}.children`,
        code: 'invalid-schema',
        severity: 'error',
        message: 'Nav children must be an array.',
      })
      return
    }
    if (Array.isArray(value.children) && value.children.length) {
      value.children.forEach((child, index) => visit(child, `${path}.children[${index}]`))
    } else {
      leaves.push(value.key)
    }
  }
  nodes.forEach((node, index) => visit(node, `nav[${index}]`))
  return leaves
}

function duplicateIssues(keys: readonly string[], path: string): AdminSchemaIssue[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const key of keys) {
    if (seen.has(key)) duplicates.add(key)
    seen.add(key)
  }
  return [...duplicates].map((key) => ({
    path,
    code: 'duplicate-key',
    severity: 'error',
    message: `Duplicate key "${key}".`,
  }))
}

function validateColumn(column: AdminColumn, path: string): AdminSchemaIssue[] {
  const issues: AdminSchemaIssue[] = []
  if (!column.key.trim() || !column.title.trim()) {
    issues.push({
      path,
      code: 'invalid-field',
      severity: 'error',
      message: 'Columns require non-empty key and title values.',
    })
  }
  if (column.type === 'select' && (!column.options || column.options.length === 0)) {
    issues.push({
      path: `${path}.options`,
      code: 'invalid-field',
      severity: 'error',
      message: 'Select fields require at least one option.',
    })
  }
  if (column.pattern) {
    try {
      new RegExp(column.pattern)
    } catch {
      issues.push({
        path: `${path}.pattern`,
        code: 'invalid-field',
        severity: 'error',
        message: 'Field pattern must be a valid regular expression.',
      })
    }
  }
  return issues
}

function validateDataPageColumns(page: AdminDataPage, path: string): AdminSchemaIssue[] {
  const issues = duplicateIssues(
    page.columns.map((column) => column.key),
    `${path}.columns`,
  )
  page.columns.forEach((column, columnIndex) => {
    issues.push(...validateColumn(column, `${path}.columns[${columnIndex}]`))
  })
  return issues
}

function validateDataPage(page: AdminDataPage, index: number): AdminSchemaIssue[] {
  const path = `pages[${index}]`
  const issues: AdminSchemaIssue[] = []
  if (
    (page.data === undefined || !Array.isArray(page.data)) &&
    (page.fetcher === undefined || typeof page.fetcher !== 'function')
  ) {
    issues.push({
      path,
      code: 'missing-source',
      severity: 'error',
      message: `Data page "${page.key}" requires data or a fetcher.`,
    })
  }
  if (page.pageSize !== undefined && (!Number.isInteger(page.pageSize) || page.pageSize < 1)) {
    issues.push({
      path: `${path}.pageSize`,
      code: 'invalid-page-size',
      severity: 'error',
      message: 'pageSize must be a positive integer.',
    })
  }
  issues.push(...validateDataPageColumns(page, path))
  const hasServerMutations =
    page.fetcher && (page.editable || Object.values(page.mutations ?? {}).some(Boolean))
  if (hasServerMutations && !page.rowKey) {
    issues.push({
      path: `${path}.rowKey`,
      code: 'missing-row-key',
      severity: 'error',
      message: `Editable server page "${page.key}" requires an explicit rowKey.`,
    })
  }
  if (page.actions) {
    issues.push(
      ...duplicateIssues(
        page.actions.map((action) => action.key),
        `${path}.actions`,
      ),
    )
  }
  return issues
}

function collectAdminPageKeys(pages: readonly unknown[]): string[] {
  return pages
    .filter(
      (page): page is Record<string, unknown> =>
        isObject(page) && typeof page.key === 'string' && Boolean(page.key.trim()),
    )
    .map((page) => page.key as string)
}

function validateAdminDataPageCandidate(
  candidate: Record<string, unknown>,
  index: number,
  issues: AdminSchemaIssue[],
): void {
  if (!Array.isArray(candidate.columns)) {
    issues.push({
      path: `pages[${index}].columns`,
      code: 'invalid-schema',
      severity: 'error',
      message: 'Data pages require a columns array.',
    })
    return
  }
  if (candidate.actions !== undefined && !Array.isArray(candidate.actions)) {
    issues.push({
      path: `pages[${index}].actions`,
      code: 'invalid-schema',
      severity: 'error',
      message: 'Page actions must be an array.',
    })
    return
  }
  const validColumns = candidate.columns.every(
    (column) =>
      isObject(column) && typeof column.key === 'string' && typeof column.title === 'string',
  )
  const validActions =
    candidate.actions === undefined ||
    candidate.actions.every(
      (action) =>
        isObject(action) && typeof action.key === 'string' && typeof action.label === 'string',
    )
  if (!validColumns || !validActions) {
    issues.push({
      path: `pages[${index}]`,
      code: 'invalid-schema',
      severity: 'error',
      message: 'Columns and actions require string key/title or key/label values.',
    })
    return
  }
  issues.push(...validateDataPage(candidate as unknown as AdminDataPage, index))
}

function validateAdminPageCandidate(
  candidate: unknown,
  index: number,
  issues: AdminSchemaIssue[],
): void {
  if (
    !isObject(candidate) ||
    typeof candidate.key !== 'string' ||
    !candidate.key.trim() ||
    (candidate.type !== 'data' && candidate.type !== 'custom')
  ) {
    issues.push({
      path: `pages[${index}]`,
      code: 'invalid-schema',
      severity: 'error',
      message: 'Each page requires a key and a valid type.',
    })
    return
  }
  if (candidate.type === 'data') validateAdminDataPageCandidate(candidate, index, issues)
}

/** Validate unknown input without throwing; warnings do not block normalization. */
export function validateAdminSchema(input: unknown): AdminSchemaIssue[] {
  if (!isObject(input) || !Array.isArray(input.nav) || !Array.isArray(input.pages)) {
    return [
      {
        path: '',
        code: 'invalid-schema',
        severity: 'error',
        message: 'Admin schema requires nav and pages arrays.',
      },
    ]
  }
  const issues: AdminSchemaIssue[] = []
  const leafKeys = inspectNav(input.nav, issues)
  const pages = input.pages as unknown[]
  const pageKeys = collectAdminPageKeys(pages)
  issues.push(...duplicateIssues(pageKeys, 'pages'))
  pages.forEach((candidate, index) => validateAdminPageCandidate(candidate, index, issues))
  const configuredPages = new Set(pageKeys)
  leafKeys.forEach((key) => {
    if (!configuredPages.has(key)) {
      issues.push({
        path: 'nav',
        code: 'missing-page',
        severity: 'warning',
        message: `Nav leaf "${key}" has no configured page.`,
      })
    }
  })
  return issues
}

export class AdminSchemaError extends Error {
  readonly issues: AdminSchemaIssue[]

  constructor(issues: AdminSchemaIssue[]) {
    super(issues.map((issue) => `${issue.path || '<root>'}: ${issue.message}`).join('\n'))
    this.name = 'AdminSchemaError'
    this.issues = issues
  }
}

export function assertAdminSchema(input: unknown): asserts input is AdminAppSchema {
  const errors = validateAdminSchema(input).filter((issue) => issue.severity === 'error')
  if (errors.length) throw new AdminSchemaError(errors)
}

/** Validate and clone the schema while applying non-breaking data-page defaults. */
export function normalizeAdminSchema(input: unknown): AdminAppSchema {
  assertAdminSchema(input)
  return {
    ...input,
    nav: [...input.nav],
    pages: input.pages.map<AdminPage>((page) =>
      page.type === 'custom'
        ? { ...page }
        : {
            ...page,
            data: page.data ? page.data.map((row) => ({ ...row })) : undefined,
            pageSize: page.pageSize ?? 10,
            rowKey: page.rowKey ?? 'id',
            columns: page.columns.map((column) => ({
              type: 'text',
              sortable: false,
              filterable: false,
              editable: page.editable ?? false,
              ...column,
              dataIndex: column.dataIndex ?? column.key,
            })),
          },
    ),
  }
}

/** Find the page whose key matches the active nav key. */
export function resolveAdminPage(
  schema: AdminAppSchema,
  key: string | null | undefined,
): AdminPage | undefined {
  if (!key) return undefined
  return schema.pages.find((page) => page.key === key)
}

/** The first nav leaf's key — the page the app opens on. */
export function firstNavLeafKey(nav: NavNode[]): string | undefined {
  if (nav.length === 0) return undefined
  return firstLeaf(nav[0]!).key
}

/** Boolean requirements are direct; strings/arrays are matched against grants. */
export function hasAdminPermission(
  requirement: AdminPermission | undefined,
  granted: readonly string[] = [],
): boolean {
  if (requirement === undefined || requirement === true) return true
  if (requirement === false) return false
  if (typeof requirement === 'string') return granted.includes(requirement)
  return requirement.every((permission) => granted.includes(permission))
}

export type AdminTranslate = (key: string, params?: Record<string, string | number>) => string

/** Resolve host override → active i18n dictionary → built-in English fallback. */
export function resolveAdminMessage(
  key: AdminMessageKey,
  params: Record<string, string | number> = {},
  messages?: AdminMessages,
  translate?: AdminTranslate,
): string {
  const i18nKey = `admin.${key}`
  const translated = translate?.(i18nKey, params)
  let template =
    messages?.[key] ??
    (translated && translated !== i18nKey ? translated : adminMessageDefaults[key])
  for (const [name, value] of Object.entries(params)) {
    template = template.replaceAll(`{${name}}`, String(value))
  }
  return template
}
