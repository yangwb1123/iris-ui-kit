import * as React from 'react'

export interface TableGroupHeaderEntry {
  groupKey: string
  count: number
  depth?: number
  value?: string
}

export interface TableGroupHeaderProps {
  entry: TableGroupHeaderEntry
  gridTemplateColumns: string
  borderStyle: string
  collapsed: boolean
  extraStyle?: React.CSSProperties
  onToggle: (groupKey: string) => void
  t: (key: string) => string
}

/** Group header row shared by virtual and non-virtual table body plans. */
export function TableGroupHeader({
  entry,
  gridTemplateColumns,
  borderStyle,
  collapsed,
  extraStyle,
  onToggle,
  t,
}: TableGroupHeaderProps): React.ReactElement {
  const depth = entry.depth ?? 0
  return (
    <div
      key={`group:${entry.groupKey}`}
      role="row"
      data-iris-group-row=""
      data-iris-group-key={entry.groupKey}
      data-iris-group-depth={depth}
      data-iris-group-collapsed={collapsed ? 'true' : undefined}
      style={{
        display: 'grid',
        gridTemplateColumns,
        background: 'var(--iris-surface)',
        borderBottom: borderStyle,
        fontWeight: 600,
        ...extraStyle,
      }}
    >
      <div
        role="cell"
        data-iris-group-cell=""
        style={{
          gridColumn: '1 / -1',
          padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
          paddingInlineStart: `calc(var(--iris-space-sm, 12px) + var(--iris-space-sm, 12px) * ${depth})`,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--iris-space-xs, 8px)',
          fontSize: 'var(--iris-font-size-sm, 13px)',
          color: 'var(--iris-foreground)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <button
          type="button"
          data-iris-group-toggle=""
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('table.groupExpand') : t('table.groupCollapse')}
          onClick={() => onToggle(entry.groupKey)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'var(--iris-space-md, 16px)',
            height: 'var(--iris-space-md, 16px)',
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--iris-muted)',
            cursor: 'pointer',
            fontSize: 'var(--iris-font-size-xs, 12px)',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <span data-iris-group-value="">{entry.value ?? entry.groupKey}</span>
        <span
          data-iris-group-count=""
          style={{ color: 'var(--iris-muted)', fontSize: 'var(--iris-font-size-xs, 12px)' }}
        >
          ({entry.count})
        </span>
      </div>
    </div>
  )
}
