import * as React from 'react'
import type { Placement, Size } from '@iris-ui/core'
import { IrisPopover } from '../popover/Popover'
import { IrisPopoverTrigger } from '../popover/PopoverTrigger'
import { IrisPopoverContent } from '../popover/PopoverContent'
import type { IrisSelectItem } from './types'

export type IrisSelectSize = Size

const SIZE_STYLES: Record<IrisSelectSize, { padding: string; fontSize: number; minHeight: number }> = {
  sm: { padding: '4px 24px 4px 8px', fontSize: 12, minHeight: 28 },
  md: { padding: '6px 28px 6px 12px', fontSize: 14, minHeight: 34 },
  lg: { padding: '8px 32px 8px 12px', fontSize: 16, minHeight: 40 },
}

export interface IrisSelectProps<T = unknown> {
  items: IrisSelectItem<T>[]
  value?: T
  defaultValue?: T
  onValueChange?: (value: T) => void
  placeholder?: string
  size?: IrisSelectSize
  disabled?: boolean
  placement?: Placement
  invalid?: boolean
  /** id forwarded to the trigger button. Set by `IrisFormField`. */
  id?: string
  /** Forwarded as `aria-describedby` on the trigger. Set by `IrisFormField`. */
  ariaDescribedby?: string
  /** Custom render for the trigger button. Receives current label + open state. */
  renderTrigger?: (state: { value: T | undefined; label: string; open: boolean }) => React.ReactNode
  style?: React.CSSProperties
  className?: string
}

/**
 * Single-select dropdown. Composes Popover (positioning + dismiss) with an
 * inline listbox (keyboard nav + selection). Each option is `role="option"`
 * inside a `role="listbox"` ul.
 */
export function IrisSelect<T = unknown>({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  placeholder = 'Select…',
  size = 'md',
  disabled = false,
  placement = 'bottom-start',
  invalid = false,
  id,
  ariaDescribedby,
  renderTrigger,
  style,
  className,
}: IrisSelectProps<T>): React.ReactElement {
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<T | undefined>(defaultValue)
  const value = isControlled ? valueProp : internal
  const [open, setOpen] = React.useState(false)

  const selectedItem = items.find((it) => it.value === value) ?? null
  const label = selectedItem ? selectedItem.label ?? String(selectedItem.value) : placeholder

  const setValue = (next: T) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  // Active (focused) option index for arrow-key navigation.
  const enabledIndexes = React.useMemo(
    () => items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i !== -1),
    [items],
  )
  const initialActive = React.useMemo(() => {
    const selIdx = items.findIndex((it) => it.value === value)
    if (selIdx >= 0 && !items[selIdx]?.disabled) return selIdx
    return enabledIndexes[0] ?? -1
  }, [items, value, enabledIndexes])
  const [activeIndex, setActiveIndex] = React.useState(initialActive)

  // Reset activeIndex when opening so focus starts at the selected (or first enabled) item.
  React.useEffect(() => {
    if (open) setActiveIndex(initialActive)
  }, [open, initialActive])

  const listRef = React.useRef<HTMLUListElement | null>(null)

  // When activeIndex changes while open, focus that option.
  React.useEffect(() => {
    if (!open || activeIndex < 0) return
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-iris-select-option-index="${activeIndex}"]`,
    )
    el?.focus()
  }, [open, activeIndex])

  const moveActive = (delta: 1 | -1) => {
    if (enabledIndexes.length === 0) return
    let pos = enabledIndexes.indexOf(activeIndex)
    if (pos === -1) pos = delta > 0 ? -1 : enabledIndexes.length
    let next = pos + delta
    if (next < 0) next = enabledIndexes.length - 1
    if (next >= enabledIndexes.length) next = 0
    setActiveIndex(enabledIndexes[next]!)
  }

  const selectItem = (item: IrisSelectItem<T>) => {
    if (item.disabled) return
    setValue(item.value)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveActive(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveActive(-1)
        break
      case 'Home': {
        e.preventDefault()
        const first = enabledIndexes[0]
        if (first !== undefined) setActiveIndex(first)
        break
      }
      case 'End': {
        e.preventDefault()
        const last = enabledIndexes[enabledIndexes.length - 1]
        if (last !== undefined) setActiveIndex(last)
        break
      }
      case 'Enter':
      case ' ': {
        if (activeIndex >= 0) {
          e.preventDefault()
          const item = items[activeIndex]
          if (item) selectItem(item)
        }
        break
      }
    }
  }

  const sizeStyles = SIZE_STYLES[size]
  const triggerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--iris-gap-sm, 6px)',
    background: 'var(--iris-background)',
    color: selectedItem ? 'var(--iris-foreground)' : 'var(--iris-muted)',
    border: `1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
    borderRadius: 'var(--iris-radius-md, 6px)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    textAlign: 'left',
    fontFamily: 'inherit',
    position: 'relative',
    width: 'auto',
    minWidth: 140,
    padding: sizeStyles.padding,
    fontSize: sizeStyles.fontSize,
    minHeight: sizeStyles.minHeight,
    ...style,
  }

  const triggerNode = renderTrigger ? (
    renderTrigger({ value, label, open })
  ) : (
    <button
      type="button"
      id={id}
      className={className}
      disabled={disabled || undefined}
      data-iris-select-trigger=""
      data-iris-select-size={size}
      data-state={open ? 'open' : 'closed'}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={ariaDescribedby}
      style={triggerStyle}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--iris-muted)',
          pointerEvents: 'none',
        }}
      >
        <path
          d="M4 6l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )

  return (
    <IrisPopover open={open} onOpenChange={setOpen} placement={placement}>
      <IrisPopoverTrigger asChild>{triggerNode as React.ReactElement}</IrisPopoverTrigger>
      <IrisPopoverContent
        autoFocus={false}
        style={{ padding: 'var(--iris-padding-sm, 4px)', minWidth: 180 }}
      >
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Options"
          data-iris-select-listbox=""
          onKeyDown={handleKeyDown}
          tabIndex={-1}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            outline: 'none',
          }}
        >
          {items.map((item, index) => {
            const isSelected = item.value === value
            const isActive = index === activeIndex
            return (
              <li
                key={String(item.value ?? index)}
                role="option"
                tabIndex={isActive ? 0 : -1}
                aria-selected={isSelected}
                aria-disabled={item.disabled ? 'true' : undefined}
                data-iris-select-option=""
                data-iris-select-option-index={index}
                data-state={isSelected ? 'selected' : isActive ? 'active' : 'idle'}
                onClick={item.disabled ? undefined : () => selectItem(item)}
                onFocus={() => setActiveIndex(index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--iris-gap-sm, 6px)',
                  padding: '6px var(--iris-padding-md, 12px)',
                  borderRadius: 'var(--iris-radius-sm, 4px)',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.5 : 1,
                  fontSize: 14,
                  background: isSelected
                    ? 'var(--iris-primary)'
                    : isActive
                      ? 'var(--iris-surface-hover)'
                      : 'transparent',
                  color: isSelected
                    ? 'var(--iris-primary-foreground, #fff)'
                    : 'var(--iris-foreground)',
                  outline: 'none',
                }}
              >
                {item.label ?? String(item.value)}
              </li>
            )
          })}
        </ul>
      </IrisPopoverContent>
    </IrisPopover>
  )
}
