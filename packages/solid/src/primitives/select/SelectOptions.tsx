import { For, Show, type Accessor, type JSX } from 'solid-js'
import type { VirtualizerState } from '@iris-ui-kit/core'
import { SelectOption } from './SelectOption'
import type { IrisSelectItem } from './IrisSelect'

export interface SelectWindowItem<T> {
  opt: IrisSelectItem<T>
  index: number
  key: string | number
}

export interface SelectOptionsProps<T> {
  items: Accessor<IrisSelectItem<T>[]>
  multiple: boolean
  currentValue: Accessor<T | undefined>
  selectedValues: Accessor<T[]>
  activeIndex: Accessor<number>
  fontSize: Accessor<string>
  virtual: Accessor<boolean>
  virtualState: Accessor<VirtualizerState>
  windowed: Accessor<SelectWindowItem<T>[]>
  rowHeight: number
  emptyLabel: string
  onFocus(index: number): void
  onSelect(item: IrisSelectItem<T>): void
}

/** Shared option window for the virtual and full Solid select paths. */
export function SelectOptions<T>(props: SelectOptionsProps<T>): JSX.Element {
  return (
    <>
      <Show when={props.items().length === 0}>
        <div
          data-iris-select-empty=""
          style={{
            padding: 'var(--iris-space-xs, 8px) var(--iris-padding-sm, 6px)',
            color: 'var(--iris-muted)',
            'font-size': 'var(--iris-font-size-sm, 13px)',
            'text-align': 'center',
          }}
        >
          {props.emptyLabel}
        </div>
      </Show>
      <Show
        when={props.virtual() && props.items().length > 0}
        fallback={
          <For each={props.items()}>
            {(item, index) => (
              <SelectOption
                item={item}
                index={index()}
                active={() => index() === props.activeIndex()}
                selected={() =>
                  props.multiple
                    ? props.selectedValues().includes(item.value)
                    : item.value === props.currentValue()
                }
                fontSize={props.fontSize}
                onFocus={() => props.onFocus(index())}
                onSelect={() => props.onSelect(item)}
              />
            )}
          </For>
        }
      >
        <div
          role="presentation"
          aria-hidden="true"
          data-iris-select-spacer=""
          data-iris-select-spacer-type="top"
          style={{ height: `${props.virtualState().offsetBefore}px` }}
        />
        <For each={props.windowed()}>
          {(item) => (
            <SelectOption
              item={item.opt}
              index={item.index}
              active={() => item.index === props.activeIndex()}
              selected={() => item.opt.value === props.currentValue()}
              fontSize={props.fontSize}
              itemCount={() => props.items().length}
              onFocus={() => props.onFocus(item.index)}
              onSelect={() => props.onSelect(item.opt)}
            />
          )}
        </For>
        <div
          role="presentation"
          aria-hidden="true"
          data-iris-select-spacer=""
          data-iris-select-spacer-type="bottom"
          style={{
            height: `${
              props.virtualState().totalSize -
              props.virtualState().offsetBefore -
              props.virtualState().items.length * props.rowHeight
            }px`,
          }}
        />
      </Show>
    </>
  )
}
