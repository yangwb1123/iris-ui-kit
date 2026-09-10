import * as React from 'react'
import { IrisInput } from '../input/Input'
import type { IrisTableColumn, IrisTableTab } from './types'
import { COLUMN_TOTALS_STYLE } from './styles'
import { FNR_BUTTON_STYLE } from './table-constants'
import { justifyFor } from './cell-helpers'
import type { TableTranslate } from './table-header-types'

export function TableTabs({
  tabs,
  activeTabKey,
  applyTab,
}: {
  tabs: IrisTableTab[]
  activeTabKey: string | null
  applyTab: (key: string) => void
}): React.ReactElement | null {
  return tabs.length > 0 ? (
    <div
      data-iris-table-tabs=""
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--iris-space-xs, 8px)',
        padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
        border: '1px solid var(--iris-border)',
        borderBottom: 'none',
        borderTopLeftRadius: 'var(--iris-radius-md, 6px)',
        borderTopRightRadius: 'var(--iris-radius-md, 6px)',
        background: 'var(--iris-surface)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={activeTabKey === tab.key}
          data-iris-table-tab={tab.key}
          data-active={activeTabKey === tab.key ? '' : undefined}
          onClick={() => applyTab(tab.key)}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            font: 'inherit',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
            color: activeTabKey === tab.key ? 'var(--iris-primary)' : 'var(--iris-muted)',
            fontWeight: activeTabKey === tab.key ? 600 : 400,
            boxShadow: activeTabKey === tab.key ? 'inset 0 -2px 0 var(--iris-primary)' : 'none',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ) : null
}

