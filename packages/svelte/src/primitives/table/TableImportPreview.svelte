<script lang="ts">
  import { previewColumnsFromRows } from '@iris-ui-kit/core'
  import type { UseI18nReturn } from '../../i18n'

  type Row = Record<string, unknown>
  type Translate = UseI18nReturn['t']

  let {
    rows = null,
    t,
    onConfirm,
    onCancel,
  }: {
    rows?: readonly Row[] | null
    t: Translate
    onConfirm: () => void
    onCancel: () => void
  } = $props()

  let columns = $derived(previewColumnsFromRows(rows))
</script>

{#if rows}
  <div
    data-iris-import-preview-backdrop
    role="presentation"
    onpointerdown={(event) => {
      if (event.target === event.currentTarget) onCancel()
    }}
    style="position: fixed; inset: 0; background: var(--iris-backdrop, rgba(0, 0, 0, 0.5)); z-index: var(--iris-z-modal, 1200); display: flex; align-items: center; justify-content: center; padding: var(--iris-space-lg, 24px)"
  >
    <div
      data-iris-import-preview
      role="dialog"
      aria-modal="true"
      aria-label={t('table.importPreview.title')}
      style="background: var(--iris-surface-floating, var(--iris-surface)); color: var(--iris-foreground); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-lg, 8px); box-shadow: var(--iris-shadow-xl); padding: var(--iris-space-lg, 24px); max-width: 90vw; max-height: 85vh; overflow: auto; display: flex; flex-direction: column; gap: var(--iris-space-sm, 12px); font-size: var(--iris-font-size-md, 14px)"
    >
      <div style="font-weight: 600">{t('table.importPreview.title')}</div>
      {#if columns.length > 0}
        <table
          data-iris-import-preview-table
          style="border-collapse: collapse; font-size: var(--iris-font-size-sm, 13px)"
        >
          <thead>
            <tr>
              {#each columns as column}
                <th
                  data-iris-import-preview-header={column}
                  style="border: 1px solid var(--iris-border); padding: var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px); background: var(--iris-surface); color: var(--iris-foreground); text-align: start; font-weight: 600; white-space: nowrap"
                  >{column}</th
                >
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each rows.slice(0, 5) as row, rowIndex}
              <tr>
                {#each columns as column}
                  <td
                    data-iris-import-preview-cell={`${rowIndex}:${column}`}
                    style="border: 1px solid var(--iris-border); padding: var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px); color: var(--iris-foreground); white-space: nowrap"
                    >{String(row[column] ?? '')}</td
                  >
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
      {#if rows.length > 5}
        <div
          data-iris-import-preview-total
          style="color: var(--iris-muted); font-size: var(--iris-font-size-xs, 12px)"
        >
          {t('table.total', { total: rows.length })}
        </div>
      {/if}
      <div style="display: flex; justify-content: flex-end; gap: var(--iris-space-xs, 8px)">
        <button
          type="button"
          data-iris-import-preview-cancel
          onclick={onCancel}
          style="border: 1px solid var(--iris-border); cursor: pointer; background: var(--iris-surface); color: var(--iris-foreground); font-size: var(--iris-font-size-sm, 13px); padding: var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px); border-radius: var(--iris-radius-sm, 4px)"
          >{t('table.importPreview.cancel')}</button
        >
        <button
          type="button"
          data-iris-import-preview-confirm
          onclick={onConfirm}
          style="border: none; cursor: pointer; background: var(--iris-primary); color: var(--iris-primary-foreground); font-size: var(--iris-font-size-sm, 13px); padding: var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px); border-radius: var(--iris-radius-sm, 4px)"
          >{t('table.importPreview.confirm')}</button
        >
      </div>
    </div>
  </div>
{/if}
