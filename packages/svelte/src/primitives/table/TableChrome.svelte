<script lang="ts">
  import type { I18n, RemoteTableSourceState, RemoteTableParams } from '@iris-ui-kit/core'
  import IrisButton from '../button/IrisButton.svelte'
  import IrisFormField from '../form-field/FormField.svelte'
  import IrisInput from '../input/Input.svelte'
  import IrisPagination from '../pagination/IrisPagination.svelte'
  import IrisSelect from '../select/IrisSelect.svelte'
  import type {
    IrisTableFormConfig,
    IrisTablePagerConfig,
    IrisTableProxyConfig,
    IrisTableToolbarConfig,
    IrisTableDensity,
  } from './types'
  import TableImportPreview from './TableImportPreview.svelte'
  import { createTableImportController } from './table-import.svelte'

  type Translate = I18n['t']
  type Row = Record<string, unknown>

  interface FormProps {
    config: IrisTableFormConfig | undefined
    draft: Record<string, string>
    setValue: (key: string, value: string) => void
    onSubmit: (event: Event) => void
    onReset: (event: Event) => void
    t: Translate
  }

  interface ToolbarProps {
    toolbar: IrisTableToolbarConfig | undefined
    selectable: 'none' | 'single' | 'multi'
    selectedKeys: Array<string | number>
    refresh: () => void
    t: Translate
    importPreview?: boolean
    densityToggle?: boolean
    effectiveDensity?: IrisTableDensity
    onDensityToggle?: () => void
  }

  interface PagerProps {
    enabled: boolean
    pagerConfig: IrisTablePagerConfig | undefined
    snapshot: RemoteTableSourceState<Row>
    setParams: (partial: Partial<RemoteTableParams>) => void
    onPageChange: IrisTableProxyConfig['onPageChange'] | undefined
    t: Translate
  }

  let {
    config,
    draft,
    setValue,
    onSubmit,
    onReset,
    toolbar,
    selectable,
    selectedKeys,
    refresh,
    enabled,
    snapshot,
    pagerConfig,
    setParams,
    onPageChange,
    t,
    importPreview = false,
    densityToggle = false,
    effectiveDensity = 'comfortable',
    onDensityToggle,
  }: FormProps & ToolbarProps & PagerProps = $props()

  let importInput = $state<HTMLInputElement | null>(null)
  const importController = createTableImportController({
    getToolbar: () => toolbar,
    isPreviewEnabled: () => importPreview,
  })
  const toolbarView = $derived(toolbar ?? ({} as IrisTableToolbarConfig))
</script>

