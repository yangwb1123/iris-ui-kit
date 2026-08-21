import { Show, type Accessor, type JSX } from 'solid-js'
import type { IrisSelectItem } from './IrisSelect'

export interface IrisSelectOptionProps<T> {
  item: IrisSelectItem<T>
  index: number
  active: Accessor<boolean>
  selected: Accessor<boolean>
  fontSize: Accessor<string>
  itemCount?: Accessor<number>
  onFocus: () => void
  onSelect: () => void
}

export function SelectOption<T>({
  item,
  index,
  active,
  selected,
  fontSize,
  itemCount,
  onFocus,
  onSelect,
}: IrisSelectOptionProps<T>): JSX.Element {
  return (
    <div
      role="option"
      aria-selected={selected() ? 'true' : 'false'}
      aria-disabled={item.disabled ? 'true' : undefined}
      aria-setsize={itemCount?.()}
      aria-posinset={itemCount ? index + 1 : undefined}
      data-iris-select-option=""
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={() => !item.disabled && onFocus()}
      onClick={onSelect}
      style={{
        padding: 'var(--iris-padding-sm, 6px) var(--iris-space-sm, 12px)',
        'font-size': fontSize(),
        'border-radius': 'var(--iris-radius-sm, 4px)',
        cursor: item.disabled ? 'not-allowed' : 'pointer',
        color: item.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
        background: selected()
          ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
          : active()
            ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
            : 'transparent',
        'font-weight': selected() ? '600' : '400',
      }}
    >
      <span style={{ flex: '1', 'min-width': '0' }}>{item.label ?? String(item.value)}</span>
      <Show when={selected()}>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--iris-primary)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </Show>
    </div>
  )
}
