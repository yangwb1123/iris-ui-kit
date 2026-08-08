import * as React from 'react'
import { useI18n } from '../../i18n'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'

export type IrisCascaderSize = 'sm' | 'md' | 'lg'

export interface IrisCascaderNode {
  label: string
  value: string
  disabled?: boolean
  children?: IrisCascaderNode[]
}

export interface IrisCascaderProps {
  options: IrisCascaderNode[]
  /** Selected path of values. */
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (path: string[]) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  /** Separator between path labels in the trigger. */
  separator?: string
  size?: IrisCascaderSize
  /**
   * Opt-in: window each open column with the core virtualizer instead of
   * rendering every option. Fixed deterministic sizing (viewport 240px, row
   * height per size, buffer 4). Default false — no behavior change.
   */
  virtual?: boolean
  id?: string
  ariaDescribedby?: string
  style?: React.CSSProperties
  className?: string
}

const SIZE_MAP: Record<IrisCascaderSize, { padding: string; fontSize: string; minHeight: string }> =
  {
    sm: { padding: '4px 8px', fontSize: 'var(--iris-font-size-xs, 12px)', minHeight: '28px' },
    md: {
      padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
      fontSize: 'var(--iris-font-size-md, 14px)',
      minHeight: '34px',
    },
    lg: { padding: '8px 12px', fontSize: 'var(--iris-font-size-lg, 16px)', minHeight: '40px' },
  }

/** Matches the current `maxHeight: 240` of a column. */
const CASCADER_COLUMN_VIEWPORT = 240
/** Fixed row heights, aligned with SIZE_MAP minHeights so rows never clip. */
const CASCADER_ROW_HEIGHT: Record<IrisCascaderSize, number> = { sm: 28, md: 34, lg: 40 }
/** Extra rows rendered above and below the visible window. */
const CASCADER_VIRTUAL_BUFFER = 4

/** Labels along a value path (stops at the first missing node). */
function pathLabels(options: IrisCascaderNode[], path: string[]): string[] {
  const labels: string[] = []
  let level = options
  for (const v of path) {
    const node = level.find((n) => n.value === v)
    if (!node) break
    labels.push(node.label)
    level = node.children ?? []
  }
  return labels
}

/** The columns of nodes to render for the active navigation path. */
function buildColumns(options: IrisCascaderNode[], activePath: string[]): IrisCascaderNode[][] {
  const cols: IrisCascaderNode[][] = [options]
  let level = options
  for (const v of activePath) {
    const node = level.find((n) => n.value === v)
    if (!node || !node.children || node.children.length === 0) break
    level = node.children
    cols.push(level)
  }
  return cols
}

/**
 * Cascader: a hierarchical select that drills down through columns — choosing a
 * branch reveals its children in the next column; choosing a leaf commits the
 * full path. Controlled or uncontrolled; closes on leaf-select, Escape, or
 * outside click.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisCascader}.
 */
