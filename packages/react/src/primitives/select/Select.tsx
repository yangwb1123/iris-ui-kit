import * as React from 'react'
import {
  createKeyboardNav,
  type KeyboardNavController,
  type KeyboardNavAction,
  type Placement,
  type Size,
} from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { useStore } from '../../useStore'
import { IrisPopover } from '../popover/Popover'
import { IrisPopoverTrigger } from '../popover/PopoverTrigger'
import { IrisPopoverContent } from '../popover/PopoverContent'
import type { IrisSelectItem } from './types'

export type IrisSelectSize = Size

const SIZE_STYLES: Record<
  IrisSelectSize,
  { padding: string; fontSize: string; minHeight: number }
> = {
  sm: { padding: '4px 24px 4px 8px', fontSize: 'var(--iris-font-size-xs, 12px)', minHeight: 28 },
  md: {
    padding:
      'var(--iris-padding-sm, 6px) var(--iris-space-xl, 24px) var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-md, 14px)',
    minHeight: 34,
  },
  lg: { padding: '8px 32px 8px 12px', fontSize: 'var(--iris-font-size-lg, 16px)', minHeight: 40 },
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
 * inline listbox (keyboard nav + selection). Arrow-key, typeahead, Home/End, and
 * Enter/Space navigation are single-sourced in `createKeyboardNav` (core).
 *
 * @example
 *   <IrisSelect
 *     items={[{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }]}
 *     value={fruit}
 *     onValueChange={setFruit}
 *     placeholder="Pick a fruit"
 *   />
 */
export function IrisSelect<T = unknown>({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  placeholder,
  size = 'md',
  disabled = false,
  placement = 'bottom-start',
  invalid = false,
  id,
  ariaDescribedby,
  renderTrigger,
  style,
  className,
  ...rest
}: IrisSelectProps<T>): React.ReactElement {
  const { t } = useI18n()
  const safeItems = items ?? []
  const resolvedPlaceholder = placeholder ?? t('select.placeholder')
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<T | undefined>(defaultValue)
  const value = isControlled ? valueProp : internal
  const [open, setOpen] = React.useState(false)

  const selectedItem = safeItems.find((it) => it.value === value) ?? null
  const label = selectedItem
    ? (selectedItem.label ?? String(selectedItem.value))
    : resolvedPlaceholder

  const setValue = (next: T) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  // ── Keyboard navigation (single-sourced in core controller) ────────────
  const isEnabled = React.useCallback((i: number) => !safeItems[i]?.disabled, [safeItems])
  const labels = React.useMemo(
    () => safeItems.map((it) => it.label ?? String(it.value)),
    [safeItems],
  )

  const navRef = React.useRef<KeyboardNavController | null>(null)
  if (navRef.current === null) {
    // Initial active index: selected item, or first enabled
    const selIdx = safeItems.findIndex((it) => it.value === value)
    const initial = selIdx >= 0 && !safeItems[selIdx]?.disabled ? selIdx : undefined
    navRef.current = createKeyboardNav({
      count: safeItems.length,
      loop: true,
      isEnabled,
      labels,
      initialIndex: initial,
    })
  }
  const nav = navRef.current

  // Re-center on the selected item when items change
  React.useEffect(() => {
    nav.reset(safeItems.length)
  })

  // Reset active index when opening so focus starts at the selected (or first enabled) item.
  React.useEffect(() => {
    if (open) {
      const selIdx = safeItems.findIndex((it) => it.value === value)
      if (selIdx >= 0 && !safeItems[selIdx]?.disabled) {
        nav.focus(selIdx)
      } else {
        nav.goFirst()
      }
    }
  }, [open, safeItems, value, nav])

  const activeIndex = useStore(nav.store)

  const listRef = React.useRef<HTMLUListElement | null>(null)

  // When activeIndex changes while open, focus that option.
  React.useEffect(() => {
    if (!open || activeIndex < 0) return
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-iris-select-option-index="${activeIndex}"]`,
    )
    el?.focus()
  }, [open, activeIndex])

  const selectItem = (item: IrisSelectItem<T>) => {
    if (item.disabled) return
    setValue(item.value)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const action: KeyboardNavAction = nav.handleKeyDown({
      key: e.key,
      preventDefault: () => e.preventDefault(),
    })
    if (action.type === 'select') {
      const item = safeItems[action.target]
      if (item) selectItem(item)
    }
    // Escape is implicitly handled by Popover's dismiss
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
    textAlign: 'start',
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
      // A select opens a listbox, not a generic dialog — override the popover
      // trigger's default aria-haspopup="dialog" (child props win in IrisSlot).
      aria-haspopup="listbox"
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={ariaDescribedby}
      {...rest}
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
          aria-label={t('select.options')}
          data-iris-select-listbox=""
          onKeyDown={handleKeyDown}
          tabIndex={-1}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--iris-space-xxs, 4px)',
            outline: 'none',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {safeItems.length === 0 ? (
            <li
              data-iris-select-empty=""
              style={{
                padding: 'var(--iris-space-xs, 8px) var(--iris-padding-sm, 6px)',
                color: 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-sm, 13px)',
                textAlign: 'center' as const,
              }}
            >
              {t('select.empty')}
            </li>
          ) : null}
          {safeItems.map((item, index) => {
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
                onFocus={() => nav.focus(index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--iris-gap-sm, 6px)',
                  padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
                  borderRadius: 'var(--iris-radius-sm, 4px)',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.5 : 1,
                  fontSize: 'var(--iris-font-size-md, 14px)',
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
