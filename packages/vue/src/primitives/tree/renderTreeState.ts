import { h, type Slots, type VNode } from 'vue'

const TREE_STATE_STYLE: Record<string, string> = {
  padding: 'var(--iris-space-sm, 12px)',
  textAlign: 'center',
  color: 'var(--iris-muted)',
  fontSize: 'var(--iris-font-size-md, 14px)',
}

export type TreeState = 'error' | 'loading' | 'empty'

export function renderTreeState({
  state,
  stateKey,
  stateProps,
  slots,
  translate,
}: {
  state: TreeState
  stateKey: string
  stateProps: Record<string, unknown>
  slots: Slots
  translate: (key: string) => string
}): VNode {
  const content =
    state === 'error'
      ? slots.error
        ? slots.error()
        : translate('tree.error')
      : state === 'loading'
        ? slots.loading
          ? slots.loading()
          : translate('tree.loading')
        : slots.empty
          ? slots.empty()
          : translate('tree.empty')
  return h(
    'div',
    {
      key: stateKey,
      role: 'presentation',
      'data-iris-tree-state': state,
      'aria-live': 'polite',
      ...stateProps,
      style: TREE_STATE_STYLE,
    },
    content,
  )
}
