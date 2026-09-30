import { resolveColumnWidth } from '@iris-ui-kit/core'
import { clampWidth, TABLE_CONST } from './tableUtils'
import type { IrisTableColumn, IrisTableColumnWidths } from './types'

export function createTableResizeHandleController(options: {
  handleElements: Record<string, HTMLElement | undefined>
  getWidths: () => IrisTableColumnWidths
  setColumnWidth: (key: string, width: number) => void
}): {
  register: (node: HTMLElement, key: string) => { destroy: () => void }
  onKeydown: (event: KeyboardEvent, column: IrisTableColumn) => void
} {
  const register = (node: HTMLElement, key: string): { destroy: () => void } => {
    options.handleElements[key] = node
    return {
      destroy: () => {
        options.handleElements[key] = undefined
      },
    }
  }

  const onKeydown = (event: KeyboardEvent, column: IrisTableColumn): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    const current = resolveColumnWidth(column, options.getWidths())
    const delta = event.key === 'ArrowRight' ? TABLE_CONST.RESIZE_STEP : -TABLE_CONST.RESIZE_STEP
    options.setColumnWidth(column.key, clampWidth(column, current + delta))
  }

  return { register, onKeydown }
}
