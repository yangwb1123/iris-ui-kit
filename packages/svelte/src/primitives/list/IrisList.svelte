<script lang="ts">
  import {
    createSelectionModel,
    createKeyboardNav,
    type KeyboardNavAction,
    type SelectionKey,
  } from '@iris-ui-kit/core'
  import { toStore } from '../../useStore'
  import { styleToString, mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  interface ListItem<T = unknown> {
    value: T
    label?: string
    disabled?: boolean
  }

  type ItemState = { selected: boolean; active: boolean; index: number }

  interface Props {
    items?: ListItem[]
    /** Selected value(s). For multi mode, pass an array. Controlled when set. */
    value?: unknown
    defaultValue?: unknown
    onValueChange?: (next: unknown) => void
    onSelect?: (item: ListItem) => void
    multi?: boolean
    /** Loop arrow nav at boundaries. Default true. */
    loop?: boolean
    ariaLabel?: string
    /** Show the loading state instead of items. */
    loading?: boolean
    /** Show the error state instead of items (takes precedence over loading). */
    error?: boolean
    style?: string
    emptyState?: import('svelte').Snippet
    loadingState?: import('svelte').Snippet
    errorState?: import('svelte').Snippet
    renderItem?: import('svelte').Snippet<[ListItem, ItemState]>
    /** Legacy: fallback content for the empty state. */
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let {
    items = [],
    value = undefined,
    defaultValue = undefined,
    onValueChange,
    onSelect,
    multi = false,
    loop = true,
    ariaLabel = undefined,
    loading = false,
    error = false,
    style,
    emptyState,
    loadingState,
    errorState,
    renderItem,
    children,
    ...rest
  }: Props = $props()

  const { t } = useI18n()

  // List values are generic; the selection model is keyed by string|number and
  // compares keys by identity — bridge T <-> key at this edge, mirroring React.
  const asKey = (v: unknown): SelectionKey => v as SelectionKey
  const toKeys = (v: unknown): SelectionKey[] =>
    v == null ? [] : Array.isArray(v) ? v.map(asKey) : [asKey(v)]
  const fromKeys = (keys: SelectionKey[]): unknown => (multi ? keys : (keys[0] ?? null))

  const isControlled = $derived(value !== undefined)

  // svelte-ignore state_referenced_locally — initial seed; controlled changes sync below.
  const model = createSelectionModel<SelectionKey>({
    mode: multi ? 'multiple' : 'single',
    defaultSelected: toKeys(value !== undefined ? value : defaultValue),
    onChange: (keys) => onValueChange?.(fromKeys(keys)),
  })
  const selectedKeys = toStore(model.store)

  // Controlled: mirror the prop into the model without re-emitting onValueChange.
  $effect(() => {
    if (isControlled) model.sync(toKeys(value))
  })

  // Controlled lists RENDER from the prop (true controlled semantics); a click
  // emits onValueChange but the selection only changes when the parent writes
  // `value` back. Uncontrolled lists render from the model store.
  const displaySelectedKeys = $derived(isControlled ? toKeys(value) : $selectedKeys)
  const isSelected = (v: unknown): boolean => displaySelectedKeys.includes(asKey(v))

  // Data-state precedence (error > loading > empty > content) mirrors core
  // resolveDataState / the React adapter.
  const dataState = $derived(
    error ? 'error' : loading ? 'loading' : items.length === 0 ? 'empty' : 'content',
  )
  const isContent = $derived(dataState === 'content')

  const isEnabled = (i: number): boolean => !items[i]?.disabled

  // Keyboard navigation (single-sourced in core controller)
  const nav = $derived.by(() =>
    createKeyboardNav({
      count: items.length,
      loop,
      isEnabled,
    }),
  )

  let activeIndex = $state(-1)
  let hoveredIndex = $state(-1)
  $effect(() => {
    activeIndex = nav.index
    const unsub = nav.store.subscribe((next) => {
      activeIndex = next
    })
    return unsub
  })

  let listEl = $state<HTMLElement | undefined>(undefined)

  function setList(node: HTMLElement): { destroy: () => void } {
    listEl = node
    return {
      destroy: () => {
        listEl = undefined
      },
    }
  }

  function focusAt(index: number): void {
    activeIndex = index
    listEl?.querySelector<HTMLElement>(`[data-iris-list-index="${index}"]`)?.focus()
  }

  function select(item: ListItem): void {
    if (item.disabled) return
    if (isControlled) model.sync(toKeys(value))
    if (multi) model.toggle(asKey(item.value))
    else model.set([asKey(item.value)])
    onSelect?.(item)
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (!isContent) return
    const action: KeyboardNavAction = nav.handleKeyDown({
      key: e.key,
      preventDefault: () => e.preventDefault(),
    })
    if (action.type === 'focus' || action.type === 'typeahead') {
      focusAt(action.target)
    } else if (action.type === 'select') {
      const it = items[action.target]
      if (it) select(it)
    }
  }

  const listStyle = $derived(
    styleToString({
      'list-style': 'none',
      margin: '0',
      padding: 'var(--iris-padding-sm)',
      display: 'flex',
      'flex-direction': 'column',
      gap: '2px',
      outline: 'none',
    }),
  )

  function itemStyle(
    selected: boolean,
    active: boolean,
    hovered: boolean,
    disabled?: boolean,
  ): string {
    return styleToString({
      display: 'flex',
      'align-items': 'center',
      gap: 'var(--iris-gap-sm)',
      padding: '6px var(--iris-padding-md)',
      'border-radius': 'var(--iris-radius-sm)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? '0.5' : '1',
      'font-size': '14px',
      background: selected
        ? 'var(--iris-primary)'
        : hovered
          ? 'var(--iris-surface-hover)'
          : active
            ? 'var(--iris-surface-hover)'
            : 'transparent',
      color: selected ? 'var(--iris-primary-foreground)' : 'var(--iris-foreground)',
      outline: 'none',
    })
  }
</script>

<ul
  {...rest}
  use:setList
  role="listbox"
  aria-label={ariaLabel}
  aria-multiselectable={multi ? 'true' : undefined}
  aria-busy={dataState === 'loading' ? 'true' : undefined}
  data-iris-list
  onkeydown={onKeyDown}
  style={mergeStyle(listStyle, style)}
>
  {#if !isContent}
    <li
      role="presentation"
      data-iris-list-state={dataState}
      aria-live="polite"
      style="list-style: none; padding: 12px; text-align: center; color: var(--iris-muted); font-size: 14px"
    >
      {#if dataState === 'error'}
        {#if errorState}{@render errorState()}{:else}{t('list.error')}{/if}
      {:else if dataState === 'loading'}
        {#if loadingState}{@render loadingState()}{:else}{t('list.loading')}{/if}
      {:else if emptyState}{@render emptyState()}
      {:else if children}{@render children()}
      {:else}{t('list.empty')}{/if}
    </li>
  {:else}
    {#each items as item, index (String(item.value ?? index))}
      {@const selected = isSelected(item.value)}
      {@const active = index === activeIndex}
      <li
        role="option"
        tabindex={active ? 0 : -1}
        aria-selected={selected ? 'true' : 'false'}
        aria-disabled={item.disabled ? 'true' : undefined}
        data-iris-list-index={index}
        data-iris-list-item
        data-state={selected ? 'selected' : active ? 'active' : 'idle'}
        onclick={() => select(item)}
        onkeydown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            select(item)
          }
        }}
        onfocus={() => {
          activeIndex = index
        }}
        onmouseenter={() => {
          hoveredIndex = index
        }}
        onmouseleave={() => {
          if (hoveredIndex === index) hoveredIndex = -1
        }}
        style={itemStyle(selected, active, hoveredIndex === index, item.disabled)}
      >
        {#if renderItem}{@render renderItem(item, { selected, active, index })}
        {:else}{item.label ?? String(item.value)}{/if}
      </li>
    {/each}
  {/if}
</ul>
