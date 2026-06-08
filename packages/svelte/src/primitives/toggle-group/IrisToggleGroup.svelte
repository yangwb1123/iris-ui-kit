<script lang="ts">
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

  function isActive(v: string): boolean {
    const val = value
    if (val === null || val === undefined) return false
    if (Array.isArray(val)) return val.includes(v)
    return val === v
  }

  function toggle(v: string) {
    if (disabled) return
    if (type === 'multiple') {
      const arr = Array.isArray(value) ? value : []
      const idx = arr.indexOf(v)
      const next = idx >= 0 ? arr.filter((x) => x !== v) : [...arr, v]
      onchange?.(next)
      return
    }
    onchange?.(value === v ? null : v)
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
