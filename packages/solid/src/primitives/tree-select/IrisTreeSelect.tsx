import { createSignal, createMemo, mergeProps, splitProps, Show, type JSX } from 'solid-js'
import { IrisTree, type IrisTreeNode, type IrisTreeSelectionMode } from '../tree/IrisTree'
import { useI18n } from '../../i18n'

function findNode(nodes: IrisTreeNode[], id: string): IrisTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return undefined
}

export interface IrisTreeSelectProps {
  nodes?: IrisTreeNode[]
  value?: string[]
  defaultValue?: string[]
  selectionMode?: IrisTreeSelectionMode
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  onChange?: (ids: string[]) => void
  id?: string
}

/**
 * TreeSelect: an IrisTree embedded in a floating Select panel.
 * Solid port of the Vue IrisTreeSelect.
 */
export function IrisTreeSelect(props: IrisTreeSelectProps): JSX.Element {
  const { t } = useI18n()
  const merged = mergeProps(
    {
      nodes: [] as IrisTreeNode[],
      defaultValue: [] as string[],
      selectionMode: 'single' as IrisTreeSelectionMode,
      disabled: false,
      invalid: false,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'nodes',
    'value',
    'defaultValue',
    'selectionMode',
    'placeholder',
    'disabled',
    'invalid',
    'onChange',
    'id',
  ])

  const [internalValue, setInternalValue] = createSignal<string[]>(local.defaultValue)
  const [open, setOpen] = createSignal(false)

  const currentValue = () => (local.value !== undefined ? local.value : internalValue())

  const displayLabel = createMemo(() => {
    const ids = currentValue()
    if (ids.length === 0) return ''
    const labels = ids.map((id) => findNode(local.nodes, id)?.label ?? id)
    return labels.join(', ')
  })

  const onSelect = (ids: string[]) => {
    if (local.value === undefined) setInternalValue(ids)
    local.onChange?.(ids)
    if (local.selectionMode === 'single' && ids.length > 0) {
      setOpen(false)
    }
  }

  return (
    <div data-iris-tree-select="" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        id={local.id}
        type="button"
        data-iris-tree-select-trigger=""
        data-state={open() ? 'open' : 'closed'}
        disabled={local.disabled || undefined}
        aria-invalid={local.invalid ? 'true' : undefined}
        aria-expanded={open()}
        aria-haspopup="tree"
        onClick={() => !local.disabled && setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          'align-items': 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--iris-surface)',
          border: `1px solid ${local.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
          'border-radius': 'var(--iris-radius-md, 6px)',
          color: displayLabel() ? 'var(--iris-foreground)' : 'var(--iris-muted)',
          'font-size': '14px',
          'font-family': 'inherit',
          cursor: local.disabled ? 'not-allowed' : 'pointer',
          'min-width': '160px',
        }}
      >
        <span style={{ flex: '1', 'text-align': 'start' }}>
          {displayLabel() || local.placeholder || t('select.placeholder')}
        </span>
        <span aria-hidden="true">▾</span>
      </button>

      <Show when={open()}>
        <div
          data-iris-tree-select-panel=""
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            'z-index': '100',
            'margin-top': '4px',
            background: 'var(--iris-surface)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            'box-shadow': '0 4px 16px rgba(0,0,0,0.12)',
            padding: '8px',
            'min-width': '200px',
            'max-height': '300px',
            'overflow-y': 'auto',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <IrisTree
            nodes={local.nodes}
            selectedIds={currentValue()}
            selectionMode={local.selectionMode}
            onSelect={onSelect}
          />
        </div>
      </Show>
    </div>
  )
}
