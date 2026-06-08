import * as React from 'react'
import {
  branchTrail,
  createExpansion,
  findNavNode,
  findNavPath,
  firstLeaf,
  isBranch,
  visibleNav,
  type ExpansionModel,
  type NavNode,
} from '@iris-ui/core'
import { useStore } from '../useStore'
import { IrisIcon } from '../primitives/icon/Icon'

export interface IrisNavMenuProps {
  /** Normalized nav tree. */
  items: NavNode[]
  /** Key of the active leaf. */
  activeKey?: string
  /** Controlled expanded branch keys. */
  expandedKeys?: string[]
  /** Initial expanded keys when uncontrolled (else the active trail expands). */
  defaultExpandedKeys?: string[]
  /** Icon-only rail (top-level items only). */
  collapsed?: boolean
  ariaLabel?: string
  onSelect?: (key: string, node: NavNode) => void
  onExpandedKeysChange?: (keys: string[]) => void
}

/**
 * Data-driven nested navigation menu — the sidebar nav of the admin shell.
 * Renders a normalized `NavNode[]` tree as an accordion of expandable branches
 * and selectable leaves; the active leaf and its ancestor branches are
 * highlighted, and the active branch trail auto-expands. Router-agnostic: takes
 * `activeKey`, calls `onSelect(key, node)`; the host owns navigation.
 *
 * `collapsed` switches to an icon-only rail (top-level only); a branch click
 * then jumps to its first leaf. React port of the Vue `IrisNavMenu`.
 */