export function IrisCascader({
  options,
  value,
  defaultValue = [],
  onValueChange,
  placeholder,
  disabled = false,
  invalid = false,
  separator = ' / ',
  size = 'md',
  virtual = false,
  id,
  ariaDescribedby,
  style,
  className,
  ...rest
}: IrisCascaderProps): React.ReactElement {
  const { t } = useI18n()
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<string[]>(defaultValue)
  const currentValue = isControlled ? (value as string[]) : internal
  const [open, setOpen] = React.useState(false)
  const [activePath, setActivePath] = React.useState<string[]>(defaultValue)
  const [focused, setFocused] = React.useState(false)

  const columns = buildColumns(options, activePath)
  const labels = pathLabels(options, currentValue)

  const toggleOpen = () => {
    if (disabled) return
    setOpen((o) => {
      if (!o) setActivePath(currentValue)
      return !o
    })
  }

  const selectOption = (colIndex: number, node: IrisCascaderNode) => {
    if (node.disabled) return
    const nextPath = [...activePath.slice(0, colIndex), node.value]
    setActivePath(nextPath)
    const hasChildren = !!node.children && node.children.length > 0
    if (!hasChildren) {
      if (!isControlled) setInternal(nextPath)
      onValueChange?.(nextPath)
      setOpen(false)
    }
  }

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const sz = SIZE_MAP[size]
  const borderColor = invalid
    ? 'var(--iris-danger)'
    : focused || open
      ? 'var(--iris-primary)'
      : 'var(--iris-border)'

  // Shared option renderer — used by BOTH the plain and the virtual column
  // paths so the a11y attribute surface is structurally identical. When
  // virtual, the virtualizer pins each row's height, so the option fills the
  // row (height 100% + border-box keeps the padding inside the pinned height).
  const renderOption = (node: IrisCascaderNode, ci: number): React.ReactElement => {
    const isActive = activePath[ci] === node.value
    const hasChildren = !!node.children && node.children.length > 0
    return (
      <li
        key={node.value}
        role="option"
        aria-selected={isActive}
        aria-disabled={node.disabled ? 'true' : undefined}
        data-iris-cascader-option=""
        data-value={node.value}
        onClick={() => selectOption(ci, node)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
          fontSize: sz.fontSize,
          borderRadius: 'var(--iris-radius-sm, 4px)',
          cursor: node.disabled ? 'not-allowed' : 'pointer',
          color: node.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
          background: isActive ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))' : 'transparent',
          ...(virtual ? { height: '100%', boxSizing: 'border-box' } : null),
        }}
      >
        <span>{node.label}</span>
        {hasChildren ? (
          <span
            aria-hidden="true"
            style={{
              color: 'var(--iris-muted)',
              fontSize: 'var(--iris-font-size-xs, 12px)',
            }}
          >
            ›
          </span>
        ) : null}
      </li>
    )
  }

  const columnStyle = (ci: number): React.CSSProperties => ({
    minWidth: 140,
    borderInlineStart: ci > 0 ? '1px solid var(--iris-border)' : undefined,
  })

  return (
    <div
      ref={rootRef}
      data-iris-cascader=""
      data-state={open ? 'open' : 'closed'}
      className={className}
      {...rest}
      style={{ position: 'relative', display: 'inline-block', minWidth: 240, ...style }}
    >
      <button
        type="button"
        id={id}
        data-iris-cascader-trigger=""
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedby}
        disabled={disabled}
        onClick={toggleOpen}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.preventDefault()
            setOpen(false)
          } else if ((e.key === 'ArrowDown' || e.key === 'Enter') && !open) {
            e.preventDefault()
            toggleOpen()
          }
        }}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: sz.padding,
          minHeight: sz.minHeight,
          fontSize: sz.fontSize,
          fontFamily: 'inherit',
          textAlign: 'start',
          color: labels.length ? 'var(--iris-foreground)' : 'var(--iris-muted)',
          background: 'var(--iris-background)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--iris-radius-md, 6px)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          outline: 'none',
        }}
      >
        <span data-iris-cascader-value="">
          {labels.length ? labels.join(separator) : (placeholder ?? t('select.placeholder'))}
        </span>
        <span
          aria-hidden="true"
          style={{ color: 'var(--iris-muted)', fontSize: 'var(--iris-font-size-xs, 12px)' }}
        >
          ▾
        </span>
      </button>
      {open ? (
        <div
          data-iris-cascader-panel=""
          style={{
            position: 'absolute',
            insetInlineStart: 0,
            top: '100%',
            marginBlockStart: 4,
            display: 'flex',
            zIndex: 50,
            background: 'var(--iris-background)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            boxShadow: 'var(--iris-shadow-lg)',
            overflow: 'hidden',
          }}
        >
          {columns.map((col, ci) => {
            if (!virtual) {
              return (
                <ul
                  key={ci}
                  role="listbox"
                  data-iris-cascader-column=""
                  data-level={ci}
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 4,
                    ...columnStyle(ci),
                    maxHeight: CASCADER_COLUMN_VIEWPORT,
                    overflowY: 'auto',
                  }}
                >
                  {col.map((node) => renderOption(node, ci))}
                </ul>
              )
            }
            return (
              <IrisVirtualScroll
                key={ci}
                items={col}
                itemHeight={CASCADER_ROW_HEIGHT[size]}
                height={CASCADER_COLUMN_VIEWPORT}
                buffer={CASCADER_VIRTUAL_BUFFER}
                keyOf={(node: IrisCascaderNode) => node.value}
                renderItem={(node: IrisCascaderNode) => renderOption(node, ci)}
                role="listbox"
                data-iris-cascader-column=""
                data-level={ci}
                style={columnStyle(ci)}
              />
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
