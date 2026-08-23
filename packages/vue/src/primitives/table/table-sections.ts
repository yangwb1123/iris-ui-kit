import { h, type Ref, type VNode } from 'vue'
import { IrisButton } from '../button/Button'
import { IrisFormField } from '../form-field/FormField'
import { IrisInput } from '../input/Input'
import { IrisPagination } from '../pagination/Pagination'
import { IrisSelect } from '../select/Select'
import type { UseI18nReturn } from '../../i18n'
import type { UseTableProxyResult } from './useTableProxy'
import type {
  IrisTableDensity,
  IrisTableFormConfig,
  IrisTableProxyConfig,
  IrisTableToolbarConfig,
} from './types'

type TableRow = Record<string, unknown>
type Translate = UseI18nReturn['t']
type ProxyController = UseTableProxyResult<TableRow>

/** The small, render-only prop surface shared by the table chrome builders. */
export interface TableSectionProps {
  formConfig?: IrisTableFormConfig
  toolbar?: IrisTableToolbarConfig
  selectable?: 'none' | 'single' | 'multi'
  proxyConfig?: IrisTableProxyConfig<TableRow>
}

export interface FormSectionContext {
  formConfig: TableSectionProps['formConfig']
  t: Translate
  formDraft: Readonly<Ref<Record<string, string>>>
  setFormValue: (key: string, value: string) => void
  handleFormSubmit: () => void
  handleFormReset: () => void
}

/** Render the optional vxe-style search form above the table. */
export function renderFormSection(ctx: FormSectionContext): VNode | null {
  const fc = ctx.formConfig
  if (!fc) return null
  return h(
    'form',
    {
      'data-iris-table-form': '',
      onSubmit: (e: Event) => {
        e.preventDefault()
        ctx.handleFormSubmit()
      },
      onReset: (e: Event) => {
        e.preventDefault()
        ctx.handleFormReset()
      },
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        gap: 'var(--iris-space-sm, 12px)',
        padding: 'var(--iris-space-sm, 12px)',
        border: '1px solid var(--iris-border)',
        borderBottom: 'none',
        background: 'var(--iris-surface)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      },
    },
    [
      ...fc.fields.map((field) =>
        h(
          'div',
          {
            key: field.key,
            'data-iris-table-form-field': field.key,
            style: { minWidth: 180 },
          },
          [
            h(
              IrisFormField,
              { label: field.label, size: 'sm' },
              {
                default: () =>
                  field.type === 'select'
                    ? h(IrisSelect, {
                        items: (field.options ?? []).map((o) => ({
                          value: o.value,
                          label: o.label,
                        })),
                        modelValue: ctx.formDraft.value[field.key] ?? '',
                        placeholder: field.placeholder ?? ctx.t('select.placeholder'),
                        size: 'sm',
                        'onUpdate:modelValue': (v: unknown) =>
                          ctx.setFormValue(field.key, String(v ?? '')),
                      })
                    : h(IrisInput, {
                        modelValue: ctx.formDraft.value[field.key] ?? '',
                        placeholder: field.placeholder,
                        size: 'sm',
                        'onUpdate:modelValue': (v: string | number) =>
                          ctx.setFormValue(field.key, String(v ?? '')),
                      }),
              },
            ),
          ],
        ),
      ),
      h('div', { style: { display: 'flex', gap: 'var(--iris-space-xs, 8px)' } }, [
        h(
          IrisButton,
          { type: 'submit', size: 'sm', 'data-iris-table-form-submit': '' },
          { default: () => fc.submitText ?? ctx.t('table.formSubmit') },
        ),
        h(
          IrisButton,
          {
            type: 'reset',
            variant: 'outline',
            size: 'sm',
            'data-iris-table-form-reset': '',
          },
          { default: () => fc.resetText ?? ctx.t('table.formReset') },
        ),
      ]),
    ],
  )
}

