<script lang="ts">
  import {
    createVirtualizer,
    generateId,
    type Virtualizer,
    type VirtualizerState,
  } from '@iris-ui-kit/core'
  import { useI18n } from '../../i18n'

  export type IrisComboboxSize = 'sm' | 'md' | 'lg'

  export interface IrisComboboxOption {
    label: string
    value: string
    disabled?: boolean
  }

  interface Props {
    value?: string
    options?: IrisComboboxOption[]
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    size?: IrisComboboxSize
    emptyText?: string
    id?: string
    onValueChange?: (value: string) => void
    /**
     * Opt-in windowed rendering of the listbox via the core virtualizer.
     * When true, only the visible window (+ buffer) of options is rendered;
     * keyboard navigation scrolls the active option into view. Default false.
     */
    virtual?: boolean
    style?: string
    [key: string]: unknown
  }

  let {
    value = '',
    options = [],
    placeholder,
    disabled = false,
    invalid = false,
    size = 'md',
    emptyText,
    id,
    onValueChange,
    style,
    virtual = false,
    ...rest
  }: Props = $props()

  const { t } = useI18n()

  const baseId = generateId()
  const listboxId = `${baseId}-listbox`
  const optionId = (i: number) => `${baseId}-opt-${i}`

  let query = $state('')
  let filtering = $state(false)
  let open = $state(false)
  let activeIndex = $state(-1)
  let focused = $state(false)

  const selected = $derived(options.find((o) => o.value === value))
  const display = $derived(filtering ? query : (selected?.label ?? ''))
  const filtered = $derived(() => {
    const needle = query.trim().toLowerCase()
    return filtering && needle
      ? options.filter((o) => o.label.toLowerCase().startsWith(needle))
      : options
  })

  const SIZE_MAP: Record<
    IrisComboboxSize,
    { padding: string; fontSize: string; minHeight: string }
  > = {
    sm: {
      padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
      fontSize: 'var(--iris-font-size-xs, 12px)',
      minHeight: '28px',
    },
    md: {
      padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
      fontSize: 'var(--iris-font-size-md, 14px)',
      minHeight: '34px',
    },
    lg: {
      padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md, 12px)',
      fontSize: 'var(--iris-font-size-lg, 16px)',
      minHeight: '40px',
    },
  }
  /** Listbox maxHeight — the virtualizer's viewport (px). */
  const LISTBOX_MAX_HEIGHT = 240
  /** Fixed per-option row height (px) — mirrors SIZE_MAP minHeight (estimate, never measured). */
  const ROW_HEIGHT: Record<IrisComboboxSize, number> = { sm: 28, md: 34, lg: 40 }
  const sz = $derived(SIZE_MAP[size])

  // Virtualized listbox (opt-in): one controller per mount, built lazily in
  // the first effect; reactive inputs are read live through closures so the
  // instance (scroll offset + keyed cache) survives re-renders.
  let virtualizer: Virtualizer | null = $state(null)
  let unsub: (() => void) | null = null
  let vstate = $state<VirtualizerState>({
    items: [],
    offsetBefore: 0,
    totalSize: 0,
    startIndex: 0,
    endIndex: -1,
  })
  let listboxEl = $state<HTMLUListElement | undefined>(undefined)

  $effect(() => {
    if (!virtual) return
    if (!virtualizer) {
      virtualizer = createVirtualizer({
        count: 0,
        estimateSize: () => ROW_HEIGHT[size],
        getItemKey: (i) => filtered()[i]?.value ?? i,
        viewportSize: LISTBOX_MAX_HEIGHT,
        buffer: 4,
      })
      vstate = virtualizer.getState()
      unsub = virtualizer.subscribe((s) => {
        vstate = s
      })
    }
    // Count + scroll clamp: re-runs when the filtered list (or size) changes.
    virtualizer.setCount(filtered().length)
    const el = listboxEl
    if (el) {
      const max = Math.max(0, virtualizer.totalSize() - LISTBOX_MAX_HEIGHT)
      if (el.scrollTop > max) el.scrollTop = max
    }
  })
  $effect(() => () => {
    unsub?.()
    unsub = null
  })

  // Scroll the active option into view ('auto' semantics: no-op when already
  // fully inside the viewport). Estimates are constant and never measured, so
  // `start = index × rowHeight` is exact.
  function ensureVisible(index: number): void {
    if (!virtual || !virtualizer || index < 0 || index >= filtered().length) return
    const el = listboxEl
    if (!el) return
    const top = el.scrollTop
    const start = index * ROW_HEIGHT[size]
    if (start >= top && start + ROW_HEIGHT[size] <= top + LISTBOX_MAX_HEIGHT) return
    el.scrollTop = virtualizer.scrollToIndex(index, start < top ? 'start' : 'end')
  }

  function close(): void {
    open = false
    filtering = false
    activeIndex = -1
    virtualizer?.setScroll(0)
  }

  function selectOption(opt: IrisComboboxOption): void {
    if (opt.disabled) return
    onValueChange?.(opt.value)
    query = ''
    close()
  }

  function handleInput(e: Event): void {
    query = (e.target as HTMLInputElement).value
    filtering = true
    open = true
    activeIndex = 0
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (disabled) return
    const list = filtered()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        open = true
        filtering = false
        activeIndex = 0
        return
      }
      const next = Math.min(list.length - 1, activeIndex + 1)
      activeIndex = next
      ensureVisible(next)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (open) {
        const next = Math.max(0, activeIndex - 1)
        activeIndex = next
        ensureVisible(next)
      }
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && list[activeIndex]) {
        e.preventDefault()
        selectOption(list[activeIndex])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        close()
      }
    } else if (e.key === 'Home') {
      if (open) {
        e.preventDefault()
        activeIndex = 0
        ensureVisible(0)
      }
    } else if (e.key === 'End') {
      if (open) {
        e.preventDefault()
        const next = list.length - 1
        activeIndex = next
        ensureVisible(next)
      }
    }
  }

  const borderColor = $derived(
    invalid ? 'var(--iris-danger)' : focused ? 'var(--iris-primary)' : 'var(--iris-border)',
  )
  const activeId = $derived(
    open && activeIndex >= 0 && filtered()[activeIndex] ? optionId(activeIndex) : undefined,
  )
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->

