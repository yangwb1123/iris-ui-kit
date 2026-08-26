import * as React from 'react'
import type { GridPaginationState } from '@iris-ui-kit/core/grid'
import { IrisButton } from '../button/Button'
import { IrisFormField } from '../form-field/FormField'
import { IrisInput } from '../input/Input'
import { IrisPagination } from '../pagination'
import { IrisSelect } from '../select/Select'
import type { UseI18nReturn } from '../../i18n'
import type { IrisTableFormConfig, IrisTablePagerConfig } from './props'

type Translate = UseI18nReturn['t']

export interface TableFormProps {
  config: IrisTableFormConfig | undefined
  draft: Record<string, string>
  setValue: (key: string, value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onReset: (event: React.FormEvent<HTMLFormElement>) => void
  t: Translate
}

/** Optional vxe-style form chrome, kept outside the main table renderer. */
export function TableForm({ config, draft, setValue, onSubmit, onReset, t }: TableFormProps) {
  if (!config) return null
  return (
    <form
      data-iris-table-form=""
      onSubmit={onSubmit}
      onReset={onReset}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        gap: 'var(--iris-space-sm, 12px)',
        padding: 'var(--iris-space-sm, 12px)',
        border: '1px solid var(--iris-border)',
        borderBottom: 'none',
        background: 'var(--iris-surface)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      {config.fields.map((field) => (
        <div key={field.key} data-iris-table-form-field={field.key} style={{ minWidth: 180 }}>
          <IrisFormField label={field.label} size="sm">
            {field.type === 'select' ? (
              <IrisSelect
                items={(field.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
                value={draft[field.key] ?? ''}
                onValueChange={(value) => setValue(field.key, String(value ?? ''))}
                placeholder={field.placeholder ?? t('select.placeholder')}
                size="sm"
              />
            ) : (
              <IrisInput
                value={draft[field.key] ?? ''}
                onChange={(event) => setValue(field.key, event.target.value)}
                placeholder={field.placeholder}
                size="sm"
              />
            )}
          </IrisFormField>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 'var(--iris-space-xs, 8px)' }}>
        <IrisButton type="submit" size="sm" data-iris-table-form-submit="">
          {config.submitText ?? t('table.formSubmit')}
        </IrisButton>
        <IrisButton type="reset" variant="outline" size="sm" data-iris-table-form-reset="">
          {config.resetText ?? t('table.formReset')}
        </IrisButton>
      </div>
    </form>
  )
}

export interface TablePagerProps {
  pagination: GridPaginationState
  config: IrisTablePagerConfig | undefined
  borderTop: string
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  t: Translate
}

/** Server-side pager chrome for a live proxy source. */
export function TablePager({
  pagination,
  config,
  borderTop,
  setPage,
  setPageSize,
  t,
}: TablePagerProps) {
  return (
    <div
      data-iris-table-pager=""
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
        borderTop,
        background: 'var(--iris-surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iris-space-xs, 8px)' }}>
        {config?.showTotal ? (
          <span
            data-iris-table-total=""
            style={{ color: 'var(--iris-muted)', whiteSpace: 'nowrap' }}
          >
            {t('table.total', { total: pagination.total })}
          </span>
        ) : null}
        {config?.pageSizes && config.pageSizes.length > 0 ? (
          <IrisSelect
            items={config.pageSizes.map((size) => ({
              value: String(size),
              label: `${size} / ${t('table.page')}`,
            }))}
            value={String(pagination.pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value))
            }}
            aria-label={t('table.pageSize')}
          />
        ) : null}
        <IrisPagination
          total={pagination.total}
          pageSize={pagination.pageSize}
          value={pagination.page}
          onValueChange={setPage}
        />
      </div>
    </div>
  )
}
