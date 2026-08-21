<script lang="ts">
  import type { VirtualizerState } from '@iris-ui-kit/core'

  export interface IrisSelectItem {
    label?: string
    value: unknown
    disabled?: boolean
  }

  interface Props {
    items: IrisSelectItem[]
    currentValue: unknown
    multiple: boolean
    selectedValues: string[]
    virtual: boolean
    virtualizerReady: boolean
    vstate: VirtualizerState
    rowHeight: number
    fontSize: string
    emptyLabel: string
    selectItem: (item: IrisSelectItem) => void
  }

  let {
    items,
    currentValue,
    multiple,
    selectedValues,
    virtual,
    virtualizerReady,
    vstate,
    rowHeight,
    fontSize,
    emptyLabel,
    selectItem,
  }: Props = $props()
</script>

{#if items.length === 0}
  <li
    data-iris-select-empty=""
    style="padding: var(--iris-space-xs, 8px) var(--iris-padding-sm, 6px); color: var(--iris-muted); font-size: var(--iris-font-size-sm, 13px); text-align: center; list-style: none"
  >
    {emptyLabel}
  </li>
{:else if virtual && virtualizerReady}
  <li
    role="presentation"
    aria-hidden="true"
    data-iris-select-spacer
    data-iris-select-spacer-type="top"
    style="height: {vstate.offsetBefore}px"
  ></li>
  {#each vstate.items as windowItem (windowItem.key)}
    {@const item = items[windowItem.index]}
    {#if item}
      <li
        role="option"
        aria-selected={multiple
          ? selectedValues.includes(item.value as string)
          : item.value === currentValue
            ? 'true'
            : 'false'}
        aria-disabled={item.disabled ? 'true' : undefined}
        aria-setsize={items.length}
        aria-posinset={windowItem.index + 1}
        data-iris-select-option
        data-iris-select-option-index={windowItem.index}
        onclick={() => selectItem(item)}
        onkeydown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            selectItem(item)
          }
        }}
        tabindex={item.disabled ? -1 : 0}
        style="display: flex; align-items: center; gap: var(--iris-gap-sm, 6px); padding: var(--iris-space-xs, 8px) var(--iris-space-sm, 12px); font-size: {fontSize}; border-radius: var(--iris-radius-sm, 4px); cursor: {item.disabled
          ? 'not-allowed'
          : 'pointer'}; color: {item.disabled
          ? 'var(--iris-muted)'
          : 'var(--iris-foreground)'}; background: {item.value === currentValue
          ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
          : 'transparent'}; font-weight: {item.value === currentValue ? '600' : '400'}"
      >
        <span style="flex: 1; min-width: 0">{item.label ?? String(item.value)}</span>
        {#if item.value === currentValue}
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
        {/if}
      </li>
    {/if}
  {/each}
  <li
    role="presentation"
    aria-hidden="true"
    data-iris-select-spacer
    data-iris-select-spacer-type="bottom"
    style="height: {vstate.totalSize - vstate.offsetBefore - vstate.items.length * rowHeight}px"
  ></li>
{:else}
  {#each items as item}
    <li
      role="option"
      aria-selected={item.value === currentValue ? 'true' : 'false'}
      aria-disabled={item.disabled ? 'true' : undefined}
      data-iris-select-option
      onclick={() => selectItem(item)}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          selectItem(item)
        }
      }}
      tabindex={item.disabled ? -1 : 0}
      style="display: flex; align-items: center; gap: var(--iris-gap-sm, 6px); padding: var(--iris-space-xs, 8px) var(--iris-space-sm, 12px); font-size: {fontSize}; border-radius: var(--iris-radius-sm, 4px); cursor: {item.disabled
        ? 'not-allowed'
        : 'pointer'}; color: {item.disabled
        ? 'var(--iris-muted)'
        : 'var(--iris-foreground)'}; background: {item.value === currentValue
        ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
        : 'transparent'}; font-weight: {item.value === currentValue ? '600' : '400'}"
    >
      <span style="flex: 1; min-width: 0">{item.label ?? String(item.value)}</span>
      {#if item.value === currentValue}
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
      {/if}
    </li>
  {/each}
{/if}
