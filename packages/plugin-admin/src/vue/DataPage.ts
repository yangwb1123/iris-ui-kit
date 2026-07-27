import { defineComponent, h, onBeforeUnmount, shallowRef, type PropType, type VNode } from 'vue'
import { IrisButton, IrisInput, useI18n } from '@iris-ui-kit/vue'
import {
  adminFieldName,
  coerceAdminFieldValue,
  createAdminDataController,
  formatAdminCell,
  hasAdminPermission,
  resolveAdminMessage,
  type AdminActionHandler,
  type AdminColumn,
  type AdminDataPage,
  type AdminMessageKey,
  type AdminMessages,
} from '@iris-ui-kit/plugin-admin/core'

const stackStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--iris-gap-md)',
} as const
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--iris-gap-sm)',
} as const

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const AdminDataPageView = defineComponent({
  name: 'IrisAdminDataPage',
  props: {
    page: { type: Object as PropType<AdminDataPage>, required: true },
    permissions: {
      type: Array as unknown as PropType<readonly string[]>,
      default: () => [],
    },
    messages: { type: Object as PropType<AdminMessages>, default: undefined },
    onAction: { type: Function as PropType<AdminActionHandler>, default: undefined },
  },
  setup(props) {
    const controller = createAdminDataController(props.page)
    const resource = shallowRef(controller.resource.getState())
    const editor = shallowRef(controller.editor.getState())
    const unsubResource = controller.resource.subscribe((state) => {
      resource.value = state
    })
    const unsubEditor = controller.editor.subscribe((state) => {
      editor.value = state
    })
    onBeforeUnmount(() => {
      unsubResource()
      unsubEditor()
      controller.destroy()
    })
    const { t } = useI18n()
    const message = (key: AdminMessageKey, params: Record<string, string | number> = {}): string =>
      resolveAdminMessage(key, params, props.messages, t)

    const renderField = (column: AdminColumn): VNode => {
      const field = adminFieldName(column)
      const fieldId = `iris-admin-${props.page.key}-${field}`
      const errorId = `${fieldId}-error`
      const value = editor.value.draft[field]
      const invalid = Boolean(editor.value.errors[field])
      let control: VNode
      if (column.type === 'boolean') {
        control = h('input', {
          id: fieldId,
          type: 'checkbox',
          checked: Boolean(value),
          'aria-invalid': invalid || undefined,
          'aria-describedby': invalid ? errorId : undefined,
          onChange: (event: Event) =>
            controller.setField(field, (event.currentTarget as HTMLInputElement).checked),
        })
      } else if (column.type === 'select') {
        control = h(
          'select',
          {
            id: fieldId,
            value: String(value ?? ''),
            'aria-invalid': invalid || undefined,
            'aria-describedby': invalid ? errorId : undefined,
            onChange: (event: Event) =>
              controller.setField(
                field,
                coerceAdminFieldValue(column, (event.currentTarget as HTMLSelectElement).value),
              ),
          },
          [
            h('option', { value: '' }, column.placeholder ?? ''),
            ...(column.options ?? []).map((option) =>
              h('option', { key: String(option.value), value: String(option.value) }, option.label),
            ),
          ],
        )
      } else if (column.type === 'date') {
        control = h('input', {
          id: fieldId,
          type: 'date',
          value: String(value ?? ''),
          'aria-invalid': invalid || undefined,
          'aria-describedby': invalid ? errorId : undefined,
          onInput: (event: Event) =>
            controller.setField(field, (event.currentTarget as HTMLInputElement).value),
        })
      } else {
        control = h(IrisInput, {
          id: fieldId,
          type: column.type === 'email' || column.type === 'number' ? column.type : 'text',
          modelValue: String(value ?? ''),
          placeholder: column.placeholder,
          invalid,
          ariaDescribedby: invalid ? errorId : undefined,
          'onUpdate:modelValue': (next: string | number) =>
            controller.setField(field, coerceAdminFieldValue(column, next)),
        })
      }
      return h('div', { key: column.key, 'data-iris-admin-field': field, style: stackStyle }, [
        h('label', { for: fieldId }, `${column.title}${column.required ? ' *' : ''}`),
        control,
        invalid ? h('span', { id: errorId, role: 'alert' }, editor.value.errors[field]) : null,
      ])
    }

    return () => {
      const canCreate =
        controller.capabilities.create &&
        hasAdminPermission(props.page.permissions?.create, props.permissions)
      const canUpdate =
        controller.capabilities.update &&
        hasAdminPermission(props.page.permissions?.update, props.permissions)
      const canDelete =
        controller.capabilities.delete &&
        hasAdminPermission(props.page.permissions?.delete, props.permissions)
      const actions = (props.page.actions ?? []).filter((action) =>
        hasAdminPermission(action.permission, props.permissions),
      )
      const showActions = canUpdate || canDelete || actions.length > 0
      const pageCount = Math.max(1, controller.resource.pageCount())
      const failure = editor.value.actionError ?? resource.value.error

      return h(
        'div',
        {
          'data-iris-admin-data-page': props.page.key,
          style: stackStyle,
        },
        [
          h('div', { style: rowStyle }, [
            props.page.title
              ? h('h2', { 'data-iris-admin-page-title': '' }, props.page.title)
              : null,
            canCreate
              ? h(IrisButton, { onClick: () => controller.beginCreate() }, () => message('create'))
              : null,
          ]),
          editor.value.mode !== 'idle'
            ? h(
                'form',
                {
                  'data-iris-admin-editor': editor.value.mode,
                  'aria-label': message(
                    editor.value.mode === 'create' ? 'editorCreate' : 'editorEdit',
                    { title: props.page.title ?? props.page.key },
                  ),
                  style: stackStyle,
                  onSubmit: (event: Event) => {
                    event.preventDefault()
                    void controller.save()
                  },
                },
                [
                  ...controller.editableColumns.map(renderField),
                  h('div', { style: rowStyle }, [
                    h(IrisButton, { type: 'submit', loading: editor.value.saving }, () =>
                      message('save'),
                    ),
                    h(
                      IrisButton,
                      { variant: 'outline', onClick: () => controller.cancelEdit() },
                      () => message('cancel'),
                    ),
                  ]),
                ],
              )
            : null,
          failure
            ? h('div', { role: 'alert', 'data-iris-admin-error': '' }, [
                `${errorText(failure)} `,
                h(
                  IrisButton,
                  { variant: 'outline', onClick: () => void controller.resource.reload() },
                  () => message('retry'),
                ),
              ])
            : null,
          resource.value.loading
            ? h('div', { role: 'status', 'aria-live': 'polite' }, message('loading'))
            : null,
          h(
            'table',
            {
              'data-iris-admin-table': '',
              'aria-label': props.page.title ?? props.page.key,
              'aria-busy': resource.value.loading || undefined,
            },
            [
              h('thead', [
                h('tr', [
                  ...props.page.columns.map((column) => {
                    const activeSort =
                      resource.value.sort?.key === column.key ? resource.value.sort : null
                    return h(
                      'th',
                      {
                        key: column.key,
                        scope: 'col',
                        'aria-sort': activeSort
                          ? activeSort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined,
                      },
                      column.sortable
                        ? h(
                            'button',
                            {
                              type: 'button',
                              onClick: () =>
                                controller.resource.setSort(
                                  !activeSort
                                    ? { key: column.key, direction: 'asc' }
                                    : activeSort.direction === 'asc'
                                      ? { key: column.key, direction: 'desc' }
                                      : null,
                                ),
                            },
                            column.title,
                          )
                        : column.title,
                    )
                  }),
                  showActions ? h('th', { scope: 'col' }, message('actions')) : null,
                ]),
                props.page.columns.some((column) => column.filterable)
                  ? h('tr', { 'data-iris-admin-filters': '' }, [
                      ...props.page.columns.map((column) =>
                        h(
                          'th',
                          { key: column.key },
                          column.filterable
                            ? [
                                h(IrisInput, {
                                  type: 'search',
                                  modelValue: resource.value.filters[column.key] ?? '',
                                  'aria-label': message('filter', { column: column.title }),
                                  'onUpdate:modelValue': (value: string | number) =>
                                    controller.resource.setFilter(column.key, String(value)),
                                }),
                              ]
                            : [],
                        ),
                      ),
                      showActions ? h('th') : null,
                    ])
                  : null,
              ]),
              h(
                'tbody',
                resource.value.rows.length === 0 && !resource.value.loading
                  ? [
                      h('tr', [
                        h(
                          'td',
                          { colspan: props.page.columns.length + (showActions ? 1 : 0) },
                          message('empty'),
                        ),
                      ]),
                    ]
                  : resource.value.rows.map((row, index) => {
                      const key = controller.rowKey(row, index)
                      const confirming = editor.value.deletingKey === key
                      return h('tr', { key, 'data-row-key': key }, [
                        ...props.page.columns.map((column) =>
                          h(
                            'td',
                            { key: column.key },
                            formatAdminCell(row[adminFieldName(column)], column),
                          ),
                        ),
                        showActions
                          ? h('td', [
                              h('div', { style: rowStyle }, [
                                canUpdate
                                  ? h(
                                      IrisButton,
                                      {
                                        variant: 'outline',
                                        onClick: () => controller.beginEdit(row),
                                      },
                                      () => message('edit'),
                                    )
                                  : null,
                                canDelete && !confirming
                                  ? h(
                                      IrisButton,
                                      {
                                        variant: 'outline',
                                        onClick: () => controller.requestDelete(row),
                                      },
                                      () => message('delete'),
                                    )
                                  : null,
                                canDelete && confirming
                                  ? [
                                      h(
                                        IrisButton,
                                        {
                                          loading: editor.value.saving,
                                          onClick: () => void controller.confirmDelete(),
                                        },
                                        () => message('confirmDelete'),
                                      ),
                                      h(
                                        IrisButton,
                                        {
                                          variant: 'outline',
                                          onClick: () => controller.cancelDelete(),
                                        },
                                        () => message('cancel'),
                                      ),
                                    ]
                                  : null,
                                ...actions.map((action) =>
                                  h(
                                    IrisButton,
                                    {
                                      key: action.key,
                                      variant: 'outline',
                                      loading:
                                        editor.value.runningAction === `${action.key}:${key}`,
                                      disabled: !props.onAction,
                                      onClick: () =>
                                        void controller.runAction(action.key, row, props.onAction),
                                    },
                                    () => action.label,
                                  ),
                                ),
                              ]),
                            ])
                          : null,
                      ])
                    }),
              ),
            ],
          ),
          h(
            'nav',
            {
              'data-iris-admin-pager': '',
              'aria-label': `${props.page.title ?? props.page.key} pagination`,
              style: rowStyle,
            },
            [
              h(
                IrisButton,
                {
                  variant: 'outline',
                  disabled: resource.value.page <= 1,
                  onClick: () => controller.resource.setPage(resource.value.page - 1),
                },
                () => message('previous'),
              ),
              h(
                'span',
                { 'data-iris-admin-page-info': '' },
                message('page', { page: resource.value.page, pages: pageCount }),
              ),
              h(
                IrisButton,
                {
                  variant: 'outline',
                  disabled: resource.value.page >= pageCount,
                  onClick: () => controller.resource.setPage(resource.value.page + 1),
                },
                () => message('next'),
              ),
            ],
          ),
        ],
      )
    }
  },
})