<div
  {...rest}
  data-iris-combobox
  data-iris-combobox-size={size}
  data-state={open ? 'open' : 'closed'}
  style="position: relative; display: inline-block; min-width: 200px;{style ? ' ' + style : ''}"
>
  <input
    {id}
    type="text"
    role="combobox"
    autocomplete="off"
    spellcheck={false}
    value={display}
    {placeholder}
    disabled={disabled || undefined}
    aria-expanded={open ? 'true' : 'false'}
    aria-controls={listboxId}
    aria-autocomplete="list"
    aria-activedescendant={activeId}
    aria-invalid={invalid ? 'true' : undefined}
    data-iris-combobox-input
    oninput={handleInput}
    onkeydown={handleKeyDown}
    onfocus={() => {
      if (disabled) return
      focused = true
      open = true
      filtering = false
    }}
    onblur={() => {
      focused = false
      close()
    }}
    style="box-sizing: border-box; width: 100%; padding: {sz.padding}; min-height: {sz.minHeight}; font-size: {sz.fontSize}; font-family: inherit; color: var(--iris-foreground); background: var(--iris-background); border: 1px solid {borderColor}; border-radius: var(--iris-radius-md, 6px); outline: none; opacity: {disabled
      ? '0.6'
      : '1'}; box-shadow: {focused
      ? `0 0 0 3px ${invalid ? 'color-mix(in srgb, var(--iris-danger) 18%, transparent)' : 'color-mix(in srgb, var(--iris-primary) 18%, transparent)'}`
      : 'none'}; transition: border-color 120ms ease, box-shadow 120ms ease"
  />
  {#if open}
    <ul
      id={listboxId}
      bind:this={listboxEl}
      role="listbox"
      data-iris-combobox-listbox
      onscroll={(e) => {
        virtualizer?.setScroll(e.currentTarget.scrollTop)
      }}
      style="position: absolute; inset-inline-start: 0; inset-inline-end: 0; top: 100%; margin-block-start: 4px; max-height: 240px; overflow-y: auto; list-style: none; margin: 0; padding: 4px; z-index: 50; background: var(--iris-background); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); box-shadow: var(--iris-shadow-lg)"
    >
      {#if filtered().length === 0}
        <li
          role="presentation"
          data-iris-combobox-empty
          style="padding: var(--iris-space-xs, 8px) var(--iris-space-sm, 12px); color: var(--iris-muted); font-size: {sz.fontSize}"
        >
          {emptyText ?? t('combobox.empty')}
        </li>
      {:else if virtual && virtualizer}
        {@const list = filtered()}
        {@const row = ROW_HEIGHT[size]}
        <li
          role="presentation"
          aria-hidden="true"
          data-iris-combobox-spacer
          data-iris-combobox-spacer-type="top"
          style="height: {vstate.offsetBefore}px"
        ></li>
        {#each vstate.items as item (item.key)}
          {@const opt = list[item.index]}
          {#if opt}
            <li
              id={optionId(item.index)}
              role="option"
              aria-selected={opt.value === value ? 'true' : 'false'}
              aria-disabled={opt.disabled ? 'true' : undefined}
              aria-setsize={list.length}
              aria-posinset={item.index + 1}
              data-iris-combobox-option
              data-active={item.index === activeIndex ? 'true' : undefined}
              onmousedown={(event) => event.preventDefault()}
              onmouseenter={() => {
                activeIndex = item.index
              }}
              onclick={() => selectOption(opt)}
              onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  selectOption(opt)
                }
              }}
              style="padding: var(--iris-space-xs, 8px) var(--iris-space-sm, 12px); font-size: {sz.fontSize}; border-radius: var(--iris-radius-sm, 4px); cursor: {opt.disabled
                ? 'not-allowed'
                : 'pointer'}; color: {opt.disabled
                ? 'var(--iris-muted)'
                : 'var(--iris-foreground)'}; background: {item.index === activeIndex
                ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                : 'transparent'}; font-weight: {opt.value === value ? '600' : '400'}"
            >
              {opt.label}
            </li>
          {/if}
        {/each}
        <li
          role="presentation"
          aria-hidden="true"
          data-iris-combobox-spacer
          data-iris-combobox-spacer-type="bottom"
          style="height: {vstate.totalSize - vstate.offsetBefore - vstate.items.length * row}px"
        ></li>
      {:else}
        {#each filtered() as opt, i}
          <li
            id={optionId(i)}
            role="option"
            aria-selected={opt.value === value ? 'true' : 'false'}
            aria-disabled={opt.disabled ? 'true' : undefined}
            data-iris-combobox-option
            data-active={i === activeIndex ? 'true' : undefined}
            onmousedown={(event) => event.preventDefault()}
            onmouseenter={() => {
              activeIndex = i
            }}
            onclick={() => selectOption(opt)}
            onkeydown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                selectOption(opt)
              }
            }}
            style="padding: var(--iris-space-xs, 8px) var(--iris-space-sm, 12px); font-size: {sz.fontSize}; border-radius: var(--iris-radius-sm, 4px); cursor: {opt.disabled
              ? 'not-allowed'
              : 'pointer'}; color: {opt.disabled
              ? 'var(--iris-muted)'
              : 'var(--iris-foreground)'}; background: {i === activeIndex
              ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
              : 'transparent'}; font-weight: {opt.value === value ? '600' : '400'}"
          >
            {opt.label}
          </li>
        {/each}
      {/if}
    </ul>
  {/if}
</div>
