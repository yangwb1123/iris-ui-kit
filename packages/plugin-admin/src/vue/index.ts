import { computed, defineComponent, h, ref, type PropType, type VNode } from 'vue'
import { IrisAdminLayout } from '@iris-ui-kit/vue'
import {
  firstNavLeafKey,
  normalizeAdminSchema,
  resolveAdminPage,
  type AdminActionHandler,
  type AdminAppSchema,
  type AdminMessages,
} from '@iris-ui-kit/plugin-admin/core'
import { AdminDataPageView } from './DataPage'

export type {
  AdminActionHandler,
  AdminAppSchema,
  AdminColumn,
  AdminCrudPermissions,
  AdminCustomPage,
  AdminDataFetcher,
  AdminDataPage,
  AdminFieldType,
  AdminMessages,
  AdminMutationHandlers,
  AdminPage,
  AdminPermission,
  AdminRowAction,
  AdminSelectOption,
} from '@iris-ui-kit/plugin-admin/core'
export { adminPlugin } from '@iris-ui-kit/plugin-admin/core'

export type AdminRenderPage = (key: string) => VNode | VNode[] | null

/** Schema-driven Vue CMS with shared query/CRUD logic in the plugin core. */
export const IrisAdminApp = defineComponent({
  name: 'IrisAdminApp',
  props: {
    schema: { type: Object as PropType<AdminAppSchema>, required: true },
    permissions: {
      type: Array as unknown as PropType<readonly string[]>,
      default: () => [],
    },
    messages: { type: Object as PropType<AdminMessages>, default: undefined },
    onAction: { type: Function as PropType<AdminActionHandler>, default: undefined },
    renderPage: { type: Function as PropType<AdminRenderPage>, default: undefined },
  },
  setup(props) {
    const normalized = computed(() => normalizeAdminSchema(props.schema))
    const activeKey = ref<string>(firstNavLeafKey(normalized.value.nav) ?? '')
    return () =>
      h(
        IrisAdminLayout,
        {
          menus: normalized.value.nav,
          activeKey: activeKey.value,
          'onUpdate:activeKey': (key: string) => {
            activeKey.value = key
          },
          appTitle: normalized.value.title,
        },
        {
          default: ({ activeKey: key }: { activeKey: string }) => {
            const page = resolveAdminPage(normalized.value, key)
            if (page?.type === 'data') {
              return h(AdminDataPageView, {
                key: page.key,
                page,
                permissions: props.permissions,
                messages: props.messages,
                onAction: props.onAction,
              })
            }
            if (page?.type === 'custom') return props.renderPage?.(key) ?? null
            return h('div', { 'data-iris-admin-empty': '' }, `No page configured for "${key}"`)
          },
        },
      )
  },
})
