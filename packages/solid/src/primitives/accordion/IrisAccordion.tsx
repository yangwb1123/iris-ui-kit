import {
  createSignal,
  createUniqueId,
  mergeProps,
  onCleanup,
  onMount,
  Show,
  splitProps,
  useContext,
  type JSX,
} from 'solid-js'
import { createKeyboardNav, type KeyboardNavAction } from '@iris-ui/core'
import { useStore } from '../../useStore'
import { AccordionCtx } from './context'

// ── Container ──────────────────────────────────────────────────────────────

export type IrisAccordionValue = string | string[] | null

export interface IrisAccordionProps {
  value?: IrisAccordionValue
  defaultValue?: IrisAccordionValue
  multiple?: boolean
  collapsible?: boolean
  onChange?: (value: IrisAccordionValue) => void
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
}

export function IrisAccordion(props: IrisAccordionProps): JSX.Element {
  const merged = mergeProps({ multiple: false, collapsible: false }, props)
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'multiple',
    'collapsible',
    'onChange',
    'children',
  ])

  const isControlled = (): boolean => local.value !== undefined

  const initialInternal: IrisAccordionValue =
    local.defaultValue !== undefined ? local.defaultValue : local.multiple ? [] : null

  const [internal, setInternal] = createSignal<IrisAccordionValue>(initialInternal)

  const current = (): IrisAccordionValue =>
    isControlled() ? (local.value as IrisAccordionValue) : internal()

  const isOpen = (value: string): boolean => {
    const c = current()
    if (c === null || c === undefined) return false
    if (Array.isArray(c)) return c.includes(value)
    return c === value
  }

  const setValue = (next: IrisAccordionValue): void => {
    if (!isControlled()) setInternal(next)
    local.onChange?.(next)
  }

  const toggle = (value: string): void => {
    if (local.multiple) {
      const arr = Array.isArray(current()) ? (current() as string[]) : []
      const idx = arr.indexOf(value)
      const next = idx >= 0 ? arr.filter((v) => v !== value) : [...arr, value]
      setValue(next)
      return
    }
    if (current() === value) {
      if (local.collapsible) setValue(null)
    } else {
      setValue(value)
    }
  }

  const rootId = createUniqueId()

  // ── Keyboard navigation (single-sourced in core controller) ──────────
  interface RegisteredItem {
    value: string
    el: HTMLButtonElement
  }
  let items: RegisteredItem[] = []

  const nav = createKeyboardNav({
    count: items.length,
    loop: true,
    orientation: 'vertical',
  })
  const activeIndex = useStore(nav.store)

  const registerItem = (value: string, el: HTMLButtonElement): (() => void) => {
    if (!items.find((it) => it.value === value)) {
      items = [...items, { value, el }]
      nav.reset(items.length)
    }
    return () => {
      items = items.filter((it) => it.value !== value)
      nav.reset(items.length)
    }
  }

  const focusItem = (value: string): void => {
    const idx = items.findIndex((it) => it.value === value)
    if (idx >= 0) nav.focus(idx)
  }

  const handleKeyDown: JSX.EventHandlerUnion<HTMLDivElement, KeyboardEvent> = (e) => {
    const action: KeyboardNavAction = nav.handleKeyDown({
      key: e.key,
      preventDefault: () => e.preventDefault(),
    })
    if (action.type === 'focus') {
      items[action.target]?.el.focus()
    }
  }

  return (
    <AccordionCtx.Provider
      value={{
        isOpen,
        toggle,
        rootId,
        collapsible: () => local.collapsible,
        multiple: () => local.multiple,
        activeIndex,
        registerItem,
        focusItem,
      }}
    >
      <div
        {...rest}
        data-iris-accordion=""
        data-iris-accordion-multiple={local.multiple ? 'true' : undefined}
        onKeyDown={handleKeyDown}
      >
        {local.children}
      </div>
    </AccordionCtx.Provider>
  )
}

// ── Item ───────────────────────────────────────────────────────────────────

export interface IrisAccordionItemProps {
  value: string
  title?: string
  disabled?: boolean
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
}

export function IrisAccordionItem(props: IrisAccordionItemProps): JSX.Element {
  const [local, rest] = splitProps(props, ['value', 'title', 'disabled', 'children'])
  const ctx = useContext(AccordionCtx)
  if (!ctx) throw new Error('IrisAccordionItem must be used inside <IrisAccordion>')

  const open = (): boolean => ctx.isOpen(local.value)
  const headerId = `${ctx.rootId}-h-${local.value}`
  const contentId = `${ctx.rootId}-c-${local.value}`

  // Register this item's trigger element for keyboard navigation
  let triggerRef: HTMLButtonElement | undefined
  onMount(() => {
    if (triggerRef) onCleanup(ctx.registerItem(local.value, triggerRef))
  })

  const onTrigger = (): void => {
    if (local.disabled) return
    ctx.toggle(local.value)
  }
  const onKeyDown = (e: KeyboardEvent): void => {
    if (local.disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      ctx.toggle(local.value)
    }
  }
  const onFocus = (): void => {
    if (!local.disabled) ctx.focusItem(local.value)
  }

  return (
    <div
      {...rest}
      data-iris-accordion-item=""
      data-state={open() ? 'open' : 'closed'}
      data-disabled={local.disabled ? 'true' : undefined}
      style={{ 'border-bottom': '1px solid var(--iris-border)' }}
    >
      <button
        ref={(el) => {
          triggerRef = el
        }}
        type="button"
        id={headerId}
        data-iris-accordion-trigger=""
        aria-expanded={open() ? 'true' : 'false'}
        aria-controls={contentId}
        disabled={local.disabled}
        onClick={onTrigger}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        style={{
          width: '100%',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          gap: '8px',
          padding: 'var(--iris-padding-md, 12px)',
          background: 'transparent',
          color: 'var(--iris-foreground)',
          border: 'none',
          cursor: local.disabled ? 'not-allowed' : 'pointer',
          opacity: local.disabled ? 0.6 : 1,
          font: 'inherit',
          'text-align': 'start',
        }}
      >
        <span data-iris-accordion-title="" style={{ flex: '1', 'min-width': '0' }}>
          {local.title}
        </span>
        <span
          aria-hidden="true"
          data-iris-accordion-chevron=""
          style={{
            transition: 'transform 160ms ease',
            transform: open() ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--iris-muted)',
          }}
        >
          ⌄
        </span>
      </button>
      <Show when={open()}>
        <div
          role="region"
          id={contentId}
          aria-labelledby={headerId}
          data-iris-accordion-content=""
          style={{ padding: '0 var(--iris-padding-md, 12px) var(--iris-padding-md, 12px)' }}
        >
          {local.children}
        </div>
      </Show>
    </div>
  )
}
