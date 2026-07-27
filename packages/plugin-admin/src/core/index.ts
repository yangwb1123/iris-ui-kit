import {
  createPlugin,
  firstLeaf,
  readCell,
  type NavNode,
  type DataViewColumn,
} from '@iris-ui-kit/core'

/**
 * `@iris-ui-kit/plugin-admin` — a schema-driven CMS shell. This `core` entry is
 * framework-agnostic: it defines the declarative {@link AdminAppSchema} (a nav
 * tree + a page per route key) and the pure helpers the four `IrisAdminApp`
 * renderers share. Each renderer composes the adapter's `IrisAdminLayout`
 * (admin shell) with the unified data engine (`createDataSource` via
 * `useDataSource`) — "configuration is the application".
 */

export type { NavNode } from '@iris-ui-kit/core'

/** A display + data column for an admin data page. */
export interface AdminColumn {
  key: string
  title: string
  /** Row field to read; defaults to `key`. */
  dataIndex?: string
}

/** A data page: a paginated table over a client dataset, backed by createDataSource. */
export interface AdminDataPage<Row extends Record<string, unknown> = Record<string, unknown>> {
  type: 'data'
  /** Matches the nav leaf key it renders for. */
  key: string
  title?: string
  columns: AdminColumn[]
  /** Client-mode dataset. */
  data: Row[]
  /** Rows per page. Default 10. */
  pageSize?: number
}

/** A custom page: the host renders it (by key) via `IrisAdminApp`'s `renderPage`. */
export interface AdminCustomPage {
  type: 'custom'
  key: string
  title?: string
}

export type AdminPage = AdminDataPage | AdminCustomPage

/** The declarative CMS schema: a nav tree + a page per route key. */
export interface AdminAppSchema {
  title?: string
  nav: NavNode[]
  pages: AdminPage[]
}

/** Find the page whose key matches the active nav key. */
export function resolveAdminPage(
  schema: AdminAppSchema,
  key: string | null | undefined,
): AdminPage | undefined {
  if (!key) return undefined
  return schema.pages.find((p) => p.key === key)
}

/** Map admin columns onto the core data-view column contract (key + value accessor). */
export function adminDataViewColumns<Row extends Record<string, unknown>>(
  columns: AdminColumn[],
): DataViewColumn<Row>[] {
  return columns.map((c) => ({
    key: c.key,
    getValue: (row: Row) => readCell(row, c),
  }))
}

/** The first nav leaf's key — the page the app opens on. */
export function firstNavLeafKey(nav: NavNode[]): string | undefined {
  if (nav.length === 0) return undefined
  return firstLeaf(nav[0]!).key
}

/** CSS custom properties the admin app reads; overridable by the host theme. */
export const adminTokens: Record<string, string> = {
  '--iris-admin-page-gap': 'var(--iris-gap-lg, 16px)',
}

/**
 * The schema-admin plugin. Pass to `<IrisProvider plugins={[adminPlugin]}>` to
 * register its theme tokens. The CMS itself is the `IrisAdminApp` component
 * (per-adapter), composing the admin shell + the unified data engine from a
 * declarative {@link AdminAppSchema}.
 */
export const adminPlugin = createPlugin({
  name: 'admin',
  install(registry) {
    registry.registerTokens(adminTokens)
  },
})
