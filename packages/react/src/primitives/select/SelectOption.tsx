import * as React from 'react'
import type { IrisSelectItem } from './types'

export interface IrisSelectOptionProps<T> {
  item: IrisSelectItem<T>
  index: number
  windowed: boolean
  itemCount: number
  multiple: boolean
  selectedValues: T[]
  value: T | T[] | undefined
  activeIndex: number
  hoveredIndex: number
  onSelect: (item: IrisSelectItem<T>) => void
  onFocus: (index: number) => void
  onMouseEnter: (index: number) => void
  onMouseLeave: (index: number) => void
}

export function SelectOption<T>({
  item,
  index,
  windowed,
  itemCount,
  multiple,
  selectedValues,
  value,
  activeIndex,
  hoveredIndex,
  onSelect,
  onFocus,
  onMouseEnter,
  onMouseLeave,
}: IrisSelectOptionProps<T>): React.ReactElement {
  const isSelected = multiple ? selectedValues.includes(item.value) : item.value === value
  const isActive = index === activeIndex
  return (
    <li
      key={String(item.value ?? index)}
      role="option"
      tabIndex={isActive ? 0 : -1}
      aria-selected={isSelected}
      aria-disabled={item.disabled ? 'true' : undefined}
      aria-setsize={windowed ? itemCount : undefined}
      aria-posinset={windowed ? index + 1 : undefined}
      data-iris-select-option=""
      data-iris-select-option-index={index}
      data-state={isSelected ? 'selected' : isActive ? 'active' : 'idle'}
      onClick={item.disabled ? undefined : () => onSelect(item)}
      onFocus={() => onFocus(index)}
      onMouseEnter={() => onMouseEnter(index)}
      onMouseLeave={() => onMouseLeave(index)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--iris-gap-sm, 6px)',
        padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
        borderRadius: 'var(--iris-radius-sm, 4px)',
        cursor: item.disabled ? 'not-allowed' : 'pointer',
        opacity: item.disabled ? 0.5 : 1,
        fontSize: 'var(--iris-font-size-md, 14px)',
        background: isSelected
          ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
          : hoveredIndex === index || isActive
            ? 'var(--iris-surface-hover)'
            : 'transparent',
        color: 'var(--iris-foreground)',
        fontWeight: isSelected ? 600 : 400,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{item.label ?? String(item.value)}</span>
      {isSelected ? (
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--iris-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : null}
    </li>
  )
}
