import { computed, defineComponent, h, ref, type PropType, type VNode } from 'vue'
import { IrisAdminLayout, useDataSource, createClientDataSource } from '@iris-ui/vue'
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

/** Host hook to render a custom page by key (for pages of type `'custom'`). */
export type AdminRenderPage = (key: string) => VNode | VNode[] | null

/**
 * A data page: a paginated table over the page's client dataset via the data
 * engine. Its own `defineComponent` so `useDataSource` (a composable) runs in
 * `setup()`; keyed by `page.key` so the hook remounts per page switch.
 */
const DataPageView = defineComponent({
  name: 'IrisAdminDataPage',
  props: {
    page: { type: Object as PropType<AdminDataPage>, required: true },
  },
  setup(props) {
    const cols = computed(() => adminDataViewColumns(props.page.columns))
    const ds = useDataSource({
      fetcher: createClientDataSource(props.page.data, cols.value),
      pageSize: props.page.pageSize ?? 10,
    })
    const { state } = ds

    return () =>
      h('div', { 'data-iris-admin-data-page': props.page.key }, [
        props.page.title ? h('h2', { 'data-iris-admin-page-title': '' }, props.page.title) : null,
        h('table', { 'data-iris-admin-table': '' }, [
          h('thead', [
            h(
              'tr',
              props.page.columns.map((c) => h('th', { key: c.key, scope: 'col' }, c.title)),
            ),
          ]),
          h(
            'tbody',
            state.value.rows.map((row, i) =>
              h(
                'tr',
                { key: i },
                props.page.columns.map((c) =>
                  h(
                    'td',
                    { key: c.key },
                    String((row as Record<string, unknown>)[c.dataIndex ?? c.key] ?? ''),
                  ),
                ),
              ),
            ),
          ),
        ]),
        h('div', { 'data-iris-admin-pager': '' }, [
          h(
            'button',
            {
              type: 'button',
              disabled: state.value.page <= 1,
              onClick: () => ds.setPage(state.value.page - 1),
            },
            'Prev',
          ),
          h('span', { 'data-iris-admin-page-info': '' }, `${state.value.page} / ${ds.pageCount()}`),
          h(
            'button',
            {
              type: 'button',
              disabled: state.value.page >= ds.pageCount(),
              onClick: () => ds.setPage(state.value.page + 1),
            },
            'Next',
          ),
        ]),
      ])
  },
})

/**
 * Schema-driven CMS for Vue. Renders `IrisAdminLayout` from a declarative
 * {@link AdminAppSchema} (nav + pages); data pages are backed by the unified
 * data engine (`createDataSource` via `useDataSource`), custom pages are
 * rendered by the host via `renderPage`. The whole app is
 * `<IrisAdminApp :schema="..." />`.
 */
export const IrisAdminApp = defineComponent({
  name: 'IrisAdminApp',
  props: {
    schema: { type: Object as PropType<AdminAppSchema>, required: true },
    /** Render a custom page by key (for pages of type `'custom'`). */
    renderPage: { type: Function as PropType<AdminRenderPage>, default: undefined },
  },
  setup(props) {
    // Vue's IrisAdminLayout owns activeKey via v-model (uncontrolled mode starts
    // at null), so drive it controlled from a host-owned ref seeded with the
    // first nav leaf — the page the app opens on (mirrors React's defaultActiveKey).
    const activeKey = ref<string>(firstNavLeafKey(props.schema.nav) ?? '')
    return () =>
      h(
        IrisAdminLayout,
        {
          menus: props.schema.nav,
          activeKey: activeKey.value,
          'onUpdate:activeKey': (key: string) => {
            activeKey.value = key
          },
          appTitle: props.schema.title,
        },
        {
          default: ({ activeKey }: { activeKey: string }) => {
            const page = resolveAdminPage(props.schema, activeKey)
            if (page?.type === 'data') return h(DataPageView, { key: page.key, page })
            if (page?.type === 'custom') return props.renderPage?.(activeKey) ?? null
            return h(
              'div',
              { 'data-iris-admin-empty': '' },
              `No page configured for "${activeKey}"`,
            )
          },
        },
      )
  },
})
