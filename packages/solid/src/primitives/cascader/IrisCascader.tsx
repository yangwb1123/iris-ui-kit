import {
  createSignal,
  createMemo,
  mergeProps,
  splitProps,
  Show,
  For,
  onCleanup,
  type JSX,
} from 'solid-js'

export interface IrisCascaderNode {
  label: string
  value: string
  disabled?: boolean
  children?: IrisCascaderNode[]
}

function pathLabels(options: IrisCascaderNode[], path: string[]): string[] {
  const labels: string[] = []
  let level = options
  for (const v of path) {
    const node = level.find((n) => n.value === v)
    if (!node) break
    labels.push(node.label)
    level = node.children ?? []
  }
  return labels
}

function buildColumns(options: IrisCascaderNode[], activePath: string[]): IrisCascaderNode[][] {
  const cols: IrisCascaderNode[][] = [options]
  let level = options
  for (const v of activePath) {
    const node = level.find((n) => n.value === v)
    if (!node || !node.children || node.children.length === 0) break
    level = node.children
    cols.push(level)
  }
  return cols
}

export interface IrisCascaderProps {
  options?: IrisCascaderNode[]
  value?: string[]
  defaultValue?: string[]
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  separator?: string
  onChange?: (path: string[]) => void
  id?: string
}

/**
 * Cascader: hierarchical multi-level select. Click a branch to drill down;
 * click a leaf to commit the full path.
 * Solid port of the Vue IrisCascader.
 */
export function IrisCascader(props: IrisCascaderProps): JSX.Element {
  const merged = mergeProps(
    {
      options: [] as IrisCascaderNode[],
      defaultValue: [] as string[],
      disabled: false,
      invalid: false,
      separator: ' / ',
    },
    props,
  )
  const [local] = splitProps(merged, [
    'options',
    'value',
    'defaultValue',
    'placeholder',
    'disabled',
    'invalid',
    'separator',
    'onChange',
    'id',
  ])

  const [internalValue, setInternalValue] = createSignal<string[]>(local.defaultValue)
  const [open, setOpen] = createSignal(false)
  const [activePath, setActivePath] = createSignal<string[]>([])

  const currentValue = () => (local.value !== undefined ? local.value : internalValue())

  const displayLabel = createMemo(() => {
    const labels = pathLabels(local.options, currentValue())
    return labels.length > 0 ? labels.join(local.separator) : ''
  })

  const columns = createMemo(() => buildColumns(local.options, activePath()))

  const onTriggerClick = () => {
    if (local.disabled) return
    const next = !open()
    setOpen(next)
    if (next) setActivePath([...currentValue()])
  }

  const onOptionClick = (colIdx: number, node: IrisCascaderNode) => {
    if (node.disabled) return
    const newPath = [...activePath().slice(0, colIdx), node.value]
    setActivePath(newPath)
    const isLeaf = !node.children || node.children.length === 0
    if (isLeaf) {
      if (local.value === undefined) setInternalValue(newPath)
      local.onChange?.(newPath)
      setOpen(false)
    }
  }

  // Close on click outside
  const onDocClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('[data-iris-cascader]')) {
      setOpen(false)
    }
  }
  document.addEventListener('click', onDocClick)
  onCleanup(() => document.removeEventListener('click', onDocClick))

  return (
    <div
      data-iris-cascader=""
      data-disabled={local.disabled ? '' : undefined}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        id={local.id}
        type="button"
        data-iris-cascader-trigger=""
        data-state={open() ? 'open' : 'closed'}
        disabled={local.disabled || undefined}
        aria-invalid={local.invalid ? 'true' : undefined}
        aria-expanded={open()}
        onClick={onTriggerClick}
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
          {displayLabel() || local.placeholder || 'Select…'}
        </span>
        <span aria-hidden="true">▾</span>
      </button>

      <Show when={open()}>
        <div
          data-iris-cascader-dropdown=""
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            'z-index': '100',
            'margin-top': '4px',
            display: 'flex',
            background: 'var(--iris-surface)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            'box-shadow': '0 4px 16px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          <For each={columns()}>
            {(col, colIdx) => (
              <ul
                data-iris-cascader-column={colIdx()}
                role="listbox"
                style={{
                  'list-style': 'none',
                  margin: '0',
                  padding: '4px',
                  'min-width': '140px',
                  'max-height': '240px',
                  'overflow-y': 'auto',
                  'border-right':
                    colIdx() < columns().length - 1 ? '1px solid var(--iris-border)' : 'none',
                }}
              >
                <For each={col}>
                  {(node) => {
                    const isActive = () => activePath()[colIdx()] === node.value
                    const hasChildren = () => (node.children?.length ?? 0) > 0
                    return (
                      <li
                        role="option"
                        aria-selected={isActive()}
                        data-iris-cascader-option={node.value}
                        onClick={() => onOptionClick(colIdx(), node)}
                        style={{
                          display: 'flex',
                          'align-items': 'center',
                          'justify-content': 'space-between',
                          padding: '7px 10px',
                          'border-radius': 'var(--iris-radius-sm, 4px)',
                          cursor: node.disabled ? 'not-allowed' : 'pointer',
                          background: isActive() ? 'var(--iris-primary)' : 'transparent',
                          color: isActive()
                            ? 'var(--iris-primary-foreground, #fff)'
                            : node.disabled
                              ? 'var(--iris-muted)'
                              : 'var(--iris-foreground)',
                          opacity: node.disabled ? '0.5' : '1',
                          'font-size': '14px',
                        }}
                      >
                        <span>{node.label}</span>
                        <Show when={hasChildren()}>
                          <span aria-hidden="true" style={{ 'margin-left': '8px', opacity: '0.6' }}>
                            ›
                          </span>
                        </Show>
                      </li>
                    )
                  }}
                </For>
              </ul>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
