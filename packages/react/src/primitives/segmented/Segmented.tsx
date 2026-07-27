import * as React from 'react'
import {
  createSelectionModel,
  createKeyboardNav,
  type KeyboardNavController,
  type KeyboardNavAction,
  type SelectionModel,
} from '@iris-ui-kit/core'
import { useStore } from '../../useStore'

export type IrisSegmentedSize = 'sm' | 'md' | 'lg'

export interface IrisSegmentedOption {
  label: string
  value: string
  disabled?: boolean
}

export interface IrisSegmentedProps {
  options: Array<IrisSegmentedOption | string>
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  size?: IrisSegmentedSize
  disabled?: boolean
  /** Stretch to fill the container width. */
  block?: boolean
  ariaLabel?: string
  style?: React.CSSProperties
  className?: string
}

const SIZE_MAP: Record<IrisSegmentedSize, { padding: string; fontSize: number; height: number }> = {
  sm: { padding: '2px 8px', fontSize: 12, height: 24 },
  md: { padding: '4px 12px', fontSize: 14, height: 30 },
  lg: { padding: '6px 16px', fontSize: 16, height: 36 },
}

const normalize = (options: Array<IrisSegmentedOption | string>): IrisSegmentedOption[] =>
  options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o))

/**
 * Segmented control: a connected row of single-select segments with the active
 * one visually raised. Radiogroup semantics with roving tabindex and Arrow /
 * Home / End keyboard navigation — single-sourced in `createKeyboardNav`.
 */
export function IrisSegmented({
  options,
  value,
  defaultValue,
  onValueChange,
  size = 'md',
  disabled = false,
  block = false,
  ariaLabel,
  style,
  className,
}: IrisSegmentedProps): React.ReactElement {
  const safeOptions = options ?? []
  const norm = normalize(safeOptions)
  const isControlled = value !== undefined
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  // Single-selection logic (controlled/uncontrolled) lives in the core model;
  const toKeys = (v: string | undefined): string[] => (v ? [v] : [])
  const modelRef = React.useRef<SelectionModel<string> | null>(null)
  if (modelRef.current === null) {
    modelRef.current = createSelectionModel<string>({
      mode: 'single',
      defaultSelected: toKeys(isControlled ? value : defaultValue),
      onChange: (keys) => onValueChange?.(keys[0] ?? ''),
    })
  }
  const model = modelRef.current
  const currentValue = useStore(model.store)[0] ?? ''

  React.useEffect(() => {
    if (isControlled) model.sync(toKeys(value))
  }, [value, isControlled, model])

  const displayValue = isControlled ? (toKeys(value)[0] ?? '') : currentValue
  const rebaseToProp = (): void => {
    if (isControlled) model.sync(toKeys(value))
  }

  const isOptionEnabled = React.useCallback((i: number) => !norm[i]?.disabled, [norm])
  const selectedIndex = norm.findIndex((o) => o.value === displayValue)

  // Keyboard navigation (single-sourced in core controller)
  const navRef = React.useRef<KeyboardNavController | null>(null)
  if (navRef.current === null) {
    navRef.current = createKeyboardNav({
      count: norm.length,
      loop: true,
      orientation: 'horizontal',
      isEnabled: isOptionEnabled,
      initialIndex: selectedIndex >= 0 ? selectedIndex : undefined,
    })
  }
  const nav = navRef.current

  React.useEffect(() => {
    nav.reset(norm.length)
  })

  const rovingIndex = nav.index

  const select = (i: number) => {
    const opt = norm[i]
    if (!opt || opt.disabled || disabled) return
    rebaseToProp()
    model.set([opt.value])
    refs.current[i]?.focus()
  }

  const sz = SIZE_MAP[size]

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-iris-segmented=""
      data-iris-segmented-size={size}
      data-disabled={disabled ? 'true' : undefined}
      className={className}
      onKeyDown={(e) => {
        const action: KeyboardNavAction = nav.handleKeyDown({
          key: e.key,
          preventDefault: () => e.preventDefault(),
        })
        if (action.type === 'focus' || action.type === 'typeahead') {
          select(action.target)
        }
      }}
      style={{
        display: block ? 'flex' : 'inline-flex',
        width: block ? '100%' : undefined,
        gap: 2,
        padding: 2,
        background: 'var(--iris-surface)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {norm.map((opt, i) => {
        const selected = opt.value === displayValue
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || opt.disabled}
            tabIndex={i === rovingIndex ? 0 : -1}
            data-iris-segmented-item=""
            data-value={opt.value}
            data-selected={selected ? 'true' : undefined}
            onClick={() => select(i)}
            onFocus={() => nav.focus(i)}
            style={{
              flex: block ? 1 : undefined,
              padding: sz.padding,
              minHeight: sz.height,
              fontSize: sz.fontSize,
              fontFamily: 'inherit',
              border: 'none',
              borderRadius: 'var(--iris-radius-sm, 4px)',
              cursor: disabled || opt.disabled ? 'not-allowed' : 'pointer',
              background: selected ? 'var(--iris-background)' : 'transparent',
              color: selected ? 'var(--iris-foreground)' : 'var(--iris-muted)',
              boxShadow: selected ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              fontWeight: selected ? 600 : 400,
              transition: 'background-color 120ms ease, color 120ms ease',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
