import { createEffect, createSignal, For, Show, type JSX } from 'solid-js'
import {
  branchTrail,
  createExpansion,
  findNavNode,
  findNavPath,
  firstLeaf,
  isBranch,
  visibleNav,
  type NavNode,
} from '@iris-ui-kit/core'
import { IrisIcon } from '../primitives/icon'
import { useStore } from '../useStore'
import { useI18n } from '../i18n'

export interface IrisNavMenuProps {
  items: NavNode[]
  activeKey?: string
  expandedKeys?: string[]
  defaultExpandedKeys?: string[]
  collapsed?: boolean
  orientation?: 'vertical' | 'horizontal'
  ariaLabel?: string
  onSelect?: (key: string, node: NavNode) => void
  onExpandedKeysChange?: (keys: string[]) => void
}

/**
 * Data-driven nested navigation menu — the sidebar nav of the admin shell.
 * Accordion of expandable branches + selectable leaves; the active leaf and its
 * ancestor branches highlight and the active trail auto-expands. `collapsed`
 * switches to an icon-only rail (branch click → first leaf). Router-agnostic:
 * takes `activeKey`, emits `onSelect(key, node)`. Solid port of the React/Vue
 * IrisNavMenu (same arrow-key a11y + section labels).
 */
export function IrisNavMenu(props: IrisNavMenuProps): JSX.Element {
  const { t } = useI18n()
  const horizontal = (): boolean => props.orientation === 'horizontal'
  // Branch-ancestor keys to auto-open for an active leaf — the slice/filter/map
  // is single-sourced in core `branchTrail`; the guard handles an absent key.
  const trailKeys = (key: string | undefined): string[] =>
    key ? branchTrail(props.items, key) : []

  // The expand/collapse state machine (open set + union-merge) lives in the core
  // expansion model; this component keeps only the controlled/uncontrolled glue:
  // when controlled, the displayed set is the `expandedKeys` prop and the model
  // is left untouched (so it stays put until the parent updates).
  const model = createExpansion({
    mode: 'multiple',
    defaultExpanded: props.defaultExpandedKeys ?? trailKeys(props.activeKey),
  })
  const modelExpanded = useStore(model.store)

  const isControlled = (): boolean => props.expandedKeys !== undefined
  const expanded = (): string[] =>
    isControlled() ? (props.expandedKeys as string[]) : modelExpanded()

  // Auto-open the active branch trail as the active leaf changes (uncontrolled).
  createEffect(() => {
    const key = props.activeKey
    if (isControlled()) return
    model.merge(trailKeys(key))
  })

  const setExpanded = (keys: string[]): void => {
    if (!isControlled()) model.set(keys)
    props.onExpandedKeysChange?.(keys)
  }
  const toggle = (key: string): void => {
    const cur = expanded()
    setExpanded(cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key])
  }
  const select = (node: NavNode): void => {
    if (node.disabled) return
    props.onSelect?.(node.key, node)
  }

  const [hovered, setHovered] = createSignal<string | null>(null)
  const tree = (): NavNode[] => visibleNav(props.items)
  const activePath = (): string[] =>
    props.activeKey ? findNavPath(props.items, props.activeKey).map((n) => n.key) : []

  const itemStyle = (opts: {
    depth: number
    active: boolean
    trail: boolean
    disabled: boolean
    hovered: boolean
  }): JSX.CSSProperties => ({
    display: 'flex',
    'align-items': 'center',
    gap: '10px',
    width: horizontal() && opts.depth === 0 ? 'auto' : '100%',
    'box-sizing': 'border-box',
    border: 'none',
    'border-radius': 'var(--iris-radius-md, 6px)',
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
    'font-size': '14px',
    'font-weight': opts.active || opts.trail ? '600' : '400',
    'text-align': 'start',
    cursor: opts.disabled ? 'not-allowed' : 'pointer',
    opacity: opts.disabled ? '0.5' : '1',
    padding: props.collapsed ? '10px' : '8px 10px',
    'padding-inline-start': props.collapsed ? '10px' : `${12 + opts.depth * 16}px`,
    'justify-content': props.collapsed ? 'center' : 'flex-start',
  })

  const hoverHandlers = (key: string) => ({
    onMouseEnter: () => setHovered(key),
    onMouseLeave: () => setHovered((h) => (h === key ? null : h)),
  })

  const renderCollapsed = (node: NavNode): JSX.Element => {
    const branch = isBranch(node)
    const active = (): boolean =>
      branch ? activePath().includes(node.key) : node.key === props.activeKey
    return (
      <button
        type="button"
        data-iris-nav-item=""
        data-key={node.key}
        data-active={active() ? 'true' : undefined}
        data-branch={branch ? 'true' : undefined}
        disabled={node.disabled}
        title={node.title}
        aria-label={branch ? `${node.title} (section)` : node.title}
        aria-current={active() && !branch ? 'page' : undefined}
        style={itemStyle({
          depth: 0,
          active: active(),
          trail: false,
          disabled: !!node.disabled,
          hovered: hovered() === node.key,
        })}
        {...hoverHandlers(node.key)}
        onClick={() => select(branch ? firstLeaf(node) : node)}
      >
        <Show
          when={node.icon}
          fallback={<span style={{ 'font-weight': '700' }}>{node.title.charAt(0)}</span>}
        >
          <IrisIcon name={node.icon!} size={20} />
        </Show>
      </button>
    )
  }

  const renderItem = (node: NavNode, depth: number): JSX.Element => {
    const branch = isBranch(node)
    const open = (): boolean => expanded().includes(node.key)
    const active = (): boolean => node.key === props.activeKey
    const trail = (): boolean => branch && activePath().includes(node.key)

    const row = (
      <button
        type="button"
        data-iris-nav-item=""
        data-key={node.key}
        data-branch={branch ? 'true' : undefined}
        data-active={active() ? 'true' : undefined}
        data-open={branch && open() ? 'true' : undefined}
        data-depth={String(depth)}
        disabled={node.disabled}
        aria-expanded={branch ? (open() ? 'true' : 'false') : undefined}
        aria-current={active() ? 'page' : undefined}
        style={itemStyle({
          depth,
          active: active(),
          trail: trail(),
          disabled: !!node.disabled,
          hovered: hovered() === node.key,
        })}
        {...hoverHandlers(node.key)}
        onClick={() => (branch ? toggle(node.key) : select(node))}
      >
        <Show when={node.icon}>
          <IrisIcon name={node.icon!} size={18} />
        </Show>
        <span
          style={{
            flex: branch ? '1' : '0 1 auto',
            overflow: 'hidden',
            'text-overflow': 'ellipsis',
            'white-space': 'nowrap',
          }}
        >
          {node.title}
        </span>
        <Show when={node.badge !== undefined && node.badge !== ''}>
          <span
            data-iris-nav-badge=""
            style={{
              'margin-inline-start': 'auto',
              'font-size': '11px',
              'line-height': '1',
              padding: '2px 6px',
              'border-radius': '999px',
              background: 'var(--iris-danger, #e5484d)',
              color: '#fff',
            }}
          >
            {String(node.badge)}
          </span>
        </Show>
        <Show when={branch}>
          <IrisIcon
            name={open() ? 'chevron-down' : 'chevron-right'}
            size={16}
            style={{ 'margin-inline-start': node.badge ? '6px' : 'auto', opacity: '0.6' }}
          />
        </Show>
      </button>
    )

    return (
      <div
        data-iris-nav-group={branch ? '' : undefined}
        data-open={branch && open() ? 'true' : undefined}
        style={{ position: horizontal() && depth === 0 ? 'relative' : undefined }}
      >
        {row}
        <Show when={branch && open()}>
          <div
            data-iris-nav-children=""
            role="group"
            style={
              horizontal() && depth === 0
                ? {
                    position: 'absolute',
                    'inset-block-start': 'calc(100% + 4px)',
                    'inset-inline-start': 0,
                    'z-index': 60,
                    'min-width': '220px',
                    padding: '6px',
                    border: '1px solid var(--iris-border)',
                    'border-radius': 'var(--iris-radius-md, 6px)',
                    background: 'var(--iris-surface)',
                    'box-shadow': 'var(--iris-shadow-md)',
                  }
                : undefined
            }
          >
            <For each={node.children ?? []}>{(child) => renderItem(child, depth + 1)}</For>
          </div>
        </Show>
      </div>
    )
  }

  // Arrow-key navigation over the visible items (Tab still works as a fallback).
  const onKeyDown = (e: KeyboardEvent & { currentTarget: HTMLElement }): void => {
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

    if (props.collapsed || idx < 0) return
    const key = buttons[idx]?.getAttribute('data-key')
    if (!key) return
    const node = findNavNode(props.items, key)
    if (e.key === 'ArrowRight' && node && isBranch(node)) {
      e.preventDefault()
      if (!expanded().includes(key)) toggle(key)
      else focusAt(idx + 1)
    } else if (e.key === 'ArrowLeft') {
      if (node && isBranch(node) && expanded().includes(key)) {
        e.preventDefault()
        toggle(key)
      } else {
        const parentKey = findNavPath(props.items, key).at(-2)?.key
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
      data-collapsed={props.collapsed ? 'true' : undefined}
      data-orientation={props.orientation ?? 'vertical'}
      aria-label={props.ariaLabel ?? t('admin.nav')}
      onKeyDown={onKeyDown}
      style={{
        display: 'flex',
        'flex-direction': horizontal() ? 'row' : 'column',
        'align-items': horizontal() ? 'center' : undefined,
        gap: '2px',
      }}
    >
      <For each={tree()}>
        {(node) => (props.collapsed ? renderCollapsed(node) : renderItem(node, 0))}
      </For>
    </nav>
  )
}
