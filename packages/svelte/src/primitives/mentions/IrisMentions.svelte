<script lang="ts">
  import {
    createVirtualizer,
    generateId,
    type Virtualizer,
    type VirtualizerState,
  } from '@iris-ui-kit/core'

  export interface IrisMentionOption {
    label: string
    value: string
  }

  interface ActiveMention {
    start: number
    query: string
  }

  interface Props {
    value?: string
    defaultValue?: string
    options?: IrisMentionOption[]
    prefix?: string
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    rows?: number
    id?: string
    onValueChange?: (value: string) => void
    /**
     * Opt-in windowed rendering of the suggestion listbox via the core
     * virtualizer. When true, only the visible window (+ buffer) of options is
     * rendered; keyboard navigation scrolls the active option into view and
     * every keystroke re-anchors the window to the top. Default false.
     */
    virtual?: boolean
    style?: string
    class?: string
  }

  let {
    value = undefined,
    defaultValue = '',
    options = [],
    prefix = '@',
    placeholder,
    disabled = false,
    invalid = false,
    rows = 3,
    virtual = false,
    id,
    onValueChange,
    style,
    class: className,
    ...rest
  }: Props = $props()

  // Controlled when `value` is supplied; otherwise self-manage from defaultValue
  // so an uncontrolled textarea actually updates as the user types (previously
  // it bound straight to the prop and froze without a parent write-back).
  const isControlled = $derived(value !== undefined)
  // svelte-ignore state_referenced_locally
  let internal = $state(defaultValue)
  const text = $derived(isControlled ? (value as string) : internal)

  const baseId = generateId()
  const listboxId = `${baseId}-listbox`

  let textareaEl = $state<HTMLTextAreaElement | undefined>(undefined)
  let activeIndex = $state(0)
  let active = $state<ActiveMention | null>(null)

  function detect(text: string, caret: number): ActiveMention | null {
    let i = caret - 1
    while (i >= 0 && text.charAt(i) !== prefix) {
      if (/\s/.test(text.charAt(i))) return null
      i--
    }
    if (i < 0) return null
    if (i === 0 || /\s/.test(text.charAt(i - 1))) {
      return { start: i, query: text.slice(i + 1, caret) }
    }
    return null
  }

  const filtered = $derived.by(() => {
    if (!active) return []
    const q = active.query.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  })

  const open = $derived(active !== null && filtered.length > 0)
  const activeId = $derived(open ? `${baseId}-opt-${activeIndex}` : undefined)

  /** Listbox maxHeight — the virtualizer's viewport (px). */
  const LISTBOX_MAX_HEIGHT = 200
  /** Fixed per-option row height (px) — estimate, never measured. */
  const ROW_HEIGHT = 32

  // Virtualized listbox (opt-in): one controller per mount, built lazily in
  // the first effect; reactive inputs are read live through closures so the
  // instance (scroll offset + keyed cache) survives re-renders — the
  // IrisCombobox precedent.
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
  // Change detectors: a text change means a keystroke (activeIndex resets to
  // 0 — re-anchor the window); an activeIndex change means keyboard/mouse
  // navigation (keep the option visible). Wheel scrolling changes neither.
  let lastText: string | undefined
  let lastActiveIndex = 0

  // Single sync covering every listbox mutation: count push + per-keystroke
  // re-anchor to 0, shrink clamp (external options swaps) and active-option
  // visibility (keyboard arrows / mouse hover).
  $effect(() => {
    if (!virtual) return
    if (!virtualizer) {
      virtualizer = createVirtualizer({
        count: 0,
        estimateSize: () => ROW_HEIGHT,
        // `filtered` is a cached $derived.by value — O(1) per lookup. (The
        // function form would re-run the 10k filter on every one of the
        // virtualizer's per-item key lookups during tree rebuilds.)
        getItemKey: (i) => filtered[i]?.value ?? i,
        viewportSize: LISTBOX_MAX_HEIGHT,
        buffer: 4,
      })
      vstate = virtualizer.getState()
      unsub = virtualizer.subscribe((s) => {
        vstate = s
      })
    }
    const list = filtered
    virtualizer.setCount(list.length)
    // Read up-front so `activeIndex` is tracked by this effect in EVERY run —
    // the re-anchor branch below returns early, and Svelte rebuilds the
    // effect's dependency set per run (an untracked activeIndex would freeze
    // keyboard navigation until the next text change).
    const idx = activeIndex
    if (text !== lastText) {
      lastText = text
      lastActiveIndex = 0
      virtualizer.setScroll(0)
      if (listboxEl) listboxEl.scrollTop = 0
      return
    }
    const el = listboxEl
    if (el) {
      const max = Math.max(0, virtualizer.totalSize() - LISTBOX_MAX_HEIGHT)
      if (el.scrollTop > max) el.scrollTop = max
    }
    if (idx !== lastActiveIndex) {
      lastActiveIndex = idx
      if (idx >= 0 && idx < list.length && el) {
        const top = el.scrollTop
        const start = idx * ROW_HEIGHT
        if (start < top || start + ROW_HEIGHT > top + LISTBOX_MAX_HEIGHT) {
          el.scrollTop = virtualizer.scrollToIndex(idx, start < top ? 'start' : 'end')
        }
      }
    }
  })
  $effect(() => () => {
    unsub?.()
    unsub = null
  })

  function onInput(e: Event) {
    const ta = e.target as HTMLTextAreaElement
    const next = ta.value
    const caret = ta.selectionStart ?? next.length
    if (!isControlled) internal = next
    onValueChange?.(next)
    active = detect(next, caret)
    activeIndex = 0
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) return
    const list = filtered
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        activeIndex = Math.min(list.length - 1, activeIndex + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        activeIndex = Math.max(0, activeIndex - 1)
        break
      case 'Enter':
        if (list[activeIndex]) {
          e.preventDefault()
          selectOption(list[activeIndex]!)
        }
        break
      case 'Escape':
        e.preventDefault()
        active = null
        break
    }
  }

  function selectOption(opt: IrisMentionOption) {
    if (!active || !textareaEl) return
    const before = text.slice(0, active.start)
    const after = text.slice(active.start + 1 + active.query.length)
    const newVal = `${before}${prefix}${opt.label} ${after}`
    if (!isControlled) internal = newVal
    onValueChange?.(newVal)
    active = null
    textareaEl.focus()
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->

<div
  data-iris-mentions
  style:position="relative"
  style:display="inline-flex"
  style:flex-direction="column"
  {style}
  class={className}
>
  <textarea
    bind:this={textareaEl}
    {id}
    value={text}
    {placeholder}
    {rows}
    {disabled}
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={open}
    aria-controls={listboxId}
    aria-activedescendant={activeId}
    aria-invalid={invalid ? 'true' : undefined}
    data-iris-mentions-textarea
    oninput={onInput}
    onkeydown={onKeyDown}
    style:box-sizing="border-box"
    style:width="100%"
    style:padding="8px 12px"
    style:font-size="var(--iris-font-size-md, 14px)"
    style:font-family="inherit"
    style:color="var(--iris-foreground)"
    style:background={invalid ? 'var(--iris-background)' : 'var(--iris-background)'}
    style:border={`1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`}
    style:border-radius="var(--iris-radius-md, 6px)"
    style:outline="none"
    style:resize="vertical"
    {...rest}
  ></textarea>

  {#if open}
    <ul
      id={listboxId}
      bind:this={listboxEl}
      data-iris-mentions-list
      role="listbox"
      onscroll={(e) => {
        virtualizer?.setScroll(e.currentTarget.scrollTop)
      }}
      style:position="absolute"
      style:left="0"
      style:top="100%"
      style:margin-top="4px"
      style:max-height="200px"
      style:overflow-y="auto"
      style:min-width="160px"
      style:padding="4px"
      style:z-index="50"
      style:list-style="none"
      style:margin-block-start="0"
      style:margin-block-end="0"
      style:padding-inline-start="0"
      style:background="var(--iris-background)"
      style:border="1px solid var(--iris-border)"
      style:border-radius="var(--iris-radius-md, 6px)"
      style:box-shadow="var(--iris-shadow-lg)"
    >
      {#if virtual && virtualizer}
        {@const list = filtered}
        <li
          role="presentation"
          aria-hidden="true"
          data-iris-mentions-spacer
          data-iris-mentions-spacer-type="top"
          style="height: {vstate.offsetBefore}px"
        ></li>
        {#each vstate.items as item (item.key)}
          {@const opt = list[item.index]}
          {#if opt}
            <li
              id={`${baseId}-opt-${item.index}`}
              role="option"
              aria-selected={item.index === activeIndex ? 'true' : 'false'}
              aria-setsize={list.length}
              aria-posinset={item.index + 1}
              data-iris-mentions-item
              data-state={item.index === activeIndex ? 'active' : 'idle'}
              onmousedown={(event) => event.preventDefault()}
              onclick={() => selectOption(opt)}
              onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  selectOption(opt)
                }
              }}
              style:padding="var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)"
              style:cursor="pointer"
              style:font-size="var(--iris-font-size-md, 14px)"
              style:border-radius="var(--iris-radius-sm, 4px)"
              style:background={item.index === activeIndex
                ? 'var(--iris-surface-hover)'
                : 'transparent'}
              style:color="var(--iris-foreground)"
            >
              {opt.label}
            </li>
          {/if}
        {/each}
        <li
          role="presentation"
          aria-hidden="true"
          data-iris-mentions-spacer
          data-iris-mentions-spacer-type="bottom"
          style="height: {vstate.totalSize -
            vstate.offsetBefore -
            vstate.items.length * ROW_HEIGHT}px"
        ></li>
      {:else}
        {#each filtered as opt, i (opt.value)}
          <li
            id={`${baseId}-opt-${i}`}
            role="option"
            aria-selected={i === activeIndex}
            data-iris-mentions-item
            data-state={i === activeIndex ? 'active' : 'idle'}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => selectOption(opt)}
            onkeydown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                selectOption(opt)
              }
            }}
            style:padding="var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)"
            style:cursor="pointer"
            style:font-size="var(--iris-font-size-md, 14px)"
            style:border-radius="var(--iris-radius-sm, 4px)"
            style:background={i === activeIndex ? 'var(--iris-surface-hover)' : 'transparent'}
            style:color="var(--iris-foreground)"
          >
            {opt.label}
          </li>
        {/each}
      {/if}
    </ul>
  {/if}
</div>
