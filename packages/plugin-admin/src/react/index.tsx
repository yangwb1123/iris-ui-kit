import * as React from 'react'
import { IrisAdminLayout, useDataSource, createClientDataSource } from '@iris-ui/react'
import {
  resolveAdminPage,
  adminDataViewColumns,
  firstNavLeafKey,
  type AdminAppSchema,
  type AdminDataPage,
} from '../core'

export type {
  AdminAppSchema,
  AdminColumn,
  AdminPage,
  AdminDataPage,
  AdminCustomPage,
} from '../core'
export { adminPlugin } from '../core'

export interface IrisAdminAppProps {
  schema: AdminAppSchema
  /** Render a custom page by key (for pages of type `'custom'`). */
  renderPage?: (key: string) => React.ReactNode
}

/** A data page: a paginated table over the page's client dataset via the data engine. */
function DataPageView({ page }: { page: AdminDataPage }): React.ReactElement {
  const cols = React.useMemo(() => adminDataViewColumns(page.columns), [page])
  const ds = useDataSource({
    fetcher: createClientDataSource(page.data, cols),
    pageSize: page.pageSize ?? 10,
  })
  const { state } = ds
  return (
    <div data-iris-admin-data-page={page.key}>
      {page.title ? <h2 data-iris-admin-page-title="">{page.title}</h2> : null}
      <table data-iris-admin-table="">
        <thead>
          <tr>
            {page.columns.map((c) => (
              <th key={c.key} scope="col">
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.rows.map((row, i) => (
            <tr key={i}>
              {page.columns.map((c) => (
                <td key={c.key}>
                  {String((row as Record<string, unknown>)[c.dataIndex ?? c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div data-iris-admin-pager="">
        <button type="button" disabled={state.page <= 1} onClick={() => ds.setPage(state.page - 1)}>
          Prev
        </button>
        <span data-iris-admin-page-info="">
          {state.page} / {ds.pageCount()}
        </span>
        <button
          type="button"
          disabled={state.page >= ds.pageCount()}
          onClick={() => ds.setPage(state.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

/**
 * Schema-driven CMS for React. Renders `IrisAdminLayout` from a declarative
 * {@link AdminAppSchema} (nav + pages); data pages are backed by the unified
 * data engine (`createDataSource` via `useDataSource`), custom pages are rendered
 * by the host via `renderPage`. The whole app is `<IrisAdminApp schema={...} />`.
 */
export function IrisAdminApp({ schema, renderPage }: IrisAdminAppProps): React.ReactElement {
  return (
    <IrisAdminLayout
      menus={schema.nav}
      defaultActiveKey={firstNavLeafKey(schema.nav)}
      appTitle={schema.title}
    >
      {({ activeKey }) => {
        const page = resolveAdminPage(schema, activeKey)
        if (page?.type === 'data') return <DataPageView key={page.key} page={page} />
        if (page?.type === 'custom') return <>{renderPage?.(activeKey)}</>
        return <div data-iris-admin-empty="">No page configured for &quot;{activeKey}&quot;</div>
      }}
    </IrisAdminLayout>
  )
}
