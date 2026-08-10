import * as React from 'react'
import { useI18n } from '../../i18n'

export type IrisTreeSelectSize = 'sm' | 'md' | 'lg'

export interface IrisTreeSelectNode {
  label: string
  value: string
  disabled?: boolean
  children?: IrisTreeSelectNode[]
}

export interface IrisTreeSelectProps {
  options: IrisTreeSelectNode[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Node values expanded by default. */
  defaultExpanded?: string[]
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  size?: IrisTreeSelectSize
  /** id forwarded to the trigger. Set by `IrisFormField`. */
  id?: string
  ariaDescribedby?: string
  style?: React.CSSProperties
  className?: string
}

const SIZE_MAP: Record<
  IrisTreeSelectSize,
  { padding: string; fontSize: string; minHeight: string }
> = {
  sm: { padding: '4px 8px', fontSize: 'var(--iris-font-size-xs, 12px)', minHeight: '28px' },
  md: {
    padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-md, 14px)',
    minHeight: '34px',
  },
  lg: { padding: '8px 12px', fontSize: 'var(--iris-font-size-lg, 16px)', minHeight: '40px' },
}

function findNode(nodes: IrisTreeSelectNode[], value: string): IrisTreeSelectNode | undefined {
  for (const n of nodes) {
    if (n.value === value) return n
    if (n.children) {
      const found = findNode(n.children, value)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Hierarchical single-select: a trigger that opens a `role="tree"` dropdown
 * with expand/collapse toggles. Selecting a node sets the value and closes.
 * Controlled or uncontrolled; closes on select, Escape, or outside click.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisTreeSelect}.
 */
export function IrisTreeSelect({
  options,
  value,
  defaultValue = '',
  onValueChange,
  defaultExpanded,
  placeholder,
  disabled = false,
  invalid = false,
  size = 'md',
  id,
  ariaDescribedby,
  style,
  className,
  ...rest
}: IrisTreeSelectProps): React.ReactElement {
  const { t } = useI18n()
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState(defaultValue)
  const currentValue = isControlled ? (value as string) : internal
  const [open, setOpen] = React.useState(false)
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(defaultExpanded ?? []))
  const [focused, setFocused] = React.useState(false)
  const [hoveredValue, setHoveredValue] = React.useState<string | null>(null)

  const selected = currentValue ? findNode(options, currentValue) : undefined

  const selectNode = (node: IrisTreeSelectNode) => {
    if (node.disabled) return
    if (!isControlled) setInternal(node.value)
    onValueChange?.(node.value)
    setOpen(false)
  }
  const toggleExpand = (v: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })

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

  const renderNodes = (nodes: IrisTreeSelectNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const hasChildren = !!node.children && node.children.length > 0
      const isExpanded = expanded.has(node.value)
      const isSelected = node.value === currentValue
      return (
        <li
          key={node.value}
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={hasChildren ? isExpanded : undefined}
          data-iris-tree-select-node=""
          data-value={node.value}
          style={{ listStyle: 'none' }}
        >
          <div
            onMouseEnter={() => setHoveredValue(node.value)}
            onMouseLeave={() =>
              setHoveredValue((current) => (current === node.value ? null : current))
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              paddingInlineStart: depth * 16 + 6,
              paddingInlineEnd: 'var(--iris-space-xs, 8px)',
              paddingBlock: 4,
              borderRadius: 'var(--iris-radius-sm, 4px)',
              background:
                isSelected || hoveredValue === node.value
                  ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
                  : 'transparent',
            }}
          >
            {hasChildren ? (
              <button
                type="button"
                data-iris-tree-select-toggle=""
                aria-label={isExpanded ? t('treeSelect.collapse') : t('treeSelect.expand')}
                onClick={() => toggleExpand(node.value)}
                style={{
                  width: 16,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--iris-muted)',
                  fontSize: 'var(--iris-font-size-xs, 12px)',
                }}
              >
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : (
              <span style={{ width: 16, display: 'inline-block' }} />
            )}
            <span
              data-iris-tree-select-label=""
              onClick={() => selectNode(node)}
              style={{
                flex: 1,
                cursor: node.disabled ? 'not-allowed' : 'pointer',
                color: node.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                fontWeight: isSelected ? 600 : 400,
                fontSize: sz.fontSize,
              }}
            >
              {node.label}
            </span>
          </div>
          {hasChildren && isExpanded ? (
            <ul role="group" style={{ margin: 0, padding: 0 }}>
              {renderNodes(node.children!, depth + 1)}
            </ul>
          ) : null}
        </li>
      )
    })

  return (
    <div
      ref={rootRef}
      data-iris-tree-select=""
      data-state={open ? 'open' : 'closed'}
      className={className}
      {...rest}
      style={{ position: 'relative', display: 'inline-block', minWidth: 220, ...style }}
    >
      <button
        type="button"
        id={id}
        data-iris-tree-select-trigger=""
        aria-haspopup="tree"
        aria-expanded={open}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedby}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.preventDefault()
            setOpen(false)
          } else if ((e.key === 'ArrowDown' || e.key === 'Enter') && !open) {
            e.preventDefault()
            setOpen(true)
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
          color: selected ? 'var(--iris-foreground)' : 'var(--iris-muted)',
          background: 'var(--iris-background)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--iris-radius-md, 6px)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          outline: 'none',
        }}
      >
        <span data-iris-tree-select-value="">
          {selected ? selected.label : (placeholder ?? t('select.placeholder'))}
        </span>
        <span
          aria-hidden="true"
          style={{ color: 'var(--iris-muted)', fontSize: 'var(--iris-font-size-xs, 12px)' }}
        >
          ▾
        </span>
      </button>
      {open ? (
        <ul
          role="tree"
          data-iris-tree-select-tree=""
          style={{
            position: 'absolute',
            insetInlineStart: 0,
            insetInlineEnd: 0,
            top: '100%',
            marginBlockStart: 4,
            maxHeight: 280,
            overflowY: 'auto',
            margin: 0,
            padding: 4,
            zIndex: 50,
            background: 'var(--iris-background)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            boxShadow: 'var(--iris-shadow-lg)',
          }}
        >
          {renderNodes(options, 0)}
        </ul>
      ) : null}
    </div>
  )
}
