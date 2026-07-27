import type { ReadonlyStore } from '@iris-ui-kit/core'

export const CMS_WORKSPACE_ROUTES = [
  'articles',
  'categories',
  'media',
  'roles',
  'overview',
  'reports',
  'calendar',
  'audit-log',
] as const

export type CmsWorkspaceRoute = (typeof CMS_WORKSPACE_ROUTES)[number]
export type CmsWorkspaceTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

export interface CmsWorkspaceFilter {
  value: string
  label: string
}

export interface CmsWorkspaceMetric {
  label: string
  value: string
  delta: string
  tone: CmsWorkspaceTone
}

export interface CmsWorkspaceRecord {
  id: string
  cells: string[]
  group: string
  status: string
  tone: CmsWorkspaceTone
}

export interface CmsWorkspaceDefinition {
  key: CmsWorkspaceRoute
  title: string
  description: string
  columns: readonly string[]
  filters: readonly CmsWorkspaceFilter[]
  searchPlaceholder: string
  primaryActionLabel: string
  rowActionLabel: string
  emptyMessage: string
  records: readonly CmsWorkspaceRecord[]
  metrics?: readonly CmsWorkspaceMetric[]
  periods?: readonly string[]
}

export interface CmsWorkspaceState {
  query: string
  filter: string
  records: CmsWorkspaceRecord[]
  metrics: CmsWorkspaceMetric[]
  selectedId: string | null
  notice: string | null
  periodIndex: number
}

export interface CmsWorkspaceController {
  readonly definition: CmsWorkspaceDefinition
  readonly store: ReadonlyStore<CmsWorkspaceState>
  visibleRecords(): CmsWorkspaceRecord[]
  selectedRecord(): CmsWorkspaceRecord | undefined
  setQuery(query: string): void
  setFilter(filter: string): void
  select(id: string): void
  runPrimaryAction(): void
  runRowAction(id: string): void
  shiftPeriod(offset: number): void
}
