import { createMemo, createSignal, createUniqueId, mergeProps, Show, For, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { firstEnabledIndex, nextEnabledIndex, type Placement, type Size } from '@iris-ui/core'

export type IrisSelectSize = Size

export interface IrisSelectItem<T = unknown> {
  value: T
  label?: string
  disabled?: boolean
}

export interface IrisSelectProps<T = unknown> {
  items: IrisSelectItem<T>[]
  value?: T
  defaultValue?: T
  onChange?: (value: T) => void
  placeholder?: string
  size?: IrisSelectSize
  disabled?: boolean
  placement?: Placement
  invalid?: boolean
  id?: string
  portalTarget?: HTMLElement | false
  style?: JSX.CSSProperties
}

const SIZE_MAP: Record<IrisSelectSize, { padding: string; fontSize: string; minHeight: string }> = {
  sm: { padding: '4px 24px 4px 8px', fontSize: '12px', minHeight: '28px' },
  md: { padding: '6px 28px 6px 12px', fontSize: '14px', minHeight: '34px' },
  lg: { padding: '8px 32px 8px 12px', fontSize: '16px', minHeight: '40px' },
}

/**
 * Single-select dropdown. Floating listbox; keyboard nav (Up/Down/Enter/Escape).
 * Solid port of the Vue IrisSelect.
 */
export function IrisSelect<T = unknown>(props: IrisSelectProps<T>): JSX.Element {
  const merged = mergeProps(
    {
      size: 'md' as IrisSelectSize,
      disabled: false,
      placement: 'bottom-start' as Placement,
      invalid: false,
      placeholder: 'Select...',
    },
    props,
  )

  const isControlled = (): boolean => props.value !== undefined
  const [internalValue, setInternalValue] = createSignal<T | undefined>(merged.defaultValue)
  const currentValue = (): T | undefined =>
    isControlled() ? (props.value as T) : (internalValue() as T | undefined)

  const selectedItem = createMemo(
    () => merged.items.find((item) => item.value === currentValue()) ?? null,
  )

  const triggerLabel = createMemo(() => {
    const item = selectedItem()
    if (!item) return merged.placeholder
    return item.label ?? String(item.value)
  })

  const [open, setOpen] = createSignal(false)
  const [trigger, setTrigger] = createSignal<HTMLElement | undefined>()
  const [listbox, setListbox] = createSignal<HTMLElement | undefined>()
  const listboxId = createUniqueId()
  const [activeIndex, setActiveIndex] = createSignal(-1)

  const { floatingStyles } = useFloating({
    anchor: trigger,
    floating: listbox,
    open,
    placement: merged.placement,
    offset: 4,
  })

  useDismiss({
    enabled: open,
    exclude: [trigger, listbox],
    onDismiss: () => setOpen(false),
    escape: true,
  })

  const isEnabled = (i: number): boolean => !merged.items[i]?.disabled

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (merged.disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open()) {
        setOpen(true)
        setActiveIndex(firstEnabledIndex(merged.items.length, isEnabled))
        return
      }
      setActiveIndex(nextEnabledIndex(activeIndex(), 1, merged.items.length, isEnabled))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open()) return
      setActiveIndex(nextEnabledIndex(activeIndex(), -1, merged.items.length, isEnabled))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!open()) {
        setOpen(true)
        return
      }
      const ai = activeIndex()
      if (ai >= 0) {
        const item = merged.items[ai]
        if (item && !item.disabled) {
          selectItem(item)
        }
      }
    } else if (e.key === 'Escape') {
      if (open()) {
        e.preventDefault()
        setOpen(false)
      }
    }
  }

  const selectItem = (item: IrisSelectItem<T>): void => {
    if (item.disabled) return
    if (!isControlled()) setInternalValue(() => item.value as T)
    props.onChange?.(item.value)
    setOpen(false)
  }

  const sz = createMemo(() => SIZE_MAP[merged.size])

  const listboxContent = (): JSX.Element => (
    <div
      ref={setListbox}
      id={listboxId}
      role="listbox"
      data-iris-select-listbox=""
      style={{
        ...floatingStyles(),
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        'border-radius': 'var(--iris-radius-md, 6px)',
        padding: '4px',
        'max-height': '240px',
        'overflow-y': 'auto',
        'box-shadow': '0 8px 24px rgba(0,0,0,0.12)',
        'min-width': '180px',
        'z-index': 1000,
      }}
    >
      <For each={merged.items}>
        {(item, index) => {
          const i = index()
          const isActive = () => i === activeIndex()
          const isSelected = () => item.value === currentValue()
          return (
            <div
              role="option"
              aria-selected={isSelected() ? 'true' : 'false'}
              aria-disabled={item.disabled ? 'true' : undefined}
              data-iris-select-option=""
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => !item.disabled && setActiveIndex(i)}
              onClick={() => selectItem(item)}
              style={{
                padding: '6px 10px',
                'font-size': sz().fontSize,
                'border-radius': 'var(--iris-radius-sm, 4px)',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                color: item.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                background: isActive()
                  ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                  : 'transparent',
                'font-weight': isSelected() ? '600' : '400',
              }}
            >
              {item.label ?? String(item.value)}
            </div>
          )
        }}
      </For>
    </div>
  )

  return (
    <>
      <button
        ref={setTrigger}
        type="button"
        id={merged.id}
        disabled={merged.disabled || undefined}
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-controls={listboxId}
        aria-invalid={merged.invalid ? 'true' : undefined}
        data-iris-select-trigger=""
        data-iris-select-size={merged.size}
        data-state={open() ? 'open' : 'closed'}
        onKeyDown={handleKeyDown}
        onClick={() => !merged.disabled && setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          'align-items': 'center',
          gap: 'var(--iris-gap-sm)',
          background: 'var(--iris-background)',
          color: selectedItem() ? 'var(--iris-foreground)' : 'var(--iris-muted)',
          border: `1px solid ${merged.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
          'border-radius': 'var(--iris-radius-md)',
          cursor: merged.disabled ? 'not-allowed' : 'pointer',
          opacity: merged.disabled ? '0.6' : '1',
          'text-align': 'start',
          'font-family': 'inherit',
          position: 'relative',
          'min-width': '140px',
          padding: sz().padding,
          'min-height': sz().minHeight,
          'font-size': sz().fontSize,
          ...(merged.style ?? {}),
        }}
      >
        <span style={{ flex: '1', 'min-width': '0' }}>{triggerLabel()}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--iris-muted)',
            'pointer-events': 'none',
          }}
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
      <Show when={open()}>
        <Show when={props.portalTarget !== false} fallback={listboxContent()}>
          <Portal
            mount={props.portalTarget instanceof HTMLElement ? props.portalTarget : undefined}
          >
            {listboxContent()}
          </Portal>
        </Show>
      </Show>
    </>
  )
}
