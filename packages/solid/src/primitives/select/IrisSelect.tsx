import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  mergeProps,
  onCleanup,
  Show,
  untrack,
  For,
  type JSX,
} from 'solid-js'
import { Portal } from 'solid-js/web'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { useI18n } from '../../i18n'
import {
  createKeyboardNav,
  createVirtualizer,
  type KeyboardNavAction,
  type Placement,
  type Size,
  type Virtualizer,
  type VirtualizerState,
} from '@iris-ui-kit/core'

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
  /** Framework-neutral change callback. */
  onValueChange?: (value: T) => void
  /** @deprecated Prefer `onValueChange` for cross-framework code. */
  onChange?: (value: T) => void
  placeholder?: string
  size?: IrisSelectSize
  disabled?: boolean
  placement?: Placement
  invalid?: boolean
  id?: string
  ariaDescribedby?: string
  portalTarget?: HTMLElement | false
  style?: JSX.CSSProperties
  /**
   * Opt-in windowed rendering of the listbox via the core virtualizer.
   * When true, only the visible window (+ buffer) of options is rendered;
   * keyboard navigation scrolls the active option into view. Default false.
   */
  virtual?: boolean
}

/** Listbox maxHeight — the virtualizer's viewport (px). */
const LISTBOX_MAX_HEIGHT = 240
/** Fixed per-option row height (px) — option padding 6+6 + 14px line ≈ 32px
 *  plus the 4px inter-row gap; estimate, never measured (combobox approach). */
const ROW_HEIGHT = 36

const SIZE_MAP: Record<IrisSelectSize, { padding: string; fontSize: string; minHeight: string }> = {
  sm: {
    padding: '4px 24px 4px 8px',
    fontSize: 'var(--iris-font-size-xs, 12px)',
    minHeight: '28px',
  },
  md: {
    padding:
      'var(--iris-padding-sm, 6px) var(--iris-space-xl, 24px) var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-md, 14px)',
    minHeight: '34px',
  },
  lg: {
    padding: '8px 32px 8px 12px',
    fontSize: 'var(--iris-font-size-lg, 16px)',
    minHeight: '40px',
  },
}

/**
 * Single-select dropdown. Floating listbox; keyboard nav (Up/Down/Home/End/
 * Enter/Escape + typeahead). Solid port of the Vue IrisSelect.
 */
