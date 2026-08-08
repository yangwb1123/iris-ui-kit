import * as React from 'react'
import {
  createKeyboardNav,
  createVirtualizer,
  type KeyboardNavController,
  type KeyboardNavAction,
  type Placement,
  type Size,
  type Virtualizer,
} from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { useStore } from '../../useStore'
import { IrisPopover } from '../popover/Popover'
import { IrisPopoverTrigger } from '../popover/PopoverTrigger'
import { IrisPopoverContent } from '../popover/PopoverContent'
import type { IrisSelectItem } from './types'

export type IrisSelectSize = Size

/**
 * State handed to `renderTrigger`. Additive superset of the historical
 * `{ value, label, open }` — existing destructuring callers keep compiling.
 */
export interface IrisSelectTriggerState<T = unknown> {
  value: T | undefined
  label: string
  open: boolean
  /** Forwarded from the `id` prop; set by `IrisFormField`. */
  id?: string
  /** Forwarded from the `ariaDescribedby` prop; set by `IrisFormField`. */
  ariaDescribedby?: string
  /** Always present; `true` when the FormField (or caller) marks invalid. */
  invalid: boolean
  /** Always present; `true` when the select is disabled. */
  disabled: boolean
}

/** Listbox maxHeight — the virtualizer's viewport (px). */
const LISTBOX_MAX_HEIGHT = 240
/**
 * Fixed per-option row height (px) — option padding 6+6 + 14px line ≈ 32px
 * plus the 4px inter-row gap. A single constant (options use a fixed 14px
 * font in every size), never measured — the combobox estimate approach.
 */
