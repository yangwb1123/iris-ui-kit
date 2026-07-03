import { createEffect, For, mergeProps, splitProps, type JSX } from 'solid-js'
import {
  createKeyboardNav,
  createSelectionModel,
  nextEnabledIndex,
  type KeyboardNavAction,
} from '@iris-ui/core'
import { useStore } from '../../useStore'

export type IrisSegmentedSize = 'sm' | 'md' | 'lg'

export interface IrisSegmentedOption {
  label: string
  value: string
  disabled?: boolean
}

const SIZE_MAP: Record<IrisSegmentedSize, { padding: string; fontSize: string; height: string }> = {
  sm: { padding: '2px 8px', fontSize: '12px', height: '24px' },
  md: { padding: '4px 12px', fontSize: '14px', height: '30px' },
  lg: { padding: '6px 16px', fontSize: '16px', height: '36px' },
}

function normalize(options: Array<IrisSegmentedOption | string>): IrisSegmentedOption[] {
  return options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o))
}

export interface IrisSegmentedProps {
  options: Array<IrisSegmentedOption | string>
  value?: string
  defaultValue?: string
  size?: IrisSegmentedSize
  disabled?: boolean
  block?: boolean
  ariaLabel?: string
  onChange?: (value: string) => void
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Segmented control. Solid port of the Vue/React IrisSegmented.
 */
export function IrisSegmented(props: IrisSegmentedProps): JSX.Element {
  const merged = mergeProps(
    {
      options: [] as Array<IrisSegmentedOption | string>,
      defaultValue: '',
      size: 'md' as IrisSegmentedSize,
      disabled: false,
      block: false,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'options',
    'value',
    'defaultValue',
    'size',
    'disabled',
    'block',
    'ariaLabel',
    'onChange',
  ])

  const norm = (): IrisSegmentedOption[] => normalize(local.options)

  // Keyboard navigation (single-sourced in core controller).
  const nav = createKeyboardNav({
    count: norm().length,
    loop: false,
    isEnabled: (i) => !norm()[i]?.disabled && !local.disabled,
    orientation: 'horizontal',
  })

  // Keep controller in sync when options change.
  createEffect(() => {
    nav.reset(norm().length)
  })

  // Single-selection logic is single-sourced in the core model; this component
  // only maps its scalar string value to/from the model's flat key array.
  const toKeys = (v: string | undefined): string[] => (v ? [v] : [])
  const model = createSelectionModel<string>({
    mode: 'single',
    defaultSelected: toKeys(local.value !== undefined ? local.value : local.defaultValue),
    onChange: (keys) => local.onChange?.(keys[0] ?? ''),
  })
  const selected = useStore(model.store)

  // Controlled: mirror the prop into the model without re-emitting onChange.
  const isControlled = (): boolean => local.value !== undefined
  createEffect(() => {
    if (isControlled()) model.sync(toKeys(local.value))
  })

  // Controlled segmented RENDERS from the prop (true controlled semantics): a
  // click emits onChange but the active segment only changes when the parent
  // writes `value` back; uncontrolled renders from the model store.
  const currentValue = (): string =>
    isControlled() ? (toKeys(local.value)[0] ?? '') : (selected()[0] ?? '')
  const rebaseToProp = (): void => {
    if (isControlled()) model.sync(toKeys(local.value))
  }

  // Sync nav index with the current value (click or programmatic change).
  createEffect(() => {
    const n = norm()
    const idx = n.findIndex((o) => o.value === currentValue())
    if (idx >= 0) nav.focus(idx)
  })

  const btns: (HTMLButtonElement | null)[] = []

  const select = (options: IrisSegmentedOption[], i: number): void => {
    const opt = options[i]
    if (!opt || opt.disabled || local.disabled) return
    // Re-base on the prop so the emitted next value is computed against what the
    // parent holds (not a prior, possibly-rejected, optimistic value).
    rebaseToProp()
    model.set([opt.value])
    btns[i]?.focus()
  }

  const sz = (): { padding: string; fontSize: string; height: string } => SIZE_MAP[local.size]

  const handleKeyDown: JSX.EventHandlerUnion<HTMLDivElement, KeyboardEvent> = (e) => {
    if (local.disabled) return
    const action: KeyboardNavAction = nav.handleKeyDown({
      key: e.key,
      preventDefault: () => e.preventDefault(),
    })
    if (action.type === 'focus' || action.type === 'select') {
      select(norm(), action.target)
    } else if (action.type === 'next') {
      // ArrowDown in horizontal mode: move to next enabled item.
      const n = norm()
      const cur = nav.index
      if (cur < 0) return
      const next = nextEnabledIndex(cur, 1, n.length, (i) => !n[i]?.disabled)
      if (next >= 0) select(n, next)
    } else if (action.type === 'previous') {
      // ArrowUp in horizontal mode: move to previous enabled item.
      const n = norm()
      const cur = nav.index
      if (cur < 0) return
      const prev = nextEnabledIndex(cur, -1, n.length, (i) => !n[i]?.disabled)
      if (prev >= 0) select(n, prev)
    }
  }

  return (
    <div
      {...rest}
      role="radiogroup"
      aria-label={local.ariaLabel}
      data-iris-segmented=""
      data-iris-segmented-size={local.size}
      data-disabled={local.disabled ? 'true' : undefined}
      onKeyDown={handleKeyDown}
      style={{
        display: local.block ? 'flex' : 'inline-flex',
        width: local.block ? '100%' : undefined,
        gap: '2px',
        padding: '2px',
        background: 'var(--iris-surface, var(--iris-muted, #f4f4f4))',
        'border-radius': 'var(--iris-radius-md, 6px)',
        opacity: local.disabled ? 0.6 : 1,
        ...((rest.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <For each={norm()}>
        {(opt, i) => {
          const selected = (): boolean => opt.value === currentValue()
          const options = norm()
          const selectedIndex = (): number => options.findIndex((o) => o.value === currentValue())
          const firstEnabled = (): number => options.findIndex((o) => !o.disabled)
          const rovingIndex = (): number => {
            const si = selectedIndex()
            return si >= 0 ? si : firstEnabled()
          }

          return (
            <button
              ref={(el) => {
                btns[i()] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected() ? 'true' : 'false'}
              disabled={local.disabled || opt.disabled}
              tabindex={i() === rovingIndex() ? 0 : -1}
              data-iris-segmented-item=""
              data-value={opt.value}
              data-selected={selected() ? 'true' : undefined}
              onClick={() => select(norm(), i())}
              style={{
                flex: local.block ? '1' : undefined,
                padding: sz().padding,
                'min-height': sz().height,
                'font-size': sz().fontSize,
                'font-family': 'inherit',
                border: 'none',
                'border-radius': 'var(--iris-radius-sm, 4px)',
                cursor: local.disabled || opt.disabled ? 'not-allowed' : 'pointer',
                background: selected() ? 'var(--iris-background)' : 'transparent',
                color: selected() ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                'box-shadow': selected() ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                'font-weight': selected() ? '600' : '400',
                transition: 'background-color 120ms ease, color 120ms ease',
                'white-space': 'nowrap',
              }}
            >
              {opt.label}
            </button>
          )
        }}
      </For>
    </div>
  )
}
