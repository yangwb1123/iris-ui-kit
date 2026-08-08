<script lang="ts">
  import {
    generateId,
    createKeyboardNav,
    createVirtualizer,
    type KeyboardNavAction,
    type Virtualizer,
    type VirtualizerState,
  } from '@iris-ui-kit/core'
  import { useFloating } from '../../floating/useFloating.svelte'
  import { useDismiss } from '../../floating/useDismiss.svelte'
  import { portal } from '../../internal/portal'
  import { useI18n } from '../../i18n'
  import type { Placement } from '@iris-ui-kit/core'

  export interface IrisSelectItem<T = unknown> {
    label?: string
    value: T
    disabled?: boolean
  }

  export type IrisSelectSize = 'sm' | 'md' | 'lg'

  export interface IrisSelectProps {
    items: IrisSelectItem[]
    value?: unknown
    defaultValue?: unknown
    placeholder?: string
    size?: IrisSelectSize
    disabled?: boolean
    placement?: Placement
    invalid?: boolean
    id?: string
    ariaDescribedby?: string
    /** Pass `false` to render the dropdown list inline (no portal). */
    portalTarget?: HTMLElement | false
    onValueChange?: (value: unknown) => void
    style?: string
    /**
     * Opt-in windowed rendering of the listbox via the core virtualizer.
     * When true, only the visible window (+ buffer) of options is rendered;
     * keyboard navigation scrolls the active option into view. Default false.
     */
    virtual?: boolean
    [key: string]: unknown
  }

  let {
    items,
    value = $bindable(),
    defaultValue,
    placeholder,
    size = 'md',
    disabled = false,
    placement = 'bottom-start',
    invalid = false,
    id,
    ariaDescribedby,
    portalTarget,
    onValueChange,
    style,
    virtual = false,
    ...rest
  }: IrisSelectProps = $props()

  const { t } = useI18n()

  const baseId = generateId()
  const listboxId = `${baseId}-listbox`

  const isControlled = $derived(value !== undefined)
  // svelte-ignore state_referenced_locally — `defaultValue` is an initial seed.
  let internalValue = $state(defaultValue)
  const currentValue = $derived(isControlled ? value : internalValue)

  let open = $state(false)
  let triggerEl = $state<HTMLElement | undefined>(undefined)
  let contentEl = $state<HTMLElement | undefined>(undefined)
  let listboxEl = $state<HTMLUListElement | undefined>(undefined)

  const selectedItem = $derived(items.find((item) => item.value === currentValue) ?? null)
  const triggerLabel = $derived(
    selectedItem
      ? (selectedItem.label ?? String(selectedItem.value))
      : (placeholder ?? t('select.placeholder')),
  )

  const SIZE_MAP: Record<IrisSelectSize, { padding: string; fontSize: string; minHeight: string }> =
    {
      sm: {
        padding:
          'var(--iris-space-xxs, 4px) var(--iris-space-xl, 24px) var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
        fontSize: 'var(--iris-font-size-xs, 12px)',
        minHeight: '28px',
      },
      md: {
        padding:
          'var(--iris-padding-sm, 6px) var(--iris-space-xl, 24px) var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
        fontSize: 'var(--iris-font-size-md, 14px)',
        minHeight: '34px',
      },
      lg: {
        padding:
          'var(--iris-space-xs, 8px) var(--iris-space-2xl, 32px) var(--iris-space-xs, 8px) var(--iris-padding-md, 12px)',
        fontSize: 'var(--iris-font-size-lg, 16px)',
        minHeight: '40px',
      },
    }
  const sz = $derived(SIZE_MAP[size])

  const floating = useFloating({
    anchor: () => triggerEl,
    floating: () => contentEl,
    open: () => open,
    placement: () => placement,
    offset: 6,
  })

  useDismiss({
    enabled: () => open,
    exclude: [() => triggerEl, () => contentEl],
    onDismiss: () => {
      open = false
    },
  })

  function setTrigger(node: HTMLElement): { destroy: () => void } {
    triggerEl = node
    return {
      destroy: () => {
        triggerEl = undefined
      },
    }
  }
  function setContent(node: HTMLElement): { destroy: () => void } {
    contentEl = node
    return {
      destroy: () => {
        contentEl = undefined
      },
    }
  }

  function handleToggle(): void {
    if (!disabled) open = !open
  }

  function selectItem(item: IrisSelectItem): void {
    if (item.disabled) return
    if (isControlled) value = item.value
    else internalValue = item.value
    onValueChange?.(item.value)
    open = false
  }

  // ── Keyboard navigation (single-sourced in core controller) ─────────────
  const isEnabled = (i: number): boolean => !items[i]?.disabled
  const nav = $derived.by(() =>
    createKeyboardNav({
      count: items.length,
      loop: true,
      isEnabled,
      labels: items.map((it) => it.label ?? String(it.value)),
    }),
  )

  // ── Virtualized listbox (opt-in) — combobox precedent ────────────────
  // One controller per mount, built lazily in the first effect; reactive
  // inputs are read live through closures so the instance (scroll offset +
  // keyed cache) survives re-renders.
  const LISTBOX_MAX_HEIGHT = 240
  // Fixed per-option row height (px) — option padding 6+6 + 14px line ≈ 32px
  // plus the 4px inter-row gap; estimate, never measured (combobox approach).
  const ROW_HEIGHT = 36
  let virtualizer: Virtualizer | null = $state(null)
  let unsub: (() => void) | null = null
  let vstate = $state<VirtualizerState>({
    items: [],
    offsetBefore: 0,
    totalSize: 0,
    startIndex: 0,
    endIndex: -1,
  })
  let activeIndex = $state(-1)

  $effect(() => {
    if (!virtual) return
    if (!virtualizer) {
      virtualizer = createVirtualizer({
        count: 0,
        estimateSize: () => ROW_HEIGHT,
        getItemKey: (i) => String(items[i]?.value ?? i),
        viewportSize: LISTBOX_MAX_HEIGHT,
        buffer: 4,
      })
      vstate = virtualizer.getState()
      unsub = virtualizer.subscribe((s) => {
        vstate = s
      })
    }
    // Count + scroll clamp: re-runs when the item list (or size) changes.
    virtualizer.setCount(items.length)
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

  // Bridge the core nav store into reactive state (windowed focus needs it).
  // `nav.index` also re-syncs the local index when the derived controller is
  // recreated (items change) — otherwise a stale index from the previous
  // session would make the scroll effect re-anchor mid-list on reopen.
  $effect(() => {
    activeIndex = nav.index
    return nav.store.subscribe((i) => {
      activeIndex = i
    })
  })

  // Open anchor (virtual): focus the selected (or first enabled) option and
  // scroll it into view — the deep-value anchor, unified across the four
  // bridges. Re-runs when items/value change while open (React parity).
  $effect(() => {
    if (!open || !virtual) return
    const selIdx = items.findIndex((it) => it.value === currentValue && !it.disabled)
    if (selIdx >= 0) nav.focus(selIdx)
    else nav.goFirst()
  })

  // Scroll the active option into view on nav moves ('auto' semantics: no-op
  // when already fully inside the viewport). Estimates are constant and never
  // measured. Deliberately does NOT track vstate — wheel scrolls must move
  // the window freely without the active option snapping back.
  $effect(() => {
    if (!open || !virtual || activeIndex < 0) return
    ensureVisible(activeIndex)
  })

  // Focus the active option only AFTER the scroll-triggered window update has
  // rendered it (vstate is tracked, so this re-runs per window shift).
  // preventScroll: wheel-driven shifts must not be fought by refocusing.
  $effect(() => {
    if (!open || !virtual || activeIndex < 0) return
    void vstate // track window shifts: refocus only after the option rendered
    focusOption(activeIndex)
  })

  // The DOM listbox remounts per open; the controller offset must reset too.
  $effect(() => {
    if (!open) virtualizer?.setScroll(0)
  })

  const listOptions = (): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>(`#${listboxId} [role="option"]`))
  const focusOption = (idx: number): void => {
    if (idx < 0) return
    if (virtual) {
      listboxEl
        ?.querySelector<HTMLElement>(`[data-iris-select-option-index="${idx}"]`)
        ?.focus({ preventScroll: true })
      return
    }
    listOptions()[idx]?.focus()
  }

  // Scroll the active option into view ('auto' semantics: no-op when already
  // fully inside the viewport). Estimates are constant and never measured, so
  // `start = index × rowHeight` is exact.
  const ensureVisible = (index: number): void => {
    if (!virtual || !virtualizer || index < 0 || index >= items.length) return
    const el = listboxEl
    if (!el) return
    const top = el.scrollTop
    const start = index * ROW_HEIGHT
    if (start >= top && start + ROW_HEIGHT <= top + LISTBOX_MAX_HEIGHT) return
    el.scrollTop = virtualizer.scrollToIndex(index, start < top ? 'start' : 'end')
  }

  // Focus the selected (or first enabled) option when the listbox mounts on open,
  // so arrow-key navigation has a starting point — mirrors the WAI-ARIA listbox
  // pattern and the react/vue/solid adapters. Virtual mode anchors via the
  // open-anchor effect instead (it must scroll first, then focus).
  function focusOnOpen(node: HTMLElement): void {
    if (virtual) return
    queueMicrotask(() => {
      const options = Array.from(node.querySelectorAll<HTMLElement>('[role="option"]'))
      if (options.length === 0) return
      const selIdx = items.findIndex((it) => it.value === currentValue && !it.disabled)
      if (selIdx >= 0) {
        nav.focus(selIdx)
        options[selIdx]?.focus()
      } else {
        nav.goFirst()
        const first = nav.index
        if (first >= 0) options[first]?.focus()
      }
    })
  }

  function handleListKeyDown(e: KeyboardEvent): void {
    const action: KeyboardNavAction = nav.handleKeyDown({
      key: e.key,
      preventDefault: () => e.preventDefault(),
    })
    if (action.type === 'focus' || action.type === 'typeahead') {
      focusOption(action.target)
    } else if (action.type === 'escape') {
      open = false
    }
    // 'select' is handled by each option's inline onkeydown handler (Enter/Space)
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->

<button
  type="button"
  role="combobox"
  {id}
  disabled={disabled || undefined}
  data-iris-select-trigger
  data-iris-select-size={size}
  data-state={open ? 'open' : 'closed'}
  aria-haspopup="listbox"
  aria-expanded={open ? 'true' : 'false'}
  aria-controls={listboxId}
  aria-invalid={invalid ? 'true' : undefined}
  aria-describedby={ariaDescribedby}
  {...rest}
  use:setTrigger
  onclick={handleToggle}
  style="display: inline-flex; align-items: center; gap: var(--iris-gap-sm, 4px); background: var(--iris-background); color: {selectedItem
    ? 'var(--iris-foreground)'
    : 'var(--iris-muted)'}; border: 1px solid {invalid
    ? 'var(--iris-danger)'
    : 'var(--iris-border)'}; border-radius: var(--iris-radius-md, 6px); cursor: {disabled
    ? 'not-allowed'
    : 'pointer'}; opacity: {disabled
    ? '0.6'
    : '1'}; text-align: start; font-family: inherit; position: relative; min-width: 140px; padding: {sz.padding}; font-size: {sz.fontSize}; min-height: {sz.minHeight};{style
    ? ' ' + style
    : ''}"
>
  <span style="flex: 1; min-width: 0">{triggerLabel}</span>
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    width="14"
    height="14"
    style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--iris-muted); pointer-events: none"
  >
    <path
      d="M4 6l4 4 4-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</button>

