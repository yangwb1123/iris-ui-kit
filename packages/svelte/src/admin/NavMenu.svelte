<script lang="ts">
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
  import { toStore } from '../useStore'
  import { styleToString } from '../internal/style'
  import IrisIcon from '../primitives/icon/IrisIcon.svelte'
  import { useI18n } from '../i18n'
  import type { IrisNavMenuProps } from './types'

  const { t } = useI18n()

  let {
    items,
    activeKey,
    expandedKeys,
    defaultExpandedKeys,
    collapsed = false,
    orientation = 'vertical',
    ariaLabel,
    onSelect,
    onExpandedKeysChange,
  }: IrisNavMenuProps = $props()

  const isControlled = $derived(expandedKeys !== undefined)

  // Expand/collapse state, toggle, and the active-trail auto-open union are
  // single-sourced in the core expansion model (`merge` = union without drops);
  // `branchTrail` is the shared selector for the ancestor groups to open. This
  // component keeps only the controlled/uncontrolled split: controlled reads use
  // the `expandedKeys` prop; uncontrolled state lives in the model.
  // svelte-ignore state_referenced_locally — initial seed; controlled reads use the prop.
  const model = createExpansion({
    mode: 'multiple',
    defaultExpanded: defaultExpandedKeys ?? branchTrail(items, activeKey ?? ''),
  })
  const internalExpanded = toStore(model.store)
  const expanded = $derived(isControlled ? (expandedKeys as string[]) : $internalExpanded)

  // Auto-open the active branch trail as the active leaf changes (uncontrolled).
  $effect(() => {
    const key = activeKey
    if (isControlled) return
    model.merge(key ? branchTrail(items, key) : [])
  })

  function setExpanded(keys: string[]): void {
    if (!isControlled) model.set(keys)
    onExpandedKeysChange?.(keys)
  }
  function toggle(key: string): void {
    const cur = expanded
    setExpanded(cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key])
  }
  function select(node: NavNode): void {
    if (node.disabled) return
    onSelect?.(node.key, node)
  }

  let hovered = $state<string | null>(null)
  const tree = $derived(visibleNav(items))
  const activePath = $derived(activeKey ? findNavPath(items, activeKey).map((n) => n.key) : [])

  function itemStyle(opts: {
    depth: number
    active: boolean
    trail: boolean
    disabled: boolean
    hovered: boolean
  }): string {
    return styleToString({
      display: 'flex',
      'align-items': 'center',
      gap: '10px',
      width: orientation === 'horizontal' && opts.depth === 0 ? 'auto' : '100%',
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
      padding: collapsed ? '10px' : '8px 10px',
      'padding-inline-start': collapsed ? '10px' : `${12 + opts.depth * 16}px`,
      'justify-content': collapsed ? 'center' : 'flex-start',
    })
  }

  function onKeyDown(e: KeyboardEvent & { currentTarget: EventTarget & HTMLElement }): void {
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
</script>

{#snippet navItem(node: NavNode, depth: number)}
  {@const branch = isBranch(node)}
  {@const open = expanded.includes(node.key)}
  {@const active = node.key === activeKey}
  {@const trail = branch && activePath.includes(node.key)}
  <div
    data-iris-nav-group={branch ? '' : undefined}
    data-open={branch && open ? 'true' : undefined}
    style:position={orientation === 'horizontal' && depth === 0 ? 'relative' : undefined}
  >
    <button
      type="button"
      data-iris-nav-item
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
      onmouseenter={() => (hovered = node.key)}
      onmouseleave={() => {
        if (hovered === node.key) hovered = null
      }}
      onclick={() => (branch ? toggle(node.key) : select(node))}
    >
      {#if node.icon}<IrisIcon name={node.icon} size={18} />{/if}
      <span
        style="flex: {branch
          ? '1'
          : '0 1 auto'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
      >
        {node.title}
      </span>
      {#if node.badge !== undefined && node.badge !== ''}
        <span
          data-iris-nav-badge
          style="margin-inline-start: auto; font-size: 11px; line-height: 1; padding: 2px 6px; border-radius: 999px; background: var(--iris-danger, #e5484d); color: #fff"
        >
          {String(node.badge)}
        </span>
      {/if}
      {#if branch}
        <IrisIcon
          name={open ? 'chevron-down' : 'chevron-right'}
          size={16}
          style="margin-inline-start: {node.badge ? '6px' : 'auto'}; opacity: 0.6"
        />
      {/if}
    </button>
    {#if branch && open}
      <div
        data-iris-nav-children
        role="group"
        style:position={orientation === 'horizontal' && depth === 0 ? 'absolute' : undefined}
        style:inset-block-start={orientation === 'horizontal' && depth === 0
          ? 'calc(100% + 4px)'
          : undefined}
        style:inset-inline-start={orientation === 'horizontal' && depth === 0 ? '0' : undefined}
        style:z-index={orientation === 'horizontal' && depth === 0 ? '60' : undefined}
        style:min-width={orientation === 'horizontal' && depth === 0 ? '220px' : undefined}
        style:padding={orientation === 'horizontal' && depth === 0 ? '6px' : undefined}
        style:border={orientation === 'horizontal' && depth === 0
          ? '1px solid var(--iris-border)'
          : undefined}
        style:border-radius={orientation === 'horizontal' && depth === 0
          ? 'var(--iris-radius-md, 6px)'
          : undefined}
        style:background={orientation === 'horizontal' && depth === 0
          ? 'var(--iris-surface)'
          : undefined}
        style:box-shadow={orientation === 'horizontal' && depth === 0
          ? 'var(--iris-shadow-md)'
          : undefined}
      >
        {#each node.children ?? [] as child (child.key)}
          {@render navItem(child, depth + 1)}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet collapsedItem(node: NavNode)}
  {@const branch = isBranch(node)}
  {@const active = branch ? activePath.includes(node.key) : node.key === activeKey}
  <button
    type="button"
    data-iris-nav-item
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
    onmouseenter={() => (hovered = node.key)}
    onmouseleave={() => {
      if (hovered === node.key) hovered = null
    }}
    onclick={() => select(branch ? firstLeaf(node) : node)}
  >
    {#if node.icon}
      <IrisIcon name={node.icon} size={20} />
    {:else}
      <span style="font-weight: 700">{node.title.charAt(0)}</span>
    {/if}
  </button>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions — roving arrow-key nav over the child buttons -->
<nav
  data-iris-nav-menu
  data-collapsed={collapsed ? 'true' : undefined}
  data-orientation={orientation}
  aria-label={ariaLabel ?? t('admin.nav')}
  onkeydown={onKeyDown}
  style:display="flex"
  style:flex-direction={orientation === 'horizontal' ? 'row' : 'column'}
  style:align-items={orientation === 'horizontal' ? 'center' : undefined}
  style:gap="2px"
>
  {#each tree as node (node.key)}
    {#if collapsed}{@render collapsedItem(node)}{:else}{@render navItem(node, 0)}{/if}
  {/each}
</nav>
