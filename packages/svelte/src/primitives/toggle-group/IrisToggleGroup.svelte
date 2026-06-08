<script lang="ts">
  import { createSelectionModel } from '@iris-ui/core'
  import { toStore } from '../../useStore'
  import { styleToString, mergeStyle } from '../../internal/style'
  import { setToggleGroupContext } from './context'
  import type { ToggleGroupType, ToggleGroupOrientation, ToggleGroupVariant } from './context'

  interface Props {
    type?: ToggleGroupType
    value?: string | string[] | null
    orientation?: ToggleGroupOrientation
    size?: 'sm' | 'md' | 'lg'
    variant?: ToggleGroupVariant
    disabled?: boolean
    style?: string
    children?: import('svelte').Snippet
    onchange?: (value: string | string[] | null) => void
    [key: string]: unknown
  }

  let {
    type = 'single',
    value = undefined,
    orientation = 'horizontal',
    size = 'md',
    variant = 'outline',
    disabled = false,
    style,
    children,
    onchange,
    ...rest
  }: Props = $props()

  // Plain non-reactive array for focus movement registration
  interface ItemReg { value: string; getEl: () => HTMLElement | null }
  const itemRegistry: ItemReg[] = []

  // Selection logic (single/multiple toggle, dedup) is single-sourced in the
  // core selection model; this component only maps its union value shape
  // (string | string[] | null) to/from the model's flat key array — mirroring
  // the React ToggleGroup reference.
  const toKeys = (v: string | string[] | null | undefined): string[] =>
    v == null ? [] : Array.isArray(v) ? v : [v]
  const fromKeys = (keys: string[]): string | string[] | null =>
    type === 'multiple' ? keys : (keys[0] ?? null)

  // svelte-ignore state_referenced_locally — initial seed; controlled changes sync below.
  const model = createSelectionModel<string>({
    mode: type === 'multiple' ? 'multiple' : 'single',
    defaultSelected: toKeys(value),
    onChange: (keys) => onchange?.(fromKeys(keys)),
  })
  const selectedKeys = toStore(model.store)

  // `value` is the single source for this controlled-only API: mirror it into
  // the model without re-emitting onchange.
  $effect(() => {
    model.sync(toKeys(value))
  })

  function isActive(v: string): boolean {
    return $selectedKeys.includes(v)
  }

  function toggle(v: string) {
    if (disabled) return
    model.toggle(v)
  }

  function registerItem(v: string, getEl: () => HTMLElement | null) {
    if (!itemRegistry.find((it) => it.value === v)) itemRegistry.push({ value: v, getEl })
  }

  function unregisterItem(v: string) {
    const idx = itemRegistry.findIndex((it) => it.value === v)
    if (idx >= 0) itemRegistry.splice(idx, 1)
  }

  function moveFocus(from: string, delta: 1 | -1 | 'home' | 'end') {
    if (itemRegistry.length === 0) return
    const idx = itemRegistry.findIndex((it) => it.value === from)
    let next: number
    if (delta === 'home') next = 0
    else if (delta === 'end') next = itemRegistry.length - 1
    else next = (idx + delta + itemRegistry.length) % itemRegistry.length
    itemRegistry[next]?.getEl()?.focus()
  }

  setToggleGroupContext({
    get type() { return type },
    get orientation() { return orientation },
    get size() { return size },
    get variant() { return variant },
    get disabled() { return disabled },
    isActive,
    toggle,
    registerItem,
    unregisterItem,
    moveFocus,
  })

  const rootStyle = $derived(styleToString({
    display: 'inline-flex',
    'flex-direction': orientation === 'horizontal' ? 'row' : 'column',
    'border-radius': 'var(--iris-radius-md, 6px)',
    overflow: 'hidden',
    background: variant === 'outline' ? 'transparent' : 'var(--iris-surface)',
    border: variant === 'outline' ? '1px solid var(--iris-border)' : '1px solid transparent',
  }))
</script>

<div
  {...rest}
  role={type === 'single' ? 'radiogroup' : 'group'}
  aria-orientation={orientation}
  aria-disabled={disabled ? 'true' : undefined}
  data-iris-toggle-group
  data-iris-toggle-group-type={type}
  data-iris-toggle-group-orientation={orientation}
  data-iris-toggle-group-size={size}
  style={mergeStyle(rootStyle, style)}
>
  {@render children?.()}
</div>