export function IrisSelect<T = unknown>(props: IrisSelectProps<T>): JSX.Element {
  const merged = mergeProps(
    {
      size: 'md' as IrisSelectSize,
      disabled: false,
      placement: 'bottom-start' as Placement,
      invalid: false,
      virtual: false,
    },
    props,
  )

  const { t } = useI18n()

  const isControlled = (): boolean => props.value !== undefined
  const [internalValue, setInternalValue] = createSignal<T | undefined>(merged.defaultValue)
  const currentValue = (): T | undefined =>
    isControlled() ? (props.value as T) : (internalValue() as T | undefined)

  const selectedItem = createMemo(
    () => merged.items.find((item) => item.value === currentValue()) ?? null,
  )

  const triggerLabel = createMemo(() => {
    const item = selectedItem()
    if (!item) return merged.placeholder ?? t('select.placeholder')
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

  // Read the items prop through a memo: Solid props are getters backed by the
  // parent's JSX expression, so repeated reads (e.g. the virtualizer's O(n)
  // key build) would re-execute the parent's expression per access.
  const itemsMemo = createMemo(() => merged.items)

  // Keyboard navigation (single-sourced in core controller).
  // We keep activeIndex as a local signal for reactive rendering; the controller
  // manages the canonical index and we sync it on each keyboard interaction.
  const labels = createMemo(() => merged.items.map((it) => it.label ?? String(it.value)))
  let nav: ReturnType<typeof createKeyboardNav> | undefined
  const getNav = () => {
    if (!nav || nav.count !== merged.items.length) {
      nav = createKeyboardNav({
        count: merged.items.length,
        loop: true,
        isEnabled,
        labels: labels(),
      })
    }
    return nav
  }

  // ── Virtualized listbox (opt-in) — combobox precedent ────────────────
  // One controller per mount (created lazily, then retained); reactive inputs
  // read untracked through closures so the instance (scroll offset + keyed
  // cache) survives re-renders.
  let vInstance: Virtualizer | null = null
  const virtualizer = createMemo<Virtualizer | null>(() => {
    if (!merged.virtual) return null
    return untrack(() => {
      if (!vInstance) {
        vInstance = createVirtualizer({
          count: 0,
          estimateSize: () => ROW_HEIGHT,
          getItemKey: (i) => String(itemsMemo()[i]?.value ?? i),
          viewportSize: LISTBOX_MAX_HEIGHT,
          buffer: 4,
        })
      }
      return vInstance
    })
  })
  const [vstate, setVstate] = createSignal<VirtualizerState>({
    items: [],
    offsetBefore: 0,
    totalSize: 0,
    startIndex: 0,
    endIndex: -1,
  })
  createEffect(() => {
    const v = virtualizer()
    if (!v) return
    setVstate(() => v.getState())
    const unsub = v.subscribe((next) => setVstate(() => next))
    onCleanup(unsub)
  })
  // Count + scroll clamp: re-runs when the item list (or size) changes.
  createEffect(() => {
    const v = virtualizer()
    if (!v) return
    v.setCount(itemsMemo().length)
    const el = listboxEl
    if (el) {
      const max = Math.max(0, v.totalSize() - LISTBOX_MAX_HEIGHT)
      if (el.scrollTop > max) el.scrollTop = max
    }
  })
  // Windowed options (stale-window guard: skip indices missing from `items`).
  const windowed = createMemo(() => {
    const list = itemsMemo()
    const out: { opt: IrisSelectItem<T>; index: number; key: string | number }[] = []
    for (const item of vstate().items) {
      const opt = list[item.index]
      if (!opt) continue
      out.push({ opt, index: item.index, key: item.key })
    }
    return out
  })

  let listboxEl: HTMLElement | undefined
  // Scroll the active option into view ('auto' semantics: no-op when already
  // fully inside the viewport). Estimates are constant and never measured.
  const ensureVisible = (index: number): void => {
    if (!merged.virtual || !vInstance || index < 0 || index >= itemsMemo().length) return
    const el = listboxEl
    if (!el) return
    const top = el.scrollTop
    const start = index * ROW_HEIGHT
    if (start >= top && start + ROW_HEIGHT <= top + LISTBOX_MAX_HEIGHT) return
    el.scrollTop = vInstance.scrollToIndex(index, start < top ? 'start' : 'end')
  }

  // An opening keypress that already moved the nav index (Solid's ArrowDown
  // open semantics: active = next, not first) must not be clobbered by the
  // open-anchor below.
  let skipAnchorIndex: number | null = null
  // Open: anchor to the selected (or first enabled) option and scroll it into
  // view — the deep-value anchor, unified across the four bridges. Close:
  // reset the controller offset (the DOM listbox remounts per open).
  createEffect(() => {
    if (!merged.virtual) return
    if (!open()) {
      vInstance?.setScroll(0)
      return
    }
    const n = getNav()
    if (skipAnchorIndex !== null) {
      const keep = skipAnchorIndex
      skipAnchorIndex = null
      ensureVisible(keep)
      return
    }
    untrack(() => {
      const selIdx = itemsMemo().findIndex((it) => it.value === currentValue() && !it.disabled)
      if (selIdx >= 0) n.focus(selIdx)
      else n.goFirst()
    })
    setActiveIndex(n.index)
    ensureVisible(n.index)
  })

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (merged.disabled) return
    const n = getNav()
    const openBefore = open()
    const action: KeyboardNavAction = n.handleKeyDown({
      key: e.key,
      preventDefault: () => e.preventDefault(),
    })

    if (action.type === 'select') {
      if (!openBefore && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ')) {
        // Record the override BEFORE setOpen: the anchor effect flushes
        // synchronously when the open signal lands in the test environment.
        skipAnchorIndex = n.index
        setOpen(true)
        setActiveIndex(n.index)
        return
      }
      const item = merged.items[action.target]
      if (item && !item.disabled) selectItem(item)
    } else if (action.type === 'escape') {
      if (openBefore) {
        e.preventDefault()
        setOpen(false)
      }
    } else if (action.type === 'focus' || action.type === 'typeahead') {
      setActiveIndex(action.target)
      if (!openBefore && e.key === 'ArrowDown') {
        skipAnchorIndex = action.target
        setOpen(true)
      }
      ensureVisible(action.target)
    }
  }

  const selectItem = (item: IrisSelectItem<T>): void => {
    if (item.disabled) return
    if (!isControlled()) setInternalValue(() => item.value as T)
    props.onValueChange?.(item.value)
    props.onChange?.(item.value)
    setOpen(false)
  }

  const sz = createMemo(() => SIZE_MAP[merged.size])

  const listboxContent = (): JSX.Element => (
    <div
      ref={(el) => {
        setListbox(el as HTMLElement)
        listboxEl = el as HTMLElement
      }}
      id={listboxId}
      role="listbox"
      aria-label={t('select.options')}
      data-iris-select-listbox=""
      onScroll={(e) => {
        vInstance?.setScroll(e.currentTarget.scrollTop)
      }}
      style={{
        ...floatingStyles(),
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        'border-radius': 'var(--iris-radius-md, 6px)',
        padding: '4px',
        'max-height': '240px',
        'overflow-y': 'auto',
        'box-shadow': 'var(--iris-shadow-lg)',
        'min-width': '180px',
        'z-index': 1000,
      }}
    >
      <Show when={merged.items.length === 0}>
        <div
          data-iris-select-empty=""
          style={{
            padding: 'var(--iris-space-xs, 8px) var(--iris-padding-sm, 6px)',
            color: 'var(--iris-muted)',
            'font-size': 'var(--iris-font-size-sm, 13px)',
            'text-align': 'center',
          }}
        >
          {t('select.empty')}
        </div>
      </Show>
      <Show
        when={virtualizer() !== null && itemsMemo().length > 0}
        fallback={
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
                    padding: 'var(--iris-padding-sm, 6px) var(--iris-space-sm, 12px)',
                    'font-size': sz().fontSize,
                    'border-radius': 'var(--iris-radius-sm, 4px)',
                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                    color: item.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                    background: isSelected()
                      ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
                      : isActive()
                        ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                        : 'transparent',
                    'font-weight': isSelected() ? '600' : '400',
                  }}
                >
                  <span style={{ flex: '1', 'min-width': '0' }}>
                    {item.label ?? String(item.value)}
                  </span>
                  <Show when={isSelected()}>
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--iris-primary)"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </Show>
                </div>
              )
            }}
          </For>
        }
      >
        <div
          role="presentation"
          aria-hidden="true"
          data-iris-select-spacer=""
          data-iris-select-spacer-type="top"
          style={{ height: `${vstate().offsetBefore}px` }}
        />
        <For each={windowed()}>
          {(w) => {
            const isActive = () => w.index === activeIndex()
            const isSelected = () => w.opt.value === currentValue()
            return (
              <div
                role="option"
                aria-selected={isSelected() ? 'true' : 'false'}
                aria-disabled={w.opt.disabled ? 'true' : undefined}
                aria-setsize={merged.items.length}
                aria-posinset={w.index + 1}
                data-iris-select-option=""
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => !w.opt.disabled && setActiveIndex(w.index)}
                onClick={() => selectItem(w.opt)}
                style={{
                  padding: 'var(--iris-padding-sm, 6px) var(--iris-space-sm, 12px)',
                  'font-size': sz().fontSize,
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                  cursor: w.opt.disabled ? 'not-allowed' : 'pointer',
                  color: w.opt.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                  background: isSelected()
                    ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
                    : isActive()
                      ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                      : 'transparent',
                  'font-weight': isSelected() ? '600' : '400',
                }}
              >
                <span style={{ flex: '1', 'min-width': '0' }}>
                  {w.opt.label ?? String(w.opt.value)}
                </span>
                <Show when={isSelected()}>
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--iris-primary)"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </Show>
              </div>
            )
          }}
        </For>
        <div
          role="presentation"
          aria-hidden="true"
          data-iris-select-spacer=""
          data-iris-select-spacer-type="bottom"
          style={{
            height: `${
              vstate().totalSize - vstate().offsetBefore - vstate().items.length * ROW_HEIGHT
            }px`,
          }}
        />
      </Show>
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
        aria-describedby={props.ariaDescribedby}
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
