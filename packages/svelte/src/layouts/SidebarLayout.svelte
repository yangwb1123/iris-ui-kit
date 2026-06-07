<script lang="ts">
  import { styleToString, mergeStyle, asLen } from '../internal/style'
  import type { IrisSidebarLayoutProps } from './types'

  let {
    collapsed: collapsedProp,
    defaultCollapsed = false,
    onCollapsedChange,
    width = 240,
    collapsedWidth = 60,
    side = 'left',
    sidebar,
    class: className,
    style,
    children,
    ...rest
  }: IrisSidebarLayoutProps = $props()

  // svelte-ignore state_referenced_locally — uncontrolled seed; controlled reads use the prop.
  let internal = $state(defaultCollapsed)
  const isControlled = $derived(collapsedProp !== undefined)
  const collapsed = $derived(isControlled ? (collapsedProp as boolean) : internal)

  function setCollapsed(next: boolean): void {
    if (!isControlled) internal = next
    onCollapsedChange?.(next)
  }

  const containerStyle = $derived(
    styleToString({
      display: 'flex',
      'flex-direction': side === 'right' ? 'row-reverse' : 'row',
      width: '100%',
      height: '100%',
      'min-height': 0,
      color: 'var(--iris-foreground)',
    }),
  )
  const asideStyle = $derived(
    styleToString({
      width: collapsed ? asLen(collapsedWidth) : asLen(width),
      'flex-shrink': 0,
      background: 'var(--iris-surface)',
      'border-inline-end': side === 'left' ? '1px solid var(--iris-border)' : 'none',
      'border-inline-start': side === 'right' ? '1px solid var(--iris-border)' : 'none',
      transition: 'width 180ms ease',
      overflow: 'hidden',
      display: 'flex',
      'flex-direction': 'column',
    }),
  )
</script>

<div
  {...rest}
  data-iris-sidebar-layout
  data-collapsed={collapsed ? '' : undefined}
  data-side={side}
  class={className}
  style={mergeStyle(containerStyle, style)}
>
  <aside data-iris-sidebar data-collapsed={collapsed ? '' : undefined} style={asideStyle}>
    {#if sidebar}{@render sidebar({ collapsed, setCollapsed })}{/if}
  </aside>
  <div
    data-iris-sidebar-main
    style="flex: 1; min-width: 0; overflow: auto; background: var(--iris-background)"
  >
    {@render children?.()}
  </div>
</div>
