import { createSignal, createMemo, mergeProps, splitProps, Show, For, type JSX } from 'solid-js'

export interface IrisTransferItem {
  label: string
  value: string
  disabled?: boolean
}

export interface IrisTransferProps {
  options?: IrisTransferItem[]
  value?: string[]
  defaultValue?: string[]
  titles?: [string, string]
  searchable?: boolean
  disabled?: boolean
  onChange?: (values: string[]) => void
}

/**
 * Dual-list transfer: move items between available and selected panes.
 * Solid port of the Vue IrisTransfer.
 */
export function IrisTransfer(props: IrisTransferProps): JSX.Element {
  const merged = mergeProps(
    {
      options: [] as IrisTransferItem[],
      defaultValue: [] as string[],
      titles: ['Available', 'Selected'] as [string, string],
      searchable: false,
      disabled: false,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'options',
    'value',
    'defaultValue',
    'titles',
    'searchable',
    'disabled',
    'onChange',
  ])

  const [internalValue, setInternalValue] = createSignal<string[]>(local.defaultValue)
  const [sourceChecked, setSourceChecked] = createSignal<Set<string>>(new Set())
  const [targetChecked, setTargetChecked] = createSignal<Set<string>>(new Set())
  const [sourceQuery, setSourceQuery] = createSignal('')
  const [targetQuery, setTargetQuery] = createSignal('')

  const currentValue = (): string[] => local.value ?? internalValue()
  const valueSet = createMemo(() => new Set(currentValue()))

  const sourceItems = createMemo(() =>
    local.options.filter(
      (o) =>
        !valueSet().has(o.value) &&
        (!sourceQuery() || o.label.toLowerCase().includes(sourceQuery().toLowerCase())),
    ),
  )
  const targetItems = createMemo(() =>
    local.options.filter(
      (o) =>
        valueSet().has(o.value) &&
        (!targetQuery() || o.label.toLowerCase().includes(targetQuery().toLowerCase())),
    ),
  )

  const emitChange = (next: string[]) => {
    if (!local.value) setInternalValue(next)
    local.onChange?.(next)
  }

  const moveToTarget = () => {
    if (local.disabled) return
    const moving = sourceItems().filter((o) => !o.disabled && sourceChecked().has(o.value))
    if (moving.length === 0) return
    emitChange([...currentValue(), ...moving.map((o) => o.value)])
    setSourceChecked(new Set<string>())
  }

  const moveToSource = () => {
    if (local.disabled) return
    const removing = new Set(
      targetItems()
        .filter((o) => !o.disabled && targetChecked().has(o.value))
        .map((o) => o.value),
    )
    emitChange(currentValue().filter((v) => !removing.has(v)))
    setTargetChecked(new Set<string>())
  }

  const toggleCheck = (side: 'source' | 'target', value: string) => {
    if (side === 'source') {
      setSourceChecked((prev) => {
        const next = new Set(prev)
        if (next.has(value)) next.delete(value)
        else next.add(value)
        return next
      })
    } else {
      setTargetChecked((prev) => {
        const next = new Set(prev)
        if (next.has(value)) next.delete(value)
        else next.add(value)
        return next
      })
    }
  }

  const panelStyle: JSX.CSSProperties = {
    flex: '1',
    border: '1px solid var(--iris-border)',
    'border-radius': 'var(--iris-radius-md, 6px)',
    overflow: 'hidden',
    display: 'flex',
    'flex-direction': 'column',
    background: 'var(--iris-surface)',
    'min-width': '160px',
  }

  const renderPanel = (
    side: 'source' | 'target',
    items: () => IrisTransferItem[],
    checked: () => Set<string>,
    title: string,
    query: () => string,
    setQuery: (v: string) => void,
  ) => (
    <div data-iris-transfer-panel={side} style={panelStyle}>
      <div
        style={{
          padding: '8px 12px',
          'border-bottom': '1px solid var(--iris-border)',
          'font-size': '13px',
          'font-weight': '600',
          color: 'var(--iris-foreground)',
        }}
      >
        {title}
        <span style={{ float: 'right', 'font-weight': 'normal', color: 'var(--iris-muted)' }}>
          {checked().size}/{items().length}
        </span>
      </div>
      <Show when={local.searchable}>
        <div style={{ padding: '6px 8px', 'border-bottom': '1px solid var(--iris-border)' }}>
          <input
            type="text"
            placeholder="Search…"
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            style={{
              width: '100%',
              padding: '4px 8px',
              background: 'transparent',
              border: '1px solid var(--iris-border)',
              'border-radius': 'var(--iris-radius-sm, 4px)',
              'font-size': '13px',
              color: 'var(--iris-foreground)',
              'box-sizing': 'border-box',
              outline: 'none',
            }}
          />
        </div>
      </Show>
      <ul
        role="listbox"
        aria-multiselectable="true"
        style={{
          'list-style': 'none',
          margin: '0',
          padding: '4px',
          flex: '1',
          'overflow-y': 'auto',
          'max-height': '200px',
        }}
      >
        <For each={items()}>
          {(item) => (
            <li
              role="option"
              aria-selected={checked().has(item.value)}
              data-iris-transfer-item={`${side}-${item.value}`}
              style={{
                display: 'flex',
                'align-items': 'center',
                gap: '8px',
                padding: '6px 8px',
                'border-radius': 'var(--iris-radius-sm, 4px)',
                cursor: item.disabled || local.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? '0.5' : '1',
              }}
              onClick={() => {
                if (item.disabled || local.disabled) return
                toggleCheck(side, item.value)
              }}
            >
              <input
                type="checkbox"
                checked={checked().has(item.value)}
                disabled={item.disabled || local.disabled || undefined}
                onChange={() => {
                  if (!item.disabled && !local.disabled) toggleCheck(side, item.value)
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span style={{ 'font-size': '14px', color: 'var(--iris-foreground)' }}>
                {item.label}
              </span>
            </li>
          )}
        </For>
      </ul>
    </div>
  )

  const btnStyle: JSX.CSSProperties = {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '28px',
    height: '28px',
    padding: '0',
    background: 'var(--iris-primary)',
    color: 'var(--iris-primary-foreground, #fff)',
    border: 'none',
    'border-radius': 'var(--iris-radius-sm, 4px)',
    cursor: 'pointer',
    'font-size': '14px',
  }

  return (
    <div
      data-iris-transfer=""
      data-disabled={local.disabled ? '' : undefined}
      style={{ display: 'flex', gap: '12px', 'align-items': 'stretch' }}
    >
      {renderPanel(
        'source',
        sourceItems,
        sourceChecked,
        local.titles[0],
        sourceQuery,
        setSourceQuery,
      )}

      <div
        style={{
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'justify-content': 'center',
          gap: '8px',
        }}
      >
        <button
          type="button"
          data-iris-transfer-move-right=""
          disabled={local.disabled || sourceChecked().size === 0 || undefined}
          onClick={moveToTarget}
          title="Move to selected"
          style={{ ...btnStyle, opacity: sourceChecked().size === 0 ? '0.4' : '1' }}
        >
          ›
        </button>
        <button
          type="button"
          data-iris-transfer-move-left=""
          disabled={local.disabled || targetChecked().size === 0 || undefined}
          onClick={moveToSource}
          title="Move to available"
          style={{ ...btnStyle, opacity: targetChecked().size === 0 ? '0.4' : '1' }}
        >
          ‹
        </button>
      </div>

      {renderPanel(
        'target',
        targetItems,
        targetChecked,
        local.titles[1],
        targetQuery,
        setTargetQuery,
      )}
    </div>
  )
}