{#if open}
  <ul
    use:setContent
    use:portal={portalTarget}
    use:focusOnOpen
    bind:this={listboxEl}
    id={listboxId}
    role="listbox"
    aria-label={t('select.options')}
    data-iris-select-listbox
    onkeydown={handleListKeyDown}
    onscroll={(e) => {
      virtualizer?.setScroll(e.currentTarget.scrollTop)
    }}
    style="{floating.floatingStyles}; background: var(--iris-background); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); padding: var(--iris-padding-sm, 4px); box-shadow: var(--iris-shadow-lg); min-width: 180px; list-style: none; margin: 0; z-index: 1000; max-height: 240px; overflow-y: auto"
  >
    {#if items.length === 0}
      <li
        data-iris-select-empty=""
        style="padding: var(--iris-space-xs, 8px) var(--iris-padding-sm, 6px); color: var(--iris-muted); font-size: var(--iris-font-size-sm, 13px); text-align: center; list-style: none"
      >
        {t('select.empty')}
      </li>
    {:else if virtual && virtualizer}
      {@const list = items}
      {@const row = ROW_HEIGHT}
      <li
        role="presentation"
        aria-hidden="true"
        data-iris-select-spacer
        data-iris-select-spacer-type="top"
        style="height: {vstate.offsetBefore}px"
      ></li>
      {#each vstate.items as item (item.key)}
        {@const opt = list[item.index]}
        {#if opt}
          <li
            role="option"
            aria-selected={opt.value === currentValue ? 'true' : 'false'}
            aria-disabled={opt.disabled ? 'true' : undefined}
            aria-setsize={list.length}
            aria-posinset={item.index + 1}
            data-iris-select-option
            data-iris-select-option-index={item.index}
            onclick={() => selectItem(opt)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                selectItem(opt)
              }
            }}
            tabindex={opt.disabled ? -1 : 0}
            style="display: flex; align-items: center; gap: var(--iris-gap-sm, 6px); padding: var(--iris-space-xs, 8px) var(--iris-space-sm, 12px); font-size: {sz.fontSize}; border-radius: var(--iris-radius-sm, 4px); cursor: {opt.disabled
              ? 'not-allowed'
              : 'pointer'}; color: {opt.disabled
              ? 'var(--iris-muted)'
              : 'var(--iris-foreground)'}; background: {opt.value === currentValue
              ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
              : 'transparent'}; font-weight: {opt.value === currentValue ? '600' : '400'}"
          >
            <span style="flex: 1; min-width: 0">{opt.label ?? String(opt.value)}</span>
            {#if opt.value === currentValue}
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
        style="height: {vstate.totalSize - vstate.offsetBefore - vstate.items.length * row}px"
      ></li>
    {:else}
      {#each items as item}
        <li
          role="option"
          aria-selected={item.value === currentValue ? 'true' : 'false'}
          aria-disabled={item.disabled ? 'true' : undefined}
          data-iris-select-option
          onclick={() => selectItem(item)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              selectItem(item)
            }
          }}
          tabindex={item.disabled ? -1 : 0}
          style="display: flex; align-items: center; gap: var(--iris-gap-sm, 6px); padding: var(--iris-space-xs, 8px) var(--iris-space-sm, 12px); font-size: {sz.fontSize}; border-radius: var(--iris-radius-sm, 4px); cursor: {item.disabled
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
  </ul>
{/if}
