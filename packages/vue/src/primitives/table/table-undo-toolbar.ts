import { h, type VNode } from 'vue'
import type { UseI18nReturn } from '../../i18n'
import type { TableUndoController } from './table-undo'

type Translate = UseI18nReturn['t']

/** Render-only context for the built-in undo/redo toolbar controls. */
export interface TableUndoToolbarContext {
  enabled: boolean
  controller: Pick<TableUndoController, 'canUndo' | 'canRedo' | 'undo' | 'redo'>
  t: Translate
}

const undoButtonStyle = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--iris-muted)',
  fontSize: 'var(--iris-font-size-md, 14px)',
}

const undoButton = (
  dataAttr: string,
  labelKey: string,
  active: boolean,
  onActivate: () => void,
  t: Translate,
): VNode =>
  h(
    'button',
    {
      type: 'button',
      [dataAttr]: '',
      onClick: onActivate,
      disabled: !active,
      'aria-label': t(labelKey),
      title: t(labelKey),
      style: { ...undoButtonStyle, cursor: active ? 'pointer' : 'default' },
    },
    dataAttr === 'data-iris-table-undo' ? '↶' : '↷',
  )

/** Token-only undo/redo controls, shared by the Vue table toolbar builder. */
export function renderUndoToolbar(ctx: TableUndoToolbarContext): VNode[] {
  if (!ctx.enabled) return []
  const canUndo = ctx.controller.canUndo.value
  const canRedo = ctx.controller.canRedo.value
  return [
    undoButton('data-iris-table-undo', 'table.undo', canUndo, ctx.controller.undo, ctx.t),
    undoButton('data-iris-table-redo', 'table.redo', canRedo, ctx.controller.redo, ctx.t),
  ]
}