export function TableImportPreview({
  rows: importPreviewRows,
  columns: importPreviewColumns,
  t,
  onCancel: cancelImportPreview,
  onConfirm: confirmImportPreview,
}: {
  rows: Record<string, unknown>[] | null
  columns: string[]
  t: TableTranslate
  onCancel: () => void
  onConfirm: () => void
}): React.ReactElement | null {
  return importPreviewRows ? (
    <div
      data-iris-import-preview-backdrop=""
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) cancelImportPreview()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--iris-backdrop, rgba(0, 0, 0, 0.5))',
        zIndex: 'var(--iris-z-modal, 1200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--iris-space-lg, 24px)',
      }}
    >
      <div
        data-iris-import-preview=""
        role="dialog"
        aria-modal="true"
        aria-label={t('table.importPreview.title')}
        style={{
          background: 'var(--iris-surface-floating, var(--iris-surface))',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-lg, 8px)',
          boxShadow: 'var(--iris-shadow-xl)',
          padding: 'var(--iris-space-lg, 24px)',
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--iris-space-sm, 12px)',
          fontSize: 'var(--iris-font-size-md, 14px)',
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--iris-foreground)' }}>
          {t('table.importPreview.title')}
        </div>
        {importPreviewColumns.length > 0 ? (
          <table
            data-iris-import-preview-table=""
            style={{
              borderCollapse: 'collapse',
              fontSize: 'var(--iris-font-size-sm, 13px)',
            }}
          >
            <thead>
              <tr>
                {importPreviewColumns.map((h) => (
                  <th
                    key={h}
                    data-iris-import-preview-header={h}
                    style={{
                      border: '1px solid var(--iris-border)',
                      padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                      background: 'var(--iris-surface)',
                      color: 'var(--iris-foreground)',
                      textAlign: 'start',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {importPreviewRows.slice(0, 5).map((row, ri) => (
                <tr key={ri}>
                  {importPreviewColumns.map((h) => (
                    <td
                      key={h}
                      data-iris-import-preview-cell={`${ri}:${h}`}
                      style={{
                        border: '1px solid var(--iris-border)',
                        padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                        color: 'var(--iris-foreground)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {String(row[h] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {importPreviewRows.length > 5 ? (
          <div
            data-iris-import-preview-total=""
            style={{
              color: 'var(--iris-muted)',
              fontSize: 'var(--iris-font-size-xs, 12px)',
            }}
          >
            {t('table.total', { total: importPreviewRows.length })}
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--iris-space-xs, 8px)',
          }}
        >
          <button
            type="button"
            data-iris-import-preview-cancel=""
            onClick={cancelImportPreview}
            style={{
              border: '1px solid var(--iris-border)',
              cursor: 'pointer',
              background: 'var(--iris-surface)',
              color: 'var(--iris-foreground)',
              fontSize: 'var(--iris-font-size-sm, 13px)',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
              borderRadius: 'var(--iris-radius-sm, 4px)',
            }}
          >
            {t('table.importPreview.cancel')}
          </button>
          <button
            type="button"
            data-iris-import-preview-confirm=""
            onClick={confirmImportPreview}
            style={{
              border: 'none',
              cursor: 'pointer',
              background: 'var(--iris-primary)',
              color: 'var(--iris-primary-foreground)',
              fontSize: 'var(--iris-font-size-sm, 13px)',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
              borderRadius: 'var(--iris-radius-sm, 4px)',
            }}
          >
            {t('table.importPreview.confirm')}
          </button>
        </div>
      </div>
    </div>
  ) : null
}

export function TableColumnTotals<Row extends Record<string, unknown>>({
  enabled: columnTotals,
  columns: leafColumns,
  values: columnTotalsValues,
  rows: bodyData,
  selectable,
  gridTemplateColumns,
  baseCellStyle,
  columnFadeAttr,
  columnFadeStyle,
}: {
  enabled: boolean
  columns: IrisTableColumn<Row>[]
  values: Record<string, number | null | undefined>
  rows: Row[]
  selectable: 'none' | 'single' | 'multi'
  gridTemplateColumns: string
  baseCellStyle: React.CSSProperties
  columnFadeAttr: (column: IrisTableColumn<Row>) => 'in' | 'out' | undefined
  columnFadeStyle: (column: IrisTableColumn<Row>) => React.CSSProperties | null
}): React.ReactElement | null {
  return columnTotals ? (
    <div data-iris-column-totals="" style={{ ...COLUMN_TOTALS_STYLE, gridTemplateColumns }}>
      {selectable !== 'none' ? (
        <div role="cell" data-iris-column-totals-cell="__selection" style={baseCellStyle} />
      ) : null}
      {leafColumns.map((col) => {
        const value = columnTotalsValues[col.key]
        return (
          <div
            key={col.key}
            data-iris-column-totals-cell={col.key}
            data-iris-column-fade={columnFadeAttr(col)}
            style={{
              ...baseCellStyle,
              ...(columnFadeStyle(col) ?? null),
              justifyContent: justifyFor(col.align),
            }}
          >
            {value != null
              ? col.renderSummary
                ? col.renderSummary(value, bodyData)
                : String(value)
              : null}
          </div>
        )
      })}
    </div>
  ) : null
}

export function TableFindReplaceBar({
  enabled: fnr,
  open: fnrOpen,
  findRef: fnrFindRef,
  query: fnrQuery,
  replace: fnrReplace,
  matches: fnrMatches,
  activeIndex: fnrActiveIndex,
  setQuery: setFnrQuery,
  setReplace: setFnrReplace,
  step: stepFnrMatch,
  replaceActive: replaceFnrActive,
  replaceAll: replaceAllFnrMatches,
  close: setFnrOpen,
  t,
}: {
  enabled: boolean
  open: boolean
  findRef: React.Ref<HTMLInputElement>
  query: string
  replace: string
  matches: Array<{ row: number; col: number }>
  activeIndex: number
  setQuery: (value: string) => void
  setReplace: (value: string) => void
  step: (delta: number) => void
  replaceActive: () => void
  replaceAll: () => void
  close: (open: boolean) => void
  t: TableTranslate
}): React.ReactElement | null {
  return fnr && fnrOpen ? (
    <div
      data-iris-fnr-bar=""
      data-iris-table-surface=""
      onKeyDown={(e) => {
        // Only the find input steps matches; Enter in the replace input
        // keeps its default (insert line break) and buttons stay clickable.
        const target = e.target as HTMLElement | null
        if (target?.dataset.irisFnrFind === undefined) return
        if (e.key !== 'Enter') return
        e.preventDefault()
        stepFnrMatch(e.shiftKey ? -1 : 1)
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--iris-space-xs, 8px)',
        padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
        border: '1px solid var(--iris-border)',
        borderBottom: 'none',
        background: 'var(--iris-surface)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      <IrisInput
        ref={fnrFindRef}
        data-iris-fnr-find=""
        value={fnrQuery}
        onChange={(e) => setFnrQuery(e.target.value)}
        placeholder={t('fnr.find')}
        aria-label={t('fnr.find')}
        style={{ width: 180 }}
      />
      <IrisInput
        data-iris-fnr-replace=""
        value={fnrReplace}
        onChange={(e) => setFnrReplace(e.target.value)}
        placeholder={t('fnr.replace')}
        aria-label={t('fnr.replace')}
        style={{ width: 180 }}
      />
      <button
        type="button"
        data-iris-fnr-prev=""
        onClick={() => stepFnrMatch(-1)}
        aria-label={t('fnr.prev')}
        title={t('fnr.prev')}
        style={FNR_BUTTON_STYLE}
      >
        ↑
      </button>
      <button
        type="button"
        data-iris-fnr-next=""
        onClick={() => stepFnrMatch(1)}
        aria-label={t('fnr.next')}
        title={t('fnr.next')}
        style={FNR_BUTTON_STYLE}
      >
        ↓
      </button>
      <button
        type="button"
        data-iris-fnr-replace-btn=""
        onClick={replaceFnrActive}
        style={FNR_BUTTON_STYLE}
      >
        {t('fnr.replace')}
      </button>
      <button
        type="button"
        data-iris-fnr-replace-all=""
        onClick={replaceAllFnrMatches}
        style={FNR_BUTTON_STYLE}
      >
        {t('fnr.replaceAll')}
      </button>
      <button
        type="button"
        data-iris-fnr-close=""
        onClick={() => setFnrOpen(false)}
        aria-label={t('dialog.close')}
        title={t('dialog.close')}
        style={FNR_BUTTON_STYLE}
      >
        ×
      </button>
      <span data-iris-fnr-count="" style={{ color: 'var(--iris-muted)' }}>
        {fnrMatches.length > 0 ? `${fnrActiveIndex + 1}/${fnrMatches.length}` : '0/0'}
      </span>
    </div>
  ) : null
}

const BACK_TOP_ANCHOR_STYLE: React.CSSProperties = {
  position: 'sticky',
  insetBlockEnd: 0,
  height: 0,
  pointerEvents: 'none',
  zIndex: 3,
}

const BACK_TOP_BUTTON_STYLE: React.CSSProperties = {
  position: 'absolute',
  insetBlockEnd: 24,
  insetInlineEnd: 24,
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: '1px solid var(--iris-border)',
  background: 'var(--iris-surface, var(--iris-background))',
  color: 'var(--iris-foreground)',
  cursor: 'pointer',
  boxShadow: 'var(--iris-shadow-md)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--iris-font-size-xl, 18px)',
  pointerEvents: 'auto',
}

export function TableBackTop({
  visible,
  label,
  onClick,
}: {
  visible: boolean
  label: () => string
  onClick: () => void
}): React.ReactElement | null {
  if (!visible) return null
  const resolvedLabel = label()
  return (
    <div data-iris-back-top-anchor="" style={BACK_TOP_ANCHOR_STYLE}>
      <button
        type="button"
        data-iris-back-top-table=""
        aria-label={resolvedLabel}
        title={resolvedLabel}
        onClick={onClick}
        style={BACK_TOP_BUTTON_STYLE}
      >
        ↑
      </button>
    </div>
  )
}