const ROW_HEIGHT = 36

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
  /** Single value, or an array when `multiple`. */
  value?: T | T[]
  defaultValue?: T | T[]
  onValueChange?: (value: T | T[]) => void
  /** Allow selecting multiple options (values become arrays). */
  multiple?: boolean
  placeholder?: string
  size?: IrisSelectSize
  disabled?: boolean
  placement?: Placement
  invalid?: boolean
  /** id forwarded to the trigger button. Set by `IrisFormField`. */
  id?: string
  /** Forwarded as `aria-describedby` on the trigger. Set by `IrisFormField`. */
  ariaDescribedby?: string
  /** Custom render for the trigger button. Receives label + open state plus
   *  the form wiring (`id` / `ariaDescribedby` / `invalid` / `disabled`). */
  renderTrigger?: (state: IrisSelectTriggerState<T>) => React.ReactNode
  style?: React.CSSProperties
  className?: string
  /**
   * Opt-in windowed rendering of the listbox via the core virtualizer.
   * When true, only the visible window (+ buffer) of options is rendered;
   * keyboard navigation scrolls the active option into view. Default false.
   */
  virtual?: boolean
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
  multiple = false,
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
  virtual = false,
  ...rest
}: IrisSelectProps<T>): React.ReactElement {
  const { t } = useI18n()
  const safeItems = items ?? []
  const resolvedPlaceholder = placeholder ?? t('select.placeholder')
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<T | T[] | undefined>(defaultValue)
  const value = isControlled ? valueProp : internal
  const selectedValues: T[] = multiple
    ? Array.isArray(value)
      ? (value as T[])
      : value !== undefined
        ? [value as T]
        : []
    : []
  const [open, setOpen] = React.useState(false)

  // Typeahead-open target, consumed (read + cleared) by the open-reset effect
  // below so a typeahead match isn't clobbered by re-anchoring to the selected
  // item. Freshly set on every open-producing keydown ⇒ never stale.
  const pendingOpenTargetRef = React.useRef<number | null>(null)

  const selectedItems = multiple
    ? safeItems.filter((it) => selectedValues.includes(it.value))
    : (safeItems.find((it) => it.value === value) ?? null)
  const label = Array.isArray(selectedItems)
    ? selectedItems.length > 0
      ? selectedItems.map((it) => it.label ?? String(it.value)).join(', ')
      : resolvedPlaceholder
    : selectedItems
      ? (selectedItems.label ?? String(selectedItems.value))
      : resolvedPlaceholder

  const setValue = (next: T | T[]) => {
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
      // A typeahead-open already emitted its match to the store — skip the reset.
      const pending = pendingOpenTargetRef.current
      pendingOpenTargetRef.current = null
      if (pending !== null) return
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

  // ── Virtualized listbox (opt-in) — combobox precedent ────────────────
  // One controller per mount; reactive inputs read through refs so the
  // instance (scroll offset + keyed cache) survives renders, exactly like
  // IrisCombobox / IrisVirtualScroll.
  const safeItemsRef = React.useRef(safeItems)
  safeItemsRef.current = safeItems
  const virtualizer = React.useMemo<Virtualizer>(
    () =>
      createVirtualizer({
        count: 0,
        estimateSize: () => ROW_HEIGHT,
        getItemKey: (i) => String(safeItemsRef.current[i]?.value ?? i),
        viewportSize: LISTBOX_MAX_HEIGHT,
        buffer: 4,
      }),
    [],
  )
  const vstate = React.useSyncExternalStore(virtualizer.subscribe, virtualizer.getState)
  const [listScrollTop, setListScrollTop] = React.useState(0)

  // L1 (sync layout): push count + scroll into the controller pre-paint and
  // re-clamp the DOM scrollTop when the list shrinks (combobox A8.3).
  React.useLayoutEffect(() => {
    if (!virtual) return
    virtualizer.setCount(safeItems.length)
    virtualizer.setScroll(listScrollTop)
    const el = listRef.current
    if (el) {
      const max = Math.max(0, virtualizer.totalSize() - LISTBOX_MAX_HEIGHT)
      if (el.scrollTop > max) el.scrollTop = max
    }
  }, [virtual, virtualizer, safeItems.length, listScrollTop])

  // L2 (sync layout): scroll the active option into view ('auto' semantics:
  // no-op when already fully inside the viewport). Estimates are constant
  // and never measured, so `start = index × rowHeight` is exact. Runs before
  // the passive focus effect below, so the focus effect always sees the
  // option already in the (post-scroll) DOM.
  React.useLayoutEffect(() => {
    if (!virtual || !open || activeIndex < 0) return
    const el = listRef.current
    if (!el) return
    const top = el.scrollTop
    const start = activeIndex * ROW_HEIGHT
    if (start >= top && start + ROW_HEIGHT <= top + LISTBOX_MAX_HEIGHT) return
    const target = virtualizer.scrollToIndex(activeIndex, start < top ? 'start' : 'end')
    el.scrollTop = target
    setListScrollTop(target)
  }, [virtual, open, activeIndex, virtualizer])

  // The listbox unmounts per open (PopoverContent returns null when closed),
  // so the DOM scrollTop resets naturally — but the controller's internal
  // offset must reset too, else the next open re-windows mid-list (A3.4).
  React.useEffect(() => {
    if (!open) setListScrollTop(0)
  }, [open])

  // When activeIndex changes while open, focus that option. In virtual mode
  // the deps include `listScrollTop` (the scroll-triggered window commit from
  // L2): the effect re-runs only after the option has been rendered into the
  // DOM, so the null pre-scroll querySelector result is never acted on.
  // `preventScroll` keeps wheel-driven window shifts from being fought by
  // refocusing (the row is already in view after a nav scroll).
  React.useEffect(() => {
    if (!open || activeIndex < 0) return
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-iris-select-option-index="${activeIndex}"]`,
    )
    el?.focus(virtual ? { preventScroll: true } : undefined)
  }, [open, activeIndex, virtual, listScrollTop])

  const selectItem = (item: IrisSelectItem<T>) => {
    if (item.disabled) return
    if (multiple) {
      const exists = selectedValues.includes(item.value)
      const next = exists
        ? selectedValues.filter((v) => v !== item.value)
        : [...selectedValues, item.value]
      setValue(next)
      // Keep the popover open for multi-select; closing only on outside click.
      return
    }
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

  // Closed-trigger keyboard (combobox pattern, trigger half): ArrowDown and
  // typeahead open the popover via the shared core keymap; all other keys are
  // left untouched so native Space/Enter button activation still toggles.
  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (disabled || open) return
    const action: KeyboardNavAction = nav.handleClosedKeyDown({
      key: e.key,
      preventDefault: () => e.preventDefault(),
    })
    if (action.type === 'open') {
      pendingOpenTargetRef.current = action.target ?? null
      setOpen(true)
    }
  }

  const sizeStyles = SIZE_STYLES[size]
  const triggerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--iris-gap-sm, 6px)',
    background: 'var(--iris-background)',
    color: selectedItems ? 'var(--iris-foreground)' : 'var(--iris-muted)',
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

  // Shared option renderer: the virtual path renders the same node (plus
  // virtual-list ARIA) so the visible window keeps today's selectors.
  const renderOption = (item: IrisSelectItem<T>, index: number, windowed: boolean) => {
    const isSelected = multiple ? selectedValues.includes(item.value) : item.value === value
    const isActive = index === activeIndex
    return (
      <li
        key={String(item.value ?? index)}
        role="option"
        tabIndex={isActive ? 0 : -1}
        aria-selected={isSelected}
        aria-disabled={item.disabled ? 'true' : undefined}
        aria-setsize={windowed ? safeItems.length : undefined}
        aria-posinset={windowed ? index + 1 : undefined}
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
            ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
            : isActive
              ? 'var(--iris-surface-hover)'
              : 'transparent',
          color: 'var(--iris-foreground)',
          fontWeight: isSelected ? 600 : 400,
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>{item.label ?? String(item.value)}</span>
        {isSelected ? (
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--iris-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </li>
    )
  }

  const triggerNode = renderTrigger ? (
    renderTrigger({
      value: value as T | undefined,
      label,
      open,
      id,
      ariaDescribedby,
      invalid,
      disabled,
    })
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
      <IrisPopoverTrigger asChild onKeyDown={handleTriggerKeyDown}>
        {triggerNode as React.ReactElement}
      </IrisPopoverTrigger>
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
          onScroll={(e) => {
            if (!virtual) return
            setListScrollTop(e.currentTarget.scrollTop)
          }}
          tabIndex={-1}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            // Virtual mode drops the inter-row gap: ROW_HEIGHT already
            // includes the 4px spacing, so the spacer-sum invariant is exact.
            ...(virtual ? {} : { gap: 'var(--iris-space-xxs, 4px)' }),

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
          ) : virtual ? (
            <>
              <li
                role="presentation"
                aria-hidden="true"
                data-iris-select-spacer=""
                data-iris-select-spacer-type="top"
                style={{ height: vstate.offsetBefore }}
              />
              {vstate.items.map((item) => {
                const opt = safeItems[item.index]
                if (!opt) return null
                return renderOption(opt, item.index, true)
              })}
              <li
                role="presentation"
                aria-hidden="true"
                data-iris-select-spacer=""
                data-iris-select-spacer-type="bottom"
                style={{
                  height: vstate.totalSize - vstate.offsetBefore - vstate.items.length * ROW_HEIGHT,
                }}
              />
            </>
          ) : (
            safeItems.map((item, index) => renderOption(item, index, false))
          )}
        </ul>
      </IrisPopoverContent>
    </IrisPopover>
  )
}
