import * as React from 'react'
import { type VirtualizerState } from '@iris-ui-kit/core'
import type { IrisSelectItem } from './types'
import { SelectOption } from './SelectOption'

export interface SelectListboxProps<T> {
  items: IrisSelectItem<T>[]
  value: T | T[] | undefined
  multiple: boolean
  selectedValues: T[]
  activeIndex: number
  hoveredIndex: number
  virtual: boolean
  virtualState: VirtualizerState
  rowHeight: number
  listRef: React.RefObject<HTMLUListElement>
  ariaLabel: string
  emptyLabel: string
  onKeyDown: (event: React.KeyboardEvent<HTMLUListElement>) => void
  onScroll: (event: React.UIEvent<HTMLUListElement>) => void
  onSelect: (item: IrisSelectItem<T>) => void
  onFocus: (index: number) => void
  onMouseEnter: (index: number) => void
  onMouseLeave: (index: number) => void
}

/** Render the listbox and its virtual/non-virtual option windows. */
export function SelectListbox<T>({
  items,
  value,
  multiple,
  selectedValues,
  activeIndex,
  hoveredIndex,
  virtual,
  virtualState,
  rowHeight,
  listRef,
  ariaLabel,
  emptyLabel,
  onKeyDown,
  onScroll,
  onSelect,
  onFocus,
  onMouseEnter,
  onMouseLeave,
}: SelectListboxProps<T>): React.ReactElement {
  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label={ariaLabel}
      data-iris-select-listbox=""
      onKeyDown={onKeyDown}
      onScroll={onScroll}
      tabIndex={-1}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        ...(virtual ? {} : { gap: 'var(--iris-space-xxs, 4px)' }),
        maxHeight: 240,
        overflowY: 'auto',
      }}
    >
      {items.length === 0 ? (
        <li
          data-iris-select-empty=""
          style={{
            padding: 'var(--iris-space-xs, 8px) var(--iris-padding-sm, 6px)',
            color: 'var(--iris-muted)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            textAlign: 'center',
          }}
        >
          {emptyLabel}
        </li>
      ) : virtual ? (
        <>
          <li
            role="presentation"
            aria-hidden="true"
            data-iris-select-spacer=""
            data-iris-select-spacer-type="top"
            style={{ height: virtualState.offsetBefore }}
          />
          {virtualState.items.map((windowItem) => {
            const item = items[windowItem.index]
            if (!item) return null
            return (
              <SelectOption
                key={String(item.value ?? windowItem.index)}
                item={item}
                index={windowItem.index}
                windowed
                itemCount={items.length}
                multiple={multiple}
                selectedValues={selectedValues}
                value={value}
                activeIndex={activeIndex}
                hoveredIndex={hoveredIndex}
                onSelect={onSelect}
                onFocus={onFocus}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
              />
            )
          })}
          <li
            role="presentation"
            aria-hidden="true"
            data-iris-select-spacer=""
            data-iris-select-spacer-type="bottom"
            style={{
              height:
                virtualState.totalSize -
                virtualState.offsetBefore -
                virtualState.items.length * rowHeight,
            }}
          />
        </>
      ) : (
        items.map((item, index) => (
          <SelectOption
            key={String(item.value ?? index)}
            item={item}
            index={index}
            windowed={false}
            itemCount={items.length}
            multiple={multiple}
            selectedValues={selectedValues}
            value={value}
            activeIndex={activeIndex}
            hoveredIndex={hoveredIndex}
            onSelect={onSelect}
            onFocus={onFocus}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          />
        ))
      )}
    </ul>
  )
}
