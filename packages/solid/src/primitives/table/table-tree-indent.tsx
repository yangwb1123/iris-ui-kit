import { Show, type Accessor, type JSX } from 'solid-js'
import type { I18n, TreeRow } from '@iris-ui-kit/core'

type Translate = I18n['t']

type TableRow = Record<string, unknown>

interface TableTreeIndentProps<Row extends TableRow> {
  row: Row
  treeMeta: TreeRow<Row>
  t: Translate
  expandedKeys: Accessor<string[]>
  toggle: (key: string) => void
  lazy: Accessor<boolean>
  hasLoadedChildren: (row: Row) => boolean
  loading: Accessor<Set<string>>
  loadChildren: (row: Row, treeMeta: TreeRow<Row>) => void
}

export function TableTreeIndent<Row extends TableRow>(
  props: TableTreeIndentProps<Row>,
): JSX.Element {
  const expanded = (): boolean => props.expandedKeys().includes(props.treeMeta.key)

  return (
    <span
      data-iris-table-tree-indent=""
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        flex: 'none',
        'padding-left': `${props.treeMeta.depth * 16}px`,
      }}
    >
      <Show
        when={props.treeMeta.hasChildren}
        fallback={
          props.lazy() && !props.hasLoadedChildren(props.row) ? (
            <button
              type="button"
              data-iris-table-tree-toggle=""
              data-iris-tree-loading={props.loading().has(props.treeMeta.key) ? '' : undefined}
              aria-expanded="false"
              aria-label={props.t('treeSelect.expand')}
              onClick={(event) => {
                event.stopPropagation()
                props.loadChildren(props.row, props.treeMeta)
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '0',
                'margin-right': '4px',
                font: 'inherit',
                color: 'var(--iris-foreground)',
                transform: 'none',
                transition: 'transform 150ms',
              }}
            >
              ▶
            </button>
          ) : (
            <span aria-hidden="true" style={{ display: 'inline-block', width: '16px' }} />
          )
        }
      >
        <button
          type="button"
          data-iris-table-tree-toggle=""
          aria-expanded={expanded()}
          aria-label={props.t(expanded() ? 'treeSelect.collapse' : 'treeSelect.expand')}
          onClick={(event) => {
            event.stopPropagation()
            props.toggle(props.treeMeta.key)
          }}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: '0',
            'margin-right': '4px',
            font: 'inherit',
            color: 'var(--iris-foreground)',
            transform: expanded() ? 'rotate(90deg)' : 'none',
            transition: 'transform 150ms',
          }}
        >
          ▶
        </button>
      </Show>
    </span>
  )
}
