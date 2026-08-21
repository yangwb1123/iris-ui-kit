import { For, Show, type Accessor, type JSX } from 'solid-js'
import type { RemoteTableSourceState, RemoteTableParams } from '@iris-ui-kit/core'
import { IrisButton } from '../button'
import { IrisFormField } from '../form-field'
import { IrisInput } from '../input'
import { IrisPagination } from '../pagination'
import { IrisSelect } from '../select'
import type { UseI18nReturn } from '../../i18n'
import type {
  IrisTableDensity,
  IrisTableFormConfig,
  IrisTablePagerConfig,
  IrisTableProxyConfig,
  IrisTableToolbarConfig,
} from './types'
import { ImportPreview } from './import-preview'
import { createTableImportController } from './table-import'

type Translate = UseI18nReturn['t']

export interface TableFormProps {
  config: IrisTableFormConfig | undefined
  draft: Accessor<Record<string, string>>
  setValue: (key: string, value: string) => void
  onSubmit: (event: Event) => void
  onReset: (event: Event) => void
  t: Translate
}

/** Search form chrome for the optional vxe-style table formConfig. */
export function TableForm(props: TableFormProps): JSX.Element {
  return (
    <Show when={props.config}>
      <form
        data-iris-table-form=""
        onSubmit={props.onSubmit}
        onReset={props.onReset}
        style={{
          display: 'flex',
          'flex-wrap': 'wrap',
          'align-items': 'flex-end',
          gap: 'var(--iris-space-sm, 12px)',
          padding: 'var(--iris-space-sm, 12px)',
          border: '1px solid var(--iris-border)',
          'border-bottom': 'none',
          background: 'var(--iris-surface)',
          'font-size': 'var(--iris-font-size-sm, 13px)',
        }}
      >
        <For each={props.config!.fields}>
          {(field) => (
            <div data-iris-table-form-field={field.key} style={{ 'min-width': '180px' }}>
              <IrisFormField label={field.label} size="sm">
                <Show
                  when={field.type === 'select'}
                  fallback={
                    <IrisInput
                      value={props.draft()[field.key] ?? ''}
                      onInput={(e) =>
                        props.setValue(field.key, (e.target as HTMLInputElement).value)
                      }
                      placeholder={field.placeholder}
                      size="sm"
                    />
                  }
                >
                  <IrisSelect
                    items={(field.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
                    value={props.draft()[field.key] ?? ''}
                    onValueChange={(value) => props.setValue(field.key, String(value ?? ''))}
                    placeholder={field.placeholder ?? props.t('select.placeholder')}
                    size="sm"
                  />
                </Show>
              </IrisFormField>
            </div>
          )}
        </For>
        <div style={{ display: 'flex', gap: 'var(--iris-space-xs, 8px)' }}>
          <IrisButton type="submit" size="sm" data-iris-table-form-submit="">
            {props.config!.submitText ?? props.t('table.formSubmit')}
          </IrisButton>
          <IrisButton type="reset" variant="outline" size="sm" data-iris-table-form-reset="">
            {props.config!.resetText ?? props.t('table.formReset')}
          </IrisButton>
        </div>
      </form>
    </Show>
  )
}

export interface TableToolbarProps {
  toolbar: IrisTableToolbarConfig | undefined
  selectable: 'none' | 'single' | 'multi' | undefined
  selection: Accessor<Array<string | number>>
  refresh: () => void
  t: Translate
  importPreview?: boolean
  densityToggle?: boolean
  effectiveDensity?: Accessor<IrisTableDensity>
  onDensityToggle?: () => void
}

/** Toolbar chrome and built-in refresh/export/batch actions. */
export function TableToolbar(props: TableToolbarProps): JSX.Element {
  const importController = createTableImportController({
    getToolbar: () => props.toolbar,
    importPreview: () => props.importPreview,
  })
  const toolbar = (): IrisTableToolbarConfig => props.toolbar ?? {}

  return (
    <>
      <Show when={props.toolbar || props.densityToggle}>
        <div
          data-iris-table-toolbar=""
          style={{
            display: 'flex',
            'align-items': 'center',
            gap: 'var(--iris-space-sm, 12px)',
            padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
            border: '1px solid var(--iris-border)',
            'border-bottom': 'none',
            'border-top-left-radius': 'var(--iris-radius-md, 6px)',
            'border-top-right-radius': 'var(--iris-radius-md, 6px)',
            background: 'var(--iris-surface)',
            'font-size': 'var(--iris-font-size-sm, 13px)',
            position: 'relative',
          }}
        >
          <Show when={toolbar().title}>
            <span style={{ 'font-weight': 600, color: 'var(--iris-foreground)' }}>
              {toolbar().title}
            </span>
          </Show>
          <div style={{ flex: 1 }} />
          <Show when={toolbar().onRefresh}>
            <button
              type="button"
              data-iris-table-toolbar-refresh=""
              onClick={() => {
                toolbar().onRefresh?.()
                props.refresh()
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--iris-muted)',
                'font-size': 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={props.t('table.refresh')}
              title={props.t('table.refresh')}
            >
              ↻
            </button>
          </Show>
          <Show when={toolbar().onExport}>
            <button
              type="button"
              data-iris-table-toolbar-export=""
              onClick={() => toolbar().onExport?.()}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--iris-muted)',
                'font-size': 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={props.t('table.export')}
              title={props.t('table.export')}
            >
              ⇩
            </button>
          </Show>
          <Show when={toolbar().onImport}>
            <input
              ref={importController.setImportFileInput}
              type="file"
              accept=".csv,text/csv"
              data-iris-table-import-input=""
              onChange={importController.handleImportFile}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              data-iris-table-toolbar-import=""
              onClick={() => importController.importFileInput()?.click()}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--iris-muted)',
                'font-size': 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={props.t('table.import')}
              title={props.t('table.import')}
            >
              ⇪
            </button>
          </Show>
          <Show
            when={props.selectable === 'multi' && props.selection().length > 0 && toolbar().batch}
          >
            <button
              type="button"
              data-iris-table-toolbar-batch=""
              onClick={() => toolbar().batch!.onClick([...props.selection()])}
              style={{
                border: 'none',
                cursor: 'pointer',
                background: 'var(--iris-primary)',
                color: 'var(--iris-primary-foreground)',
                'font-size': 'var(--iris-font-size-md, 14px)',
                display: 'inline-flex',
                'align-items': 'center',
                gap: 'var(--iris-space-xxs, 4px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                'border-radius': 'var(--iris-radius-sm, 4px)',
              }}
              aria-label={toolbar().batch!.label}
              title={toolbar().batch!.label}
            >
              <Show when={toolbar().batch!.icon}>
                <span aria-hidden="true" style={{ 'font-size': 'var(--iris-font-size-sm, 13px)' }}>
                  {toolbar().batch!.icon}
                </span>
              </Show>
              {toolbar().batch!.label}
            </button>
          </Show>
          <For each={toolbar().buttons ?? []}>
            {(button) => (
              <button
                type="button"
                data-iris-table-toolbar-button={button.key}
                {...{ [`data-iris-table-toolbar-button-${button.key}`]: '' }}
                onClick={button.onClick}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--iris-foreground)',
                  'font-size': 'var(--iris-font-size-md, 14px)',
                  display: 'inline-flex',
                  'align-items': 'center',
                  gap: 'var(--iris-space-xxs, 4px)',
                  padding: '0 var(--iris-space-xxs, 4px)',
                }}
                aria-label={button.label}
                title={button.label}
              >
                <Show when={button.icon}>
                  <span
                    aria-hidden="true"
                    style={{ 'font-size': 'var(--iris-font-size-sm, 13px)' }}
                  >
                    {button.icon}
                  </span>
                </Show>
                {button.label}
              </button>
            )}
          </For>
          <Show when={props.densityToggle && props.effectiveDensity && props.onDensityToggle}>
            <button
              type="button"
              data-iris-density-toggle=""
              data-iris-density={props.effectiveDensity?.()}
              onClick={() => props.onDensityToggle?.()}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--iris-muted)',
                'font-size': 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={`${props.t('table.density')}: ${props.t(`table.density.${props.effectiveDensity?.()}`)}`}
              title={`${props.t('table.density')}: ${props.t(`table.density.${props.effectiveDensity?.()}`)}`}
            >
              {props.t(`table.density.${props.effectiveDensity?.()}`)}
            </button>
          </Show>
        </div>
      </Show>
      <ImportPreview
        rows={importController.importPreviewRows}
        t={props.t}
        onConfirm={importController.confirmImportPreview}
        onCancel={importController.cancelImportPreview}
      />
    </>
  )
}

