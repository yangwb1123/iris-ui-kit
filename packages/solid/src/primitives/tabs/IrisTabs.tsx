import { createSignal, mergeProps, Show, splitProps, useContext, type JSX } from 'solid-js'
import { firstEnabledIndex, lastEnabledIndex, nextEnabledIndex } from '@iris-ui-kit/core'
import { TabsCtx, type IrisTabsOrientation } from './context'

// ── Types ──────────────────────────────────────────────────────────────────

interface TriggerRegistration {
  value: string
  isDisabled: () => boolean
}

// ── IrisTabs (root) ────────────────────────────────────────────────────────

export interface IrisTabsProps {
  value?: string
  defaultValue?: string
  orientation?: IrisTabsOrientation
  disabled?: boolean
  lazy?: boolean
  onChange?: (value: string) => void
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
}

/** Solid port of IrisTabs root — provides context to list + triggers + content. */
export function IrisTabs(props: IrisTabsProps): JSX.Element {
  const merged = mergeProps(
    { orientation: 'horizontal' as IrisTabsOrientation, disabled: false, lazy: true },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'orientation',
    'disabled',
    'lazy',
    'onChange',
    'children',
  ])

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal<string | null>(local.defaultValue ?? null)
  const current = (): string | null => (isControlled() ? (local.value ?? null) : internal())

  const triggers: TriggerRegistration[] = []
  let listEl: HTMLElement | undefined

  const setValue = (next: string): void => {
    if (!isControlled()) setInternal(next)
    local.onChange?.(next)
  }

  const registerTrigger = (value: string, isDisabled: () => boolean): void => {
    if (triggers.some((t) => t.value === value)) return
    triggers.push({ value, isDisabled })
    if (internal() === null && !isControlled() && !isDisabled()) setInternal(value)
  }

  const unregisterTrigger = (value: string): void => {
    const idx = triggers.findIndex((t) => t.value === value)
    if (idx >= 0) triggers.splice(idx, 1)
  }

  const focusTriggerByValue = (value: string): void => {
    if (!listEl) return
    const el = listEl.querySelector<HTMLElement>(`[data-iris-tabs-trigger][data-value="${value}"]`)
    el?.focus()
  }

  const moveFocus = (from: string, delta: 1 | -1 | 'home' | 'end'): void => {
    const isEnabled = (i: number): boolean => !triggers[i]?.isDisabled()
    const fromIndex = triggers.findIndex((t) => t.value === from)
    let nextIndex: number
    if (delta === 'home') nextIndex = firstEnabledIndex(triggers.length, isEnabled)
    else if (delta === 'end') nextIndex = lastEnabledIndex(triggers.length, isEnabled)
    else nextIndex = nextEnabledIndex(fromIndex, delta, triggers.length, isEnabled)
    const next = triggers[nextIndex]
    if (next) {
      setValue(next.value)
      focusTriggerByValue(next.value)
    }
  }

  return (
    <TabsCtx.Provider
      value={{
        get value() {
          return current()
        },
        get orientation() {
          return local.orientation
        },
        get disabled() {
          return local.disabled
        },
        get lazy() {
          return local.lazy
        },
        get listRef() {
          return listEl
        },
        setValue,
        registerTrigger,
        unregisterTrigger,
        moveFocus,
        setListRef: (el) => {
          listEl = el
        },
      }}
    >
      <div {...rest}>{local.children}</div>
    </TabsCtx.Provider>
  )
}

// ── IrisTabsList ───────────────────────────────────────────────────────────

export interface IrisTabsListProps {
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
  [key: string]: unknown
}

