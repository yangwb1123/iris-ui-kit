import { createMemo, For, Show, type JSX } from 'solid-js'
import { IrisAdminLayout, useDataSource, createClientDataSource } from '@iris-ui-kit/solid'
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
  renderPage?: (key: string) => JSX.Element
}

/** A data page: a paginated table over the page's client dataset via the data engine. */
function DataPageView(props: { page: AdminDataPage }): JSX.Element {
  const cols = createMemo(() => adminDataViewColumns(props.page.columns))
  const ds = useDataSource({
    fetcher: createClientDataSource(props.page.data, cols()),
    pageSize: props.page.pageSize ?? 10,
  })
  return (
    <div data-iris-admin-data-page={props.page.key}>
      <Show when={props.page.title}>
        <h2 data-iris-admin-page-title="">{props.page.title}</h2>
      </Show>
      <table data-iris-admin-table="">
        <thead>
          <tr>
            <For each={props.page.columns}>{(c) => <th scope="col">{c.title}</th>}</For>
          </tr>
        </thead>
        <tbody>
          <For each={ds.state().rows}>
            {(row) => (
              <tr>
                <For each={props.page.columns}>
                  {(c) => (
                    <td>{String((row as Record<string, unknown>)[c.dataIndex ?? c.key] ?? '')}</td>
                  )}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <div data-iris-admin-pager="">
        <button
          type="button"
          disabled={ds.state().page <= 1}
          onClick={() => ds.setPage(ds.state().page - 1)}
        >
          Prev
        </button>
        <span data-iris-admin-page-info="">
          {ds.state().page} / {ds.pageCount()}
        </span>
        <button
          type="button"
          disabled={ds.state().page >= ds.pageCount()}
          onClick={() => ds.setPage(ds.state().page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

/**
 * Schema-driven CMS for Solid. Renders `IrisAdminLayout` from a declarative
 * {@link AdminAppSchema} (nav + pages); data pages are backed by the unified
 * data engine (`createDataSource` via `useDataSource`), custom pages are rendered
 * by the host via `renderPage`. The whole app is `<IrisAdminApp schema={...} />`.
 */
export function IrisAdminApp(props: IrisAdminAppProps): JSX.Element {
  return (
    <IrisAdminLayout
      menus={props.schema.nav}
      defaultActiveKey={firstNavLeafKey(props.schema.nav)}
      appTitle={props.schema.title}
    >
      {(s) => {
        const page = createMemo(() => resolveAdminPage(props.schema, s.activeKey))
        return (
          <Show
            when={page()}
            keyed
            fallback={<div data-iris-admin-empty="">No page configured for "{s.activeKey}"</div>}
          >
            {(p) => (
              <Show
                when={p.type === 'data' && p}
                keyed
                fallback={<>{props.renderPage?.(s.activeKey)}</>}
              >
                {(dataPage) => <DataPageView page={dataPage as AdminDataPage} />}
              </Show>
            )}
          </Show>
        )
      }}
    </IrisAdminLayout>
  )
}
