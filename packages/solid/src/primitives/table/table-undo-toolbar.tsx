import type { Accessor, JSX } from 'solid-js'
import type { UseI18nReturn } from '../../i18n'

type Translate = UseI18nReturn['t']

export interface TableUndoToolbarProps {
  canUndo: Accessor<boolean>
  canRedo: Accessor<boolean>
  onUndo: () => void
  onRedo: () => void
  t: Translate
}

/** Token-only undo/redo controls for the table toolbar. */
export function TableUndoToolbar(props: TableUndoToolbarProps): JSX.Element {
  return (
    <>
      <button
        type="button"
        data-iris-table-undo=""
        disabled={!props.canUndo()}
        onClick={props.onUndo}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: props.canUndo() ? 'pointer' : 'default',
          color: 'var(--iris-muted)',
          'font-size': 'var(--iris-font-size-md, 14px)',
        }}
        aria-label={props.t('table.undo')}
        title={props.t('table.undo')}
      >
        ↶
      </button>
      <button
        type="button"
        data-iris-table-redo=""
        disabled={!props.canRedo()}
        onClick={props.onRedo}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: props.canRedo() ? 'pointer' : 'default',
          color: 'var(--iris-muted)',
          'font-size': 'var(--iris-font-size-md, 14px)',
        }}
        aria-label={props.t('table.redo')}
        title={props.t('table.redo')}
      >
        ↷
      </button>
    </>
  )
}
