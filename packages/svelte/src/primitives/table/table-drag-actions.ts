export interface TableColumnDragActionParams {
  key: string
  enabled: boolean
  active: boolean
  over: boolean
  onPointerDown: (event: PointerEvent, key: string) => void
}

function syncColumnDragAttrs(node: HTMLElement, params: TableColumnDragActionParams): void {
  if (params.enabled) node.setAttribute('data-iris-table-header-drag-target', params.key)
  else node.removeAttribute('data-iris-table-header-drag-target')
  if (params.active) node.setAttribute('data-iris-col-drag-active', 'true')
  else node.removeAttribute('data-iris-col-drag-active')
  if (params.over) node.setAttribute('data-iris-col-drag-over', 'true')
  else node.removeAttribute('data-iris-col-drag-over')
}

export function tableColumnDrag(
  node: HTMLElement,
  initial: TableColumnDragActionParams,
): { update: (next: TableColumnDragActionParams) => void; destroy: () => void } {
  let params = initial
  const handlePointerDown = (event: PointerEvent): void => {
    if (params.enabled) params.onPointerDown(event, params.key)
  }
  node.addEventListener('pointerdown', handlePointerDown)
  syncColumnDragAttrs(node, params)
  return {
    update(next) {
      params = next
      syncColumnDragAttrs(node, params)
    },
    destroy() {
      node.removeEventListener('pointerdown', handlePointerDown)
    },
  }
}