{#if config}
  <form
    data-iris-table-form=""
    onsubmit={onSubmit}
    onreset={onReset}
    style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--iris-space-sm, 12px); padding: var(--iris-space-sm, 12px); border: 1px solid var(--iris-border); border-bottom: none; background: var(--iris-surface); font-size: var(--iris-font-size-sm, 13px)"
  >
    {#each config.fields as field}
      <div data-iris-table-form-field={field.key} style="min-width: 180px">
        <IrisFormField label={field.label} size="sm">
          {#if field.type === 'select'}
            <IrisSelect
              items={(field.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
              value={draft[field.key] ?? ''}
              onValueChange={(value) => setValue(field.key, String(value ?? ''))}
              placeholder={field.placeholder ?? t('select.placeholder')}
              size="sm"
            />
          {:else}
            <IrisInput
              value={draft[field.key] ?? ''}
              oninput={(event) => setValue(field.key, (event.target as HTMLInputElement).value)}
              placeholder={field.placeholder}
              size="sm"
            />
          {/if}
        </IrisFormField>
      </div>
    {/each}
    <div style="display: flex; gap: var(--iris-space-xs, 8px)">
      <IrisButton type="submit" size="sm" data-iris-table-form-submit="">
        {config.submitText ?? t('table.formSubmit')}
      </IrisButton>
      <IrisButton type="reset" variant="outline" size="sm" data-iris-table-form-reset="">
        {config.resetText ?? t('table.formReset')}
      </IrisButton>
    </div>
  </form>
{/if}

{#if toolbar || densityToggle}
  <div
    data-iris-table-toolbar=""
    style="display: flex; align-items: center; gap: var(--iris-space-sm, 12px); padding: var(--iris-space-xs, 8px) var(--iris-space-sm, 12px); border: 1px solid var(--iris-border); border-bottom: none; border-top-left-radius: var(--iris-radius-md, 6px); border-top-right-radius: var(--iris-radius-md, 6px); background: var(--iris-surface); font-size: var(--iris-font-size-sm, 13px); position: relative"
  >
    {#if toolbarView.title}<span style="font-weight: 600; color: var(--iris-foreground)"
        >{toolbarView.title}</span
      >{/if}
    <div style="flex: 1"></div>
    {#if toolbarView.onRefresh}
      <button
        type="button"
        data-iris-table-toolbar-refresh=""
        onclick={() => {
          toolbarView.onRefresh?.()
          refresh()
        }}
        style="border: none; background: transparent; cursor: pointer; color: var(--iris-muted); font-size: var(--iris-font-size-md, 14px)"
        aria-label={t('table.refresh')}
        title={t('table.refresh')}>↻</button
      >
    {/if}
    {#if toolbarView.onExport}
      <button
        type="button"
        data-iris-table-toolbar-export=""
        onclick={() => toolbarView.onExport?.()}
        style="border: none; background: transparent; cursor: pointer; color: var(--iris-muted); font-size: var(--iris-font-size-md, 14px)"
        aria-label={t('table.export')}
        title={t('table.export')}>⇩</button
      >
    {/if}
    {#if toolbarView.onImport}
      <input
        bind:this={importInput}
        type="file"
        accept=".csv,text/csv"
        data-iris-table-import-input
        onchange={importController.handleFile}
        style="display: none"
      />
      <button
        type="button"
        data-iris-table-toolbar-import
        onclick={() => {
          importInput?.click()
        }}
        style="border: none; background: transparent; cursor: pointer; color: var(--iris-muted); font-size: var(--iris-font-size-md, 14px)"
        aria-label={t('table.import')}
        title={t('table.import')}>⇪</button
      >
    {/if}
    {#if selectable === 'multi' && selectedKeys.length > 0 && toolbarView.batch}
      <button
        type="button"
        data-iris-table-toolbar-batch=""
        onclick={() => toolbarView.batch?.onClick([...selectedKeys])}
        style="border: none; cursor: pointer; background: var(--iris-primary); color: var(--iris-primary-foreground); font-size: var(--iris-font-size-md, 14px); display: inline-flex; align-items: center; gap: var(--iris-space-xxs, 4px); padding: var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px); border-radius: var(--iris-radius-sm, 4px)"
        aria-label={toolbarView.batch.label}
        title={toolbarView.batch.label}
      >
        {#if toolbarView.batch.icon}<span
            aria-hidden="true"
            style="font-size: var(--iris-font-size-sm, 13px)">{toolbarView.batch.icon}</span
          >{/if}
        {toolbarView.batch.label}
      </button>
    {/if}
    {#each toolbarView.buttons ?? [] as button}
      <button
        type="button"
        data-iris-table-toolbar-button={button.key}
        onclick={button.onClick}
        style="border: none; background: transparent; cursor: pointer; color: var(--iris-foreground); font-size: var(--iris-font-size-md, 14px); display: inline-flex; align-items: center; gap: var(--iris-space-xxs, 4px); padding: 0 var(--iris-space-xxs, 4px)"
        aria-label={button.label}
        title={button.label}
      >
        {#if button.icon}<span aria-hidden="true" style="font-size: var(--iris-font-size-sm, 13px)"
            >{button.icon}</span
          >{/if}
        {button.label}
      </button>
    {/each}
    {#if densityToggle}
      <button
        type="button"
        data-iris-density-toggle=""
        data-iris-density={effectiveDensity}
        onclick={() => onDensityToggle?.()}
        style="border: none; background: transparent; cursor: pointer; color: var(--iris-muted); font-size: var(--iris-font-size-md, 14px)"
        aria-label={`${t('table.density')}: ${t(`table.density.${effectiveDensity}`)}`}
        title={`${t('table.density')}: ${t(`table.density.${effectiveDensity}`)}`}
      >
        {t(`table.density.${effectiveDensity}`)}
      </button>
    {/if}
  </div>
{/if}

<TableImportPreview
  rows={importController.rows}
  {t}
  onConfirm={importController.confirm}
  onCancel={importController.cancel}
/>

{#if enabled}
  <div
    data-iris-table-pager=""
    style="display: flex; justify-content: flex-end; align-items: center; padding: var(--iris-space-xs, 8px) var(--iris-space-sm, 12px); border-top: 1px solid var(--iris-border); background: var(--iris-surface)"
  >
    <div style="display: flex; align-items: center; gap: var(--iris-space-xs, 8px)">
      {#if pagerConfig?.showTotal}
        <span data-iris-table-total="" style="color: var(--iris-muted); white-space: nowrap">
          {t('table.total', { total: String(snapshot.total) })}
        </span>
      {/if}
      {#if pagerConfig?.pageSizes && pagerConfig.pageSizes.length > 0}
        <IrisSelect
          items={(pagerConfig.pageSizes ?? []).map((size) => ({
            value: String(size),
            label: `${size} / ${t('table.page')}`,
          }))}
          value={String(snapshot.params.pageSize)}
          onValueChange={(value) => {
            const size = Number(value)
            setParams({ pageSize: size, page: 1 })
            onPageChange?.(1, size)
          }}
          aria-label={t('table.pageSize')}
        />
      {/if}
      <IrisPagination
        total={snapshot.total}
        pageSize={snapshot.params.pageSize}
        value={snapshot.params.page}
        onchange={(page) => {
          setParams({ page })
          onPageChange?.(page, snapshot.params.pageSize)
        }}
      />
    </div>
  </div>
{/if}
