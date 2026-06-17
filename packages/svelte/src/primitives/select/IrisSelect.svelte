<script lang="ts">
  import {
    generateId,
    matchTypeahead,
    nextEnabledIndex,
    firstEnabledIndex,
    lastEnabledIndex,
  } from '@iris-ui/core'
  import { useFloating } from '../../floating/useFloating.svelte'
  import { useDismiss } from '../../floating/useDismiss.svelte'
  import { portal } from '../../internal/portal'
  import { useI18n } from '../../i18n'
  import type { Placement } from '@iris-ui/core'

  export interface IrisSelectItem<T = unknown> {
    label?: string
    value: T
    disabled?: boolean
  }

  type IrisSelectSize = 'sm' | 'md' | 'lg'

  interface Props {
    items: IrisSelectItem[]
    value?: unknown
    placeholder?: string
    size?: IrisSelectSize
    disabled?: boolean
    placement?: Placement
    invalid?: boolean
    id?: string
    /** Pass `false` to render the dropdown list inline (no portal). */
    portalTarget?: HTMLElement | false
    onValueChange?: (value: unknown) => void
    style?: string
    [key: string]: unknown
  }

  let {
    items,
    value,
    placeholder,
    size = 'md',
    disabled = false,
    placement = 'bottom-start',
    invalid = false,
    id,
    portalTarget,
    onValueChange,
    style,
    ...rest
  }: Props = $props()

  const { t } = useI18n()

  const baseId = generateId()
  const listboxId = `${baseId}-listbox`

  let open = $state(false)
  let triggerEl = $state<HTMLElement | undefined>(undefined)
  let contentEl = $state<HTMLElement | undefined>(undefined)

  const selectedItem = $derived(items.find((item) => item.value === value) ?? null)
  const triggerLabel = $derived(selectedItem ? (selectedItem.label ?? String(selectedItem.value)) : (placeholder ?? t('select.placeholder')))

  const SIZE_MAP: Record<IrisSelectSize, { padding: string; fontSize: string; minHeight: string }> = {
    sm: { padding: '4px 24px 4px 8px', fontSize: '12px', minHeight: '28px' },
    md: { padding: '6px 28px 6px 12px', fontSize: '14px', minHeight: '34px' },
    lg: { padding: '8px 32px 8px 12px', fontSize: '16px', minHeight: '40px' },
  }
  const sz = $derived(SIZE_MAP[size])

  const floating = useFloating({
    anchor: () => triggerEl,
    floating: () => contentEl,
    open: () => open,
    placement,
    offset: 6,
  })

  useDismiss({
    enabled: () => open,
    exclude: [() => triggerEl, () => contentEl],
    onDismiss: () => { open = false },
  })

  function setTrigger(node: HTMLElement): { destroy: () => void } {
    triggerEl = node
    return { destroy: () => { triggerEl = undefined } }
  }
  function setContent(node: HTMLElement): { destroy: () => void } {
    contentEl = node
    return { destroy: () => { contentEl = undefined } }
  }

  function handleToggle(): void {
    if (!disabled) open = !open
  }

  function selectItem(item: IrisSelectItem): void {
    if (item.disabled) return
    onValueChange?.(item.value)
    open = false
  }

  const _typeahead = { buffer: '', timer: null as ReturnType<typeof setTimeout> | null }

  const isEnabledItem = (i: number): boolean => !items[i]?.disabled
  const listOptions = (): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>(`#${listboxId} [role="option"]`))
  const focusOption = (idx: number): void => {
    if (idx >= 0) listOptions()[idx]?.focus()
  }

  // Focus the selected (or first enabled) option when the listbox mounts on open,
  // so arrow-key navigation has a starting point — mirrors the WAI-ARIA listbox
  // pattern and the react/vue/solid adapters.
  function focusOnOpen(node: HTMLElement): void {
    queueMicrotask(() => {
      const options = Array.from(node.querySelectorAll<HTMLElement>('[role="option"]'))
      if (options.length === 0) return
      const selIdx = items.findIndex((it) => it.value === value && !it.disabled)
      const idx = selIdx >= 0 ? selIdx : firstEnabledIndex(items.length, isEnabledItem)
      if (idx >= 0) options[idx]?.focus()
    })
  }

  function handleListKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      open = false
      return
    }
    const options = listOptions()
    const currentIdx = options.indexOf(document.activeElement as HTMLElement)
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusOption(nextEnabledIndex(currentIdx, 1, items.length, isEnabledItem))
        return
      case 'ArrowUp':
        e.preventDefault()
        focusOption(nextEnabledIndex(currentIdx, -1, items.length, isEnabledItem))
        return
      case 'Home':
        e.preventDefault()
        focusOption(firstEnabledIndex(items.length, isEnabledItem))
        return
      case 'End':
        e.preventDefault()
        focusOption(lastEnabledIndex(items.length, isEnabledItem))
        return
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      _typeahead.buffer += e.key
      if (_typeahead.timer) clearTimeout(_typeahead.timer)
      _typeahead.timer = setTimeout(() => {
        _typeahead.buffer = ''
      }, 500)
      const labels = items.map((it) => (it.label ?? String(it.value)) as string)
      const match = matchTypeahead(labels, _typeahead.buffer, currentIdx, (i) => !!items[i]?.disabled)
      if (match >= 0) options[match]?.focus()
    }
  }
