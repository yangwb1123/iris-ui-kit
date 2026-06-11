<script lang="ts">
  import { createSelectionModel, nextEnabledIndex, firstEnabledIndex, lastEnabledIndex } from '@iris-ui/core'
  import { toStore } from '../../useStore'
  import type { IrisSegmentedOption } from './types'

  type SegmentedSize = 'sm' | 'md' | 'lg'

  const SIZE_MAP: Record<SegmentedSize, { padding: string; fontSize: string; height: string }> = {
    sm: { padding: '2px 8px', fontSize: '12px', height: '24px' },
    md: { padding: '4px 12px', fontSize: '14px', height: '30px' },
    lg: { padding: '6px 16px', fontSize: '16px', height: '36px' },
  }

  function normalize(options: Array<IrisSegmentedOption | string>): IrisSegmentedOption[] {
    return options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o))
  }

  let {
    options = [],
    value = undefined,
    size = 'md',
    disabled = false,
    block = false,
    ariaLabel,
    onchange,
    style,
    ...rest
  }: {
    options?: Array<IrisSegmentedOption | string>
    value?: string
    size?: SegmentedSize
    disabled?: boolean
    block?: boolean
    ariaLabel?: string
    onchange?: (value: string) => void
    style?: string
    [key: string]: unknown
  } = $props()

  // Controlled when a `value` prop is supplied. Controlled segmented RENDERS from
  // the prop (true controlled semantics): a click emits onchange but the active
  // segment only changes when the parent writes `value` back; uncontrolled
  // renders from the model store.
  const isControlled = $derived(value !== undefined)
  const toKeys = (v: string | undefined): string[] => (v ? [v] : [])

  // Single-selection semantics (replace-on-select) + the controlled mirror are
  // single-sourced in the core selection model; this component keeps only its
  // value SHAPE (a single string) plus the roving-focus/keyboard logic.
  // svelte-ignore state_referenced_locally — initial seed; controlled changes sync below.
  const model = createSelectionModel<string>({
    mode: 'single',
    defaultSelected: toKeys(value),
    onChange: (keys) => onchange?.(keys[0] ?? ''),
  })
  const selectedKeys = toStore(model.store)
  // Controlled: mirror the prop into the model without re-emitting onchange.
  $effect(() => {
    if (isControlled) model.sync(toKeys(value))
  })

  // Re-base the model on the controlled prop before a select so the emitted next
  // value is computed against what the parent holds (not a prior, possibly-
  // rejected, optimistic value).
  function rebaseToProp(): void {
    if (isControlled) model.sync(toKeys(value))
  }

  let btnRefs = $state<(HTMLButtonElement | null)[]>([])

  const norm = $derived(normalize(options))
  const sz = $derived(SIZE_MAP[size])
  // Render the selection from the prop when controlled, the model store otherwise.
  const displaySelected = $derived(isControlled ? toKeys(value) : $selectedKeys)
  const selectedIndex = $derived(norm.findIndex((o) => displaySelected.includes(o.value)))
  // Enabled-index roving math (skip-disabled + wrap, first/last-enabled) is
  // single-sourced in @iris-ui/core; this component keeps only focus/selection.
  const isEnabled = (i: number): boolean => !norm[i]?.disabled
  const firstEnabled = $derived(firstEnabledIndex(norm.length, isEnabled))
  const rovingIndex = $derived(selectedIndex >= 0 ? selectedIndex : firstEnabled)

  function select(i: number): void {
    const opt = norm[i]
    if (!opt || opt.disabled || disabled) return
    rebaseToProp()
    // model.set always commits (fires onChange → onchange), preserving the
    // original "clicking always emits the value" behavior.
    model.set([opt.value])
    btnRefs[i]?.focus()
  }

  function move(from: number, dir: 1 | -1): void {
    if (disabled) return
    select(nextEnabledIndex(from, dir, norm.length, isEnabled))
  }

  function onKeyDown(event: KeyboardEvent, i: number): void {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      move(i, 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(i, -1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      select(firstEnabled)
    } else if (event.key === 'End') {
      event.preventDefault()
      select(lastEnabledIndex(norm.length, isEnabled))
    }
  }
</script>

<div
  {...rest}
  role="radiogroup"
  aria-label={ariaLabel}
  data-iris-segmented
  data-iris-segmented-size={size}
  data-disabled={disabled ? 'true' : undefined}
  style="display:{block ? 'flex' : 'inline-flex'}; {block ? 'width:100%;' : ''} gap:2px; padding:2px; background:var(--iris-surface); border-radius:var(--iris-radius-md,6px); opacity:{disabled ? '0.6' : '1'};{style ? ' ' + style : ''}"
>
  {#each norm as opt, i (opt.value)}
    {@const selected = displaySelected.includes(opt.value)}
    <button
      bind:this={btnRefs[i]}
      type="button"
      role="radio"
      aria-checked={selected ? 'true' : 'false'}
      disabled={disabled || opt.disabled || undefined}
      tabindex={i === rovingIndex ? 0 : -1}
      data-iris-segmented-item
      data-value={opt.value}
      data-selected={selected ? 'true' : undefined}
      onclick={() => select(i)}
      onkeydown={(e) => onKeyDown(e, i)}
      style="flex:{block ? '1' : undefined}; padding:{sz.padding}; min-height:{sz.height}; font-size:{sz.fontSize}; font-family:inherit; border:none; border-radius:var(--iris-radius-sm,4px); cursor:{disabled || opt.disabled ? 'not-allowed' : 'pointer'}; background:{selected ? 'var(--iris-background)' : 'transparent'}; color:{selected ? 'var(--iris-foreground)' : 'var(--iris-muted)'}; box-shadow:{selected ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'}; font-weight:{selected ? '600' : '400'}; transition:background-color 120ms ease,color 120ms ease; white-space:nowrap;"
    >
      {opt.label}
    </button>
  {/each}
</div>