export function IrisNavMenu({
  items,
  activeKey,
  expandedKeys,
  defaultExpandedKeys,
  collapsed = false,
  ariaLabel = 'Main navigation',
  onSelect,
  onExpandedKeysChange,
}: IrisNavMenuProps): React.ReactElement {
  // Expand/collapse state lives in the core expansion model — the open-set algebra
  // and the active-trail union (`merge`) are byte-identical across every adapter, so
  // they live in @iris-ui/core. This component keeps only the controlled/uncontrolled
  // wiring: uncontrolled reads + writes the model store; controlled mirrors the
  // `expandedKeys` prop and just notifies. `branchTrail` is the shared selector.
  const trailOf = React.useCallback(
    (key: string | undefined): string[] => (key ? branchTrail(items, key) : []),
    [items],
  )

  const isControlled = expandedKeys !== undefined
  const modelRef = React.useRef<ExpansionModel | null>(null)
  if (modelRef.current === null) {
    modelRef.current = createExpansion({
      mode: 'multiple',
      defaultExpanded: defaultExpandedKeys ?? trailOf(activeKey),
    })
  }
  const model = modelRef.current
  const internalExpanded = useStore(model.store)
  const expanded = isControlled ? (expandedKeys as string[]) : internalExpanded

  // Auto-open the active branch trail as the active leaf changes (uncontrolled).
  // `merge` unions without removals and is a no-op when the trail is already open,
  // and the model has no `onChange` wired, so this never emits onExpandedKeysChange.
  React.useEffect(() => {
    if (isControlled) return
    model.merge(trailOf(activeKey))
  }, [activeKey, isControlled, model, trailOf])

  const setExpanded = (keys: string[]): void => {
    if (!isControlled) model.set(keys)
    onExpandedKeysChange?.(keys)
  }
  const toggle = (key: string): void =>
    setExpanded(expanded.includes(key) ? expanded.filter((k) => k !== key) : [...expanded, key])

  const select = (node: NavNode): void => {
    if (node.disabled) return
    onSelect?.(node.key, node)
  }

  const [hovered, setHovered] = React.useState<string | null>(null)
  const tree = visibleNav(items)
  const activePath = activeKey ? findNavPath(items, activeKey).map((n) => n.key) : []

  const itemStyle = (opts: {
    depth: number
    active: boolean
    trail: boolean
    disabled: boolean
    hovered: boolean
  }): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    boxSizing: 'border-box',
    border: 'none',
    borderRadius: 'var(--iris-radius-md, 6px)',
    background: opts.active
      ? 'var(--iris-primary)'
      : opts.hovered && !opts.disabled
        ? 'var(--iris-surface)'
        : 'transparent',
    color: opts.active
      ? 'var(--iris-primary-foreground, #fff)'
      : opts.trail
        ? 'var(--iris-primary)'
        : 'var(--iris-foreground)',
    font: 'inherit',
    fontSize: 14,
    fontWeight: opts.active || opts.trail ? 600 : 400,
    textAlign: 'start',
    cursor: opts.disabled ? 'not-allowed' : 'pointer',
    opacity: opts.disabled ? 0.5 : 1,
    padding: collapsed ? 10 : `8px 10px 8px ${12 + opts.depth * 16}px`,
    justifyContent: collapsed ? 'center' : 'flex-start',
  })

  const iconNode = (node: NavNode, size = 18): React.ReactElement | null =>
    node.icon ? <IrisIcon name={node.icon} size={size} /> : null

  const badgeNode = (node: NavNode): React.ReactElement | null =>
    node.badge !== undefined && node.badge !== '' && !collapsed ? (
      <span
        data-iris-nav-badge=""
        style={{
          marginInlineStart: 'auto',
          fontSize: 11,
          lineHeight: 1,
          padding: '2px 6px',
          borderRadius: 999,
          background: 'var(--iris-danger, #e5484d)',
          color: '#fff',
        }}
      >
        {String(node.badge)}
      </span>
    ) : null

  const hoverProps = (key: string) => ({
    onMouseEnter: () => setHovered(key),
    onMouseLeave: () => setHovered((h) => (h === key ? null : h)),
  })

  // Collapsed rail: top-level items only, icon + native tooltip; branch → first leaf.
  const renderCollapsed = (node: NavNode): React.ReactElement => {
    const branch = isBranch(node)
    const active = branch ? activePath.includes(node.key) : node.key === activeKey
    return (
      <button
        key={node.key}
        type="button"
        data-iris-nav-item=""
        data-key={node.key}
        data-active={active ? 'true' : undefined}
        data-branch={branch ? 'true' : undefined}
        disabled={node.disabled}
        title={node.title}
        aria-label={branch ? `${node.title} (section)` : node.title}
        aria-current={active && !branch ? 'page' : undefined}
        style={itemStyle({
          depth: 0,
          active,
          trail: false,
          disabled: !!node.disabled,
          hovered: hovered === node.key,
        })}
        {...hoverProps(node.key)}
        onClick={() => select(branch ? firstLeaf(node) : node)}
      >
        {iconNode(node, 20) ?? <span style={{ fontWeight: 700 }}>{node.title.charAt(0)}</span>}
      </button>
    )
  }

  const renderItem = (node: NavNode, depth: number): React.ReactElement => {
    const branch = isBranch(node)
    const open = expanded.includes(node.key)
    const active = node.key === activeKey
    const trail = branch && activePath.includes(node.key)

    const row = (
      <button
        type="button"
        data-iris-nav-item=""
        data-key={node.key}
        data-branch={branch ? 'true' : undefined}
        data-active={active ? 'true' : undefined}
        data-open={branch && open ? 'true' : undefined}
        data-depth={String(depth)}
        disabled={node.disabled}
        aria-expanded={branch ? (open ? 'true' : 'false') : undefined}
        aria-current={active ? 'page' : undefined}
        style={itemStyle({
          depth,
          active,
          trail,
          disabled: !!node.disabled,
          hovered: hovered === node.key,
        })}
        {...hoverProps(node.key)}
        onClick={() => (branch ? toggle(node.key) : select(node))}
      >
        {iconNode(node)}
        <span
          style={{
            flex: branch ? 1 : '0 1 auto',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.title}
        </span>
        {badgeNode(node)}
        {branch ? (
          <IrisIcon
            name={open ? 'chevron-down' : 'chevron-right'}
            size={16}
            style={{ marginInlineStart: node.badge ? 6 : 'auto', opacity: 0.6 }}
          />
        ) : null}
      </button>
    )

    if (!branch || !open) {
      return (
        <div key={node.key} data-iris-nav-group={branch ? '' : undefined}>
          {row}
        </div>
      )
    }
    return (
      <div key={node.key} data-iris-nav-group="" data-open="true">
        {row}
        <div data-iris-nav-children="" role="group">
          {(node.children ?? []).map((child) => renderItem(child, depth + 1))}
        </div>
      </div>
    )
  }

  // Arrow-key navigation over the visible items (Tab still works as a fallback).
  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>): void => {
    const root = e.currentTarget
    const buttons = Array.from(root.querySelectorAll<HTMLElement>('[data-iris-nav-item]'))
    if (buttons.length === 0) return
    const idx = buttons.indexOf(document.activeElement as HTMLElement)
    const focusAt = (i: number): void => buttons[(i + buttons.length) % buttons.length]?.focus()

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        return focusAt(idx < 0 ? 0 : idx + 1)
      case 'ArrowUp':
        e.preventDefault()
        return focusAt(idx < 0 ? buttons.length - 1 : idx - 1)
      case 'Home':
        e.preventDefault()
        return void buttons[0]?.focus()
      case 'End':
        e.preventDefault()
        return void buttons[buttons.length - 1]?.focus()
    }

    if (collapsed || idx < 0) return
    const key = buttons[idx]?.getAttribute('data-key')
    if (!key) return
    const node = findNavNode(items, key)

    if (e.key === 'ArrowRight' && node && isBranch(node)) {
      e.preventDefault()
      if (!expanded.includes(key)) toggle(key)
      else focusAt(idx + 1)
    } else if (e.key === 'ArrowLeft') {
      if (node && isBranch(node) && expanded.includes(key)) {
        e.preventDefault()
        toggle(key)
      } else {
        const parentKey = findNavPath(items, key).at(-2)?.key
        if (parentKey) {
          e.preventDefault()
          buttons.find((b) => b.getAttribute('data-key') === parentKey)?.focus()
        }
      }
    }
  }

  return (
    <nav
      data-iris-nav-menu=""
      data-collapsed={collapsed ? 'true' : undefined}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {collapsed
        ? tree.map((node) => renderCollapsed(node))
        : tree.map((node) => renderItem(node, 0))}
    </nav>
  )
}
