import * as React from 'react'
import type { IrisTableNamedView, IrisTableViewConfig } from './types'

/** Internal select value that opens the save input (never a real view name). */
const SAVE_ITEM_VALUE = '__iris-save-view'

interface TableViewsProps {
  config: IrisTableViewConfig | undefined
  views: IrisTableNamedView[]
  activeKey: string | null
  onSelect: (key: string) => void
  onSave: (name: string) => void
  onDelete: (key: string) => void
  t: (key: string) => string
}

/**
 * Named-view presets UI (batch AH, iris 独有): a compact select of saved
 * views + a "＋ 保存" item that opens a small inline input (Enter confirms,
 * Escape/blur cancels) + a per-active-view delete (×). The select carries
 * `data-iris-table-views`, the save input `data-iris-views-save`, the delete
 * button `data-iris-table-views-delete`. Token-styled only; renders inline in
 * the toolbar row (no floating surface — the row itself is the container).
 */
export function TableViews({
  config,
  views,
  activeKey,
  onSelect,
  onSave,
  onDelete,
  t,
}: TableViewsProps): React.ReactElement {
  const [saveOpen, setSaveOpen] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  // Focus the save input as soon as it opens.
  React.useEffect(() => {
    if (saveOpen) inputRef.current?.focus()
  }, [saveOpen])

  const openSave = (): void => {
    setDraft('')
    setSaveOpen(true)
  }
  const confirmSave = (): void => {
    if (draft.trim() === '') return
    onSave(draft)
    setSaveOpen(false)
  }

  const selectStyle: React.CSSProperties = {
    border: '1px solid var(--iris-border)',
    borderRadius: 'var(--iris-radius-sm, 4px)',
    background: 'var(--iris-surface)',
    color: 'var(--iris-foreground)',
    font: 'inherit',
    fontSize: 'var(--iris-font-size-sm, 13px)',
    padding: '0 var(--iris-space-xxs, 4px)',
    maxWidth: 180,
  }
  const buttonStyle: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--iris-muted)',
    font: 'inherit',
    fontSize: 'var(--iris-font-size-md, 14px)',
    padding: '0 var(--iris-space-xxs, 4px)',
    lineHeight: 1,
  }

  return (
    <div
      data-iris-table-views-bar=""
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--iris-space-xxs, 4px)' }}
    >
      <select
        data-iris-table-views=""
        value={saveOpen ? SAVE_ITEM_VALUE : (activeKey ?? '')}
        aria-label={t('table.views.placeholder')}
        onChange={(e) => {
          const v = e.target.value
          if (v === SAVE_ITEM_VALUE) {
            openSave()
          } else if (v !== '') {
            onSelect(v)
          }
        }}
        style={selectStyle}
      >
        {activeKey === null && !saveOpen ? (
          <option value="" disabled>
            {t('table.views.placeholder')}
          </option>
        ) : null}
        {views.map((view) => (
          <option key={view.name} value={view.name}>
            {config?.label?.(view.name) ?? view.name}
          </option>
        ))}
        <option value={SAVE_ITEM_VALUE}>＋ {t('table.views.save')}</option>
      </select>
      {saveOpen ? (
        <input
          ref={inputRef}
          data-iris-views-save=""
          type="text"
          value={draft}
          placeholder={t('table.views.placeholder')}
          aria-label={t('table.views.save')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              confirmSave()
            } else if (e.key === 'Escape') {
              setSaveOpen(false)
            }
          }}
          onBlur={() => setSaveOpen(false)}
          style={{
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
            background: 'var(--iris-surface)',
            color: 'var(--iris-foreground)',
            font: 'inherit',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            padding: 'var(--iris-space-xxs, 4px)',
            width: 120,
          }}
        />
      ) : null}
      {activeKey !== null ? (
        <button
          type="button"
          data-iris-table-views-delete=""
          onClick={() => onDelete(activeKey)}
          aria-label={t('table.views.delete')}
          title={t('table.views.delete')}
          style={buttonStyle}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
