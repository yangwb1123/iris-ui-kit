<script lang="ts">
  import { generateId, createKeyboardNav, type KeyboardNavAction } from '@iris-ui-kit/core'
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
    id={listboxId}
    role="listbox"
    aria-label={t('select.options')}
    data-iris-select-listbox
    onkeydown={handleListKeyDown}
    style="{floating.floatingStyles}; background: var(--iris-background); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); padding: var(--iris-padding-sm, 4px); box-shadow: var(--iris-shadow-lg); min-width: 180px; list-style: none; margin: 0; z-index: 1000; max-height: 240px; overflow-y: auto"
  >
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
        style="padding: var(--iris-space-xs, 8px) var(--iris-space-sm, 12px); font-size: {sz.fontSize}; border-radius: var(--iris-radius-sm, 4px); cursor: {item.disabled
          ? 'not-allowed'
          : 'pointer'}; color: {item.disabled
          ? 'var(--iris-muted)'
          : 'var(--iris-foreground)'}; background: {item.value === currentValue
          ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
          : 'transparent'}; font-weight: {item.value === currentValue ? '600' : '400'}"
      >
        {item.label ?? String(item.value)}
      </li>
    {/each}
  </ul>
{/if}