export interface TablePagerProps<Row extends Record<string, unknown>> {
  enabled: Accessor<boolean>
  config: IrisTablePagerConfig | undefined
  state: Accessor<RemoteTableSourceState<Row>>
  setParams: (partial: Partial<RemoteTableParams>) => void
  onPageChange: IrisTableProxyConfig<Row>['onPageChange'] | undefined
  t: Translate
}

/** Server-side pager chrome, including optional totals and page-size selector. */
export function TablePager<Row extends Record<string, unknown>>(
  props: TablePagerProps<Row>,
): JSX.Element {
  return (
    <Show when={props.enabled()}>
      <div
        data-iris-table-pager=""
        style={{
          display: 'flex',
          'justify-content': 'flex-end',
          'align-items': 'center',
          padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
          'border-top': '1px solid var(--iris-border)',
          background: 'var(--iris-surface)',
        }}
      >
        <div style={{ display: 'flex', 'align-items': 'center', gap: 'var(--iris-space-xs, 8px)' }}>
          <Show when={props.config?.showTotal}>
            <span
              data-iris-table-total=""
              style={{ color: 'var(--iris-muted)', 'white-space': 'nowrap' }}
            >
              {props.t('table.total', { total: props.state().total })}
            </span>
          </Show>
          <Show when={props.config?.pageSizes && props.config.pageSizes.length > 0}>
            <IrisSelect
              items={(props.config?.pageSizes ?? []).map((size) => ({
                value: String(size),
                label: `${size} / ${props.t('table.page')}`,
              }))}
              value={String(props.state().params.pageSize)}
              onValueChange={(value) => {
                const size = Number(value)
                props.setParams({ pageSize: size, page: 1 })
                props.onPageChange?.(1, size)
              }}
              aria-label={props.t('table.pageSize')}
            />
          </Show>
          <IrisPagination
            total={props.state().total}
            pageSize={props.state().params.pageSize}
            page={props.state().params.page}
            onChange={(page) => {
              props.setParams({ page })
              props.onPageChange?.(page, props.state().params.pageSize)
            }}
          />
        </div>
      </div>
    </Show>
  )
}