export function IrisTabsList(props: IrisTabsListProps): JSX.Element {
  const [local, rest] = splitProps(props, ['children', 'style'])
  const ctx = useContext(TabsCtx)
  if (!ctx) throw new Error('IrisTabsList must be used inside <IrisTabs>')

  return (
    <div
      {...rest}
      ref={(el) => ctx.setListRef(el)}
      role="tablist"
      aria-orientation={ctx.orientation}
      data-iris-tabs-list=""
      style={{
        display: 'inline-flex',
        'flex-direction': ctx.orientation === 'horizontal' ? 'row' : 'column',
        gap: 'var(--iris-space-xxs, 4px)',
        'border-bottom': ctx.orientation === 'horizontal' ? '1px solid var(--iris-border)' : 'none',
        ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
      }}
    >
      {local.children}
    </div>
  )
}

// ── IrisTabsTrigger ────────────────────────────────────────────────────────

export interface IrisTabsTriggerProps {
  value: string
  disabled?: boolean
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
  [key: string]: unknown
}

export function IrisTabsTrigger(props: IrisTabsTriggerProps): JSX.Element {
  const [local, rest] = splitProps(props, ['value', 'disabled', 'children', 'style'])
  const ctx = useContext(TabsCtx)
  if (!ctx) throw new Error('IrisTabsTrigger must be used inside <IrisTabs>')

  const isDisabled = (): boolean => !!(local.disabled || ctx.disabled)
  const isActive = (): boolean => ctx.value === local.value

  // Register on mount
  let registered = false
  const ensureRegistered = () => {
    if (!registered) {
      registered = true
      ctx.registerTrigger(local.value, isDisabled)
    }
  }
  ensureRegistered()

  const onClick = (): void => {
    if (isDisabled()) return
    ctx.setValue(local.value)
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isDisabled()) return
    const horiz = ctx.orientation === 'horizontal'
    switch (e.key) {
      case horiz ? 'ArrowRight' : 'ArrowDown':
        e.preventDefault()
        ctx.moveFocus(local.value, 1)
        break
      case horiz ? 'ArrowLeft' : 'ArrowUp':
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
      type="button"
      role="tab"
      id={`iris-tabs-trigger-${local.value}`}
      aria-controls={`iris-tabs-content-${local.value}`}
      data-iris-tabs-trigger=""
      data-value={local.value}
      data-state={isActive() ? 'active' : 'inactive'}
      aria-selected={isActive() ? 'true' : 'false'}
      aria-disabled={isDisabled() ? 'true' : undefined}
      disabled={isDisabled() || undefined}
      tabIndex={isActive() ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        'justify-content': 'center',
        padding: '8px 16px',
        border: 'none',
        'border-bottom': `2px solid ${isActive() ? 'var(--iris-primary)' : 'transparent'}`,
        background: 'transparent',
        color: isActive() ? 'var(--iris-primary)' : 'var(--iris-foreground)',
        'font-weight': isActive() ? '600' : '400',
        'font-family': 'inherit',
        'font-size': 'var(--iris-font-size-md, 14px)',
        cursor: isDisabled() ? 'not-allowed' : 'pointer',
        opacity: isDisabled() ? 0.5 : 1,
        transition: 'color 120ms ease, border-color 120ms ease',
        outline: 'none',
        ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
      }}
    >
      {local.children}
    </button>
  )
}

// ── IrisTabsContent ────────────────────────────────────────────────────────

export interface IrisTabsContentProps {
  value: string
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
  [key: string]: unknown
}

export function IrisTabsContent(props: IrisTabsContentProps): JSX.Element {
  const [local, rest] = splitProps(props, ['value', 'children', 'style'])
  const ctx = useContext(TabsCtx)
  if (!ctx) throw new Error('IrisTabsContent must be used inside <IrisTabs>')

  const isActive = (): boolean => ctx.value === local.value

  return (
    <Show when={!ctx.lazy || isActive()}>
      <div
        {...rest}
        role="tabpanel"
        id={`iris-tabs-content-${local.value}`}
        aria-labelledby={`iris-tabs-trigger-${local.value}`}
        data-iris-tabs-content=""
        data-value={local.value}
        data-state={isActive() ? 'active' : 'inactive'}
        hidden={!isActive() || undefined}
        style={{
          'padding-top': '12px',
          ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
        }}
      >
        {local.children}
      </div>
    </Show>
  )
}
