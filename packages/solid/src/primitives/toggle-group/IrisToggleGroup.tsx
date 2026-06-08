import {
  createSignal,
  mergeProps,
  onCleanup,
  onMount,
  splitProps,
  useContext,
  type JSX,
} from 'solid-js'
import {
  ToggleGroupCtx,
  type IrisToggleGroupType,
  type IrisToggleGroupOrientation,
  type IrisToggleGroupVariant,
} from './context'

// ── IrisToggleGroup ────────────────────────────────────────────────────────

export interface IrisToggleGroupProps {
  type?: IrisToggleGroupType
  value?: string | string[] | null
  defaultValue?: string | string[] | null
  orientation?: IrisToggleGroupOrientation
  size?: 'sm' | 'md' | 'lg'
  variant?: IrisToggleGroupVariant
  disabled?: boolean
  onChange?: (value: string | string[] | null) => void
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
  [key: string]: unknown
}

/** Solid port of IrisToggleGroup — segmented single/multi toggle. */
export function IrisToggleGroup(props: IrisToggleGroupProps): JSX.Element {
  const merged = mergeProps(
    {
      type: 'single' as IrisToggleGroupType,
      orientation: 'horizontal' as IrisToggleGroupOrientation,
      size: 'md' as 'sm' | 'md' | 'lg',
      variant: 'outline' as IrisToggleGroupVariant,
      disabled: false,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'type',
    'value',
    'defaultValue',
    'orientation',
    'size',
    'variant',
    'disabled',
    'onChange',
    'children',
    'style',
  ])

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal<string | string[] | null>(local.defaultValue ?? null)
  const current = (): string | string[] | null =>
    isControlled() ? (local.value ?? null) : internal()

  const items: { value: string; el: () => HTMLElement | undefined }[] = []

  const isActive = (value: string): boolean => {
    const v = current()
    if (v === null || v === undefined) return false
    if (Array.isArray(v)) return v.includes(value)
    return v === value
  }

  const toggle = (value: string): void => {
    if (local.disabled) return
    if (local.type === 'multiple') {
      const arr = Array.isArray(current()) ? (current() as string[]) : []
      const idx = arr.indexOf(value)
      const next = idx >= 0 ? arr.filter((v) => v !== value) : [...arr, value]
      if (!isControlled()) setInternal(next)
      local.onChange?.(next)
      return
    }
    const next = current() === value ? null : value
    if (!isControlled()) setInternal(next)
    local.onChange?.(next)
  }

  const registerItem = (value: string, el: () => HTMLElement | undefined): void => {
    if (!items.find((it) => it.value === value)) items.push({ value, el })
  }

  const unregisterItem = (value: string): void => {
    const idx = items.findIndex((it) => it.value === value)
    if (idx >= 0) items.splice(idx, 1)
  }

  const moveFocus = (from: string, delta: 1 | -1 | 'home' | 'end'): void => {
    if (items.length === 0) return
    const idx = items.findIndex((it) => it.value === from)
    let next: number
    if (delta === 'home') next = 0
    else if (delta === 'end') next = items.length - 1
    else next = (idx + delta + items.length) % items.length
    items[next]?.el()?.focus()
  }

  return (
    <ToggleGroupCtx.Provider
      value={{
        get type() {
          return local.type
        },
        get orientation() {
          return local.orientation
        },
        get size() {
          return local.size
        },
        get variant() {
          return local.variant
        },
        get disabled() {
          return local.disabled
        },
        isActive,
        toggle,
        registerItem,
        unregisterItem,
        moveFocus,
      }}
    >
      <div
        {...rest}
        role={local.type === 'single' ? 'radiogroup' : 'group'}
        aria-orientation={local.orientation}
        aria-disabled={local.disabled ? 'true' : undefined}
        data-iris-toggle-group=""
        data-iris-toggle-group-type={local.type}
        data-iris-toggle-group-orientation={local.orientation}
        data-iris-toggle-group-size={local.size}
        style={{
          display: 'inline-flex',
          'flex-direction': local.orientation === 'horizontal' ? 'row' : 'column',
          'border-radius': 'var(--iris-radius-md, 6px)',
          overflow: 'hidden',
          background: local.variant === 'outline' ? 'transparent' : 'var(--iris-surface)',
          border:
            local.variant === 'outline' ? '1px solid var(--iris-border)' : '1px solid transparent',
          ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
        }}
      >
        {local.children}
      </div>
    </ToggleGroupCtx.Provider>
  )
}

// ── IrisToggleGroupItem ────────────────────────────────────────────────────

const SIZE_PADDING: Record<'sm' | 'md' | 'lg', string> = {
  sm: '4px 10px',
  md: '6px 14px',
  lg: '8px 18px',
}
const SIZE_FONT: Record<'sm' | 'md' | 'lg', string> = {
  sm: '12px',
  md: '13px',
  lg: '14px',
}

export interface IrisToggleGroupItemProps {
  value: string
  disabled?: boolean
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
  [key: string]: unknown
}

export function IrisToggleGroupItem(props: IrisToggleGroupItemProps): JSX.Element {
  const [local, rest] = splitProps(props, ['value', 'disabled', 'children', 'style'])
  const ctx = useContext(ToggleGroupCtx)
  if (!ctx) throw new Error('IrisToggleGroupItem must be used inside <IrisToggleGroup>')

  let elRef: HTMLButtonElement | undefined

  onMount(() => ctx.registerItem(local.value, () => elRef))
  onCleanup(() => ctx.unregisterItem(local.value))

  const isActive = (): boolean => ctx.isActive(local.value)
  const isDisabled = (): boolean => !!(local.disabled || ctx.disabled)
  const isSingle = (): boolean => ctx.type === 'single'

  const onClick = (): void => {
    if (isDisabled()) return
    ctx.toggle(local.value)
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isDisabled()) return
    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault()
        ctx.toggle(local.value)
        break
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        ctx.moveFocus(local.value, 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        ctx.moveFocus(local.value, -1)
        break
      case 'Home':
        e.preventDefault()
        ctx.moveFocus(local.value, 'home')
        break
      case 'End':
        e.preventDefault()
        ctx.moveFocus(local.value, 'end')
        break
    }
  }

  return (
    <button
      {...rest}
      ref={(el) => {
        elRef = el
      }}
      type="button"
      role={isSingle() ? 'radio' : undefined}
      aria-checked={isSingle() ? (isActive() ? 'true' : 'false') : undefined}
      aria-pressed={isSingle() ? undefined : isActive() ? 'true' : 'false'}
      aria-disabled={isDisabled() ? 'true' : undefined}
      disabled={isDisabled() || undefined}
      tabIndex={isActive() ? 0 : -1}
      data-iris-toggle-group-item=""
      data-state={isActive() ? 'on' : 'off'}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        'justify-content': 'center',
        gap: '6px',
        padding: SIZE_PADDING[ctx.size],
        'font-size': SIZE_FONT[ctx.size],
        'font-family': 'inherit',
        'font-weight': '500',
        'line-height': '1',
        background: isActive() ? 'var(--iris-primary)' : 'transparent',
        color: isActive() ? 'var(--iris-primary-foreground, #fff)' : 'var(--iris-foreground)',
        border: 'none',
        cursor: isDisabled() ? 'not-allowed' : 'pointer',
        opacity: isDisabled() ? 0.5 : 1,
        transition: 'background-color 120ms ease, color 120ms ease',
        ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
      }}
    >
      {local.children}
    </button>
  )
}