</script>

<button
  type="button"
  {id}
  disabled={disabled || undefined}
  data-iris-select-trigger
  data-iris-select-size={size}
  data-state={open ? 'open' : 'closed'}
  aria-haspopup="listbox"
  aria-expanded={open ? 'true' : 'false'}
  aria-controls={listboxId}
  {...rest}
  use:setTrigger
  onclick={handleToggle}
  style="display: inline-flex; align-items: center; gap: var(--iris-gap-sm, 4px); background: var(--iris-background); color: {selectedItem ? 'var(--iris-foreground)' : 'var(--iris-muted)'}; border: 1px solid {invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}; border-radius: var(--iris-radius-md, 6px); cursor: {disabled ? 'not-allowed' : 'pointer'}; opacity: {disabled ? '0.6' : '1'}; text-align: start; font-family: inherit; position: relative; min-width: 140px; padding: {sz.padding}; font-size: {sz.fontSize}; min-height: {sz.minHeight};{style ? ' ' + style : ''}"
>
  <span style="flex: 1; min-width: 0">{triggerLabel}</span>
  <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--iris-muted); pointer-events: none">
    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</button>

{#if open}
  <ul
    use:setContent
    use:portal={portalTarget}
    use:focusOnOpen
    id={listboxId}
    role="listbox"
    aria-label={t('select.options')}
    data-iris-select-listbox
    onkeydown={handleListKeyDown}
    style="{floating.floatingStyles}; background: var(--iris-background); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); padding: var(--iris-padding-sm, 4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); min-width: 180px; list-style: none; margin: 0; z-index: 1000; max-height: 240px; overflow-y: auto"
  >
    {#each items as item}
      <li
        role="option"
        aria-selected={item.value === value ? 'true' : 'false'}
        aria-disabled={item.disabled ? 'true' : undefined}
        data-iris-select-option
        onclick={() => selectItem(item)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectItem(item) } }}
        tabindex={item.disabled ? -1 : 0}
        style="padding: 6px 10px; font-size: {sz.fontSize}; border-radius: var(--iris-radius-sm, 4px); cursor: {item.disabled ? 'not-allowed' : 'pointer'}; color: {item.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)'}; background: {item.value === value ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))' : 'transparent'}; font-weight: {item.value === value ? '600' : '400'}"
      >
        {item.label ?? String(item.value)}
      </li>
    {/each}
  </ul>
{/if}