export interface ToolbarSectionContext {
  toolbar: TableSectionProps['toolbar']
  selectable: TableSectionProps['selectable']
  displaySelection: Readonly<Ref<Array<string | number>>>
  proxyCtrl: ProxyController
  t: Translate
  importFileInput: Ref<HTMLInputElement | null>
  onImportFile: (event: Event) => void
  densityToggle: boolean
  effectiveDensity: IrisTableDensity
  onDensityToggle: () => void
  /** Batch EN: built-in audit trigger (iris 独有, mirror react batch AT).
   * Renders the toolbar when `auditLog` is on even without a toolbar/density
   * config (react parity — the toolbar gate admits auditLog). */
  auditLog: boolean
  auditOpen: Readonly<Ref<boolean>>
  auditAnchorRef: Ref<HTMLButtonElement | null>
  onAuditToggle: () => void
}

const toolbarBtnStyle = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--iris-muted)',
  fontSize: 'var(--iris-font-size-md, 14px)',
}

/** Render the optional toolbar and its built-in refresh/export actions. */
export function renderToolbarSection(ctx: ToolbarSectionContext): VNode | null {
  const tb = ctx.toolbar
  // Batch EN: `auditLog` renders the toolbar on its own (like `densityToggle`
  // — the built-in audit trigger rides the toolbar row).
  if (!tb && !ctx.densityToggle && !ctx.auditLog) return null
  const toolChildren: VNode[] = []
  if (tb?.title) {
    toolChildren.push(
      h('span', { style: { fontWeight: 600, color: 'var(--iris-foreground)' } }, tb.title),
    )
  }
  toolChildren.push(h('div', { style: { flex: '1' } }))
  if (tb?.onRefresh) {
    toolChildren.push(
      h(
        'button',
        {
          type: 'button',
          'data-iris-table-toolbar-refresh': '',
          'aria-label': ctx.t('table.refresh'),
          title: ctx.t('table.refresh'),
          onClick: () => {
            tb.onRefresh?.()
            void ctx.proxyCtrl.refetch()
          },
          style: toolbarBtnStyle,
        },
        '↻',
      ),
    )
  }
  if (tb?.onExport) {
    toolChildren.push(
      h(
        'button',
        {
          type: 'button',
          'data-iris-table-toolbar-export': '',
          'aria-label': ctx.t('table.export'),
          title: ctx.t('table.export'),
          onClick: () => tb?.onExport?.(),
          style: toolbarBtnStyle,
        },
        '⇩',
      ),
    )
  }
  if (tb?.onImport) {
    toolChildren.push(
      h('input', {
        ref: (el: unknown) => {
          ctx.importFileInput.value = (el ?? null) as HTMLInputElement | null
        },
        type: 'file',
        accept: '.csv,text/csv',
        'data-iris-table-import-input': '',
        onChange: ctx.onImportFile,
        style: { display: 'none' },
      }),
      h(
        'button',
        {
          type: 'button',
          'data-iris-table-toolbar-import': '',
          'aria-label': ctx.t('table.import'),
          title: ctx.t('table.import'),
          onClick: () => ctx.importFileInput.value?.click(),
          style: toolbarBtnStyle,
        },
        '⇪',
      ),
    )
  }
  if (tb?.batch && ctx.selectable === 'multi' && ctx.displaySelection.value.length > 0) {
    toolChildren.push(
      h(
        'button',
        {
          type: 'button',
          'data-iris-table-toolbar-batch': '',
          'aria-label': tb.batch.label,
          title: tb.batch.label,
          onClick: () => tb.batch!.onClick([...ctx.displaySelection.value]),
          style: {
            border: 'none',
            cursor: 'pointer',
            background: 'var(--iris-primary)',
            color: 'var(--iris-primary-foreground)',
            fontSize: 'var(--iris-font-size-md, 14px)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--iris-space-xxs, 4px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
          },
        },
        [
          tb.batch.icon
            ? h(
                'span',
                { 'aria-hidden': 'true', style: { fontSize: 'var(--iris-font-size-sm, 13px)' } },
                tb.batch.icon,
              )
            : null,
          tb.batch.label,
        ],
      ),
    )
  }
  if (tb?.buttons && tb.buttons.length > 0) {
    for (const btn of tb.buttons) {
      toolChildren.push(
        h(
          'button',
          {
            key: btn.key,
            type: 'button',
            'data-iris-table-toolbar-button': btn.key,
            [`data-iris-table-toolbar-button-${btn.key}`]: '',
            'aria-label': btn.label,
            title: btn.label,
            onClick: btn.onClick,
            style: {
              ...toolbarBtnStyle,
              color: 'var(--iris-foreground)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--iris-space-xxs, 4px)',
              padding: '0 var(--iris-space-xxs, 4px)',
            },
          },
          [
            btn.icon
              ? h(
                  'span',
                  { 'aria-hidden': 'true', style: { fontSize: 'var(--iris-font-size-sm, 13px)' } },
                  btn.icon,
                )
              : null,
            btn.label,
          ],
        ),
      )
    }
  }
  if (ctx.densityToggle) {
    toolChildren.push(
      h(
        'button',
        {
          type: 'button',
          'data-iris-density-toggle': '',
          'data-iris-density': ctx.effectiveDensity,
          'aria-label': `${ctx.t('table.density')}: ${ctx.t(`table.density.${ctx.effectiveDensity}`)}`,
          title: `${ctx.t('table.density')}: ${ctx.t(`table.density.${ctx.effectiveDensity}`)}`,
          onClick: ctx.onDensityToggle,
          style: toolbarBtnStyle,
        },
        ctx.t(`table.density.${ctx.effectiveDensity}`),
      ),
    )
  }
  if (ctx.auditLog) {
    // Batch EN: toolbar audit trigger (iris 独有) — react parity (same
    // `data-iris-audit-trigger` + ☰, color reflects the open state). The ref
    // callback feeds the floating anchor for the panel below.
    toolChildren.push(
      h(
        'button',
        {
          ref: (el: unknown) => {
            ctx.auditAnchorRef.value = (el ?? null) as HTMLButtonElement | null
          },
          type: 'button',
          'data-iris-audit-trigger': '',
          'aria-label': ctx.t('table.audit'),
          title: ctx.t('table.audit'),
          onClick: ctx.onAuditToggle,
          style: {
            ...toolbarBtnStyle,
            color: ctx.auditOpen.value ? 'var(--iris-foreground)' : 'var(--iris-muted)',
          },
        },
        '☰',
      ),
    )
  }
  return h(
    'div',
    {
      'data-iris-table-toolbar': '',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--iris-space-sm, 12px)',
        padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
        border: '1px solid var(--iris-border)',
        borderBottom: 'none',
        borderTopLeftRadius: 'var(--iris-radius-md, 6px)',
        borderTopRightRadius: 'var(--iris-radius-md, 6px)',
        background: 'var(--iris-surface)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      },
    },
    toolChildren,
  )
}

export interface PagerSectionContext {
  proxyCtrl: ProxyController
  proxyConfig: TableSectionProps['proxyConfig']
}

/** Render the proxy pager below the table body. */
export function renderPagerSection(ctx: PagerSectionContext): VNode | null {
  if (!ctx.proxyCtrl.proxy.value) return null
  const st = ctx.proxyCtrl.state.value
  return h(
    'div',
    {
      'data-iris-table-pager': '',
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
        borderTop: '1px solid var(--iris-border)',
        background: 'var(--iris-surface)',
      },
    },
    [
      h(IrisPagination, {
        modelValue: st.params.page,
        total: st.total,
        pageSize: st.params.pageSize,
        size: 'sm',
        'onUpdate:modelValue': (page: number) => {
          ctx.proxyCtrl.setParams({ page })
          ctx.proxyConfig?.onPageChange?.(page, ctx.proxyCtrl.state.value.params.pageSize)
        },
      }),
    ],
  )
}
