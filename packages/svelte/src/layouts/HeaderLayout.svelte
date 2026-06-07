<script lang="ts">
  import { styleToString, mergeStyle, asLen } from '../internal/style'
  import type { IrisHeaderLayoutProps } from './types'

  let {
    headerHeight = 'auto',
    footerHeight = 'auto',
    sticky = true,
    header,
    footer,
    class: className,
    style,
    children,
  }: IrisHeaderLayoutProps = $props()

  const base = $derived(
    styleToString({
      display: 'flex',
      'flex-direction': 'column',
      width: '100%',
      height: '100%',
      'min-height': 0,
      background: 'var(--iris-background)',
      color: 'var(--iris-foreground)',
    }),
  )
  const headerStyle = $derived(
    styleToString({
      'flex-shrink': 0,
      height: asLen(headerHeight),
      'border-bottom': '1px solid var(--iris-border)',
      background: 'var(--iris-surface)',
      position: sticky ? 'sticky' : 'static',
      top: 0,
      'z-index': 50,
    }),
  )
  const footerStyle = $derived(
    styleToString({
      'flex-shrink': 0,
      height: asLen(footerHeight),
      'border-top': '1px solid var(--iris-border)',
      background: 'var(--iris-surface)',
    }),
  )
</script>

<div data-iris-header-layout class={className} style={mergeStyle(base, style)}>
  {#if header}
    <header data-iris-header style={headerStyle}>{@render header()}</header>
  {/if}
  <main data-iris-header-main style="flex: 1; min-height: 0; overflow: auto">
    {@render children?.()}
  </main>
  {#if footer}
    <footer data-iris-footer style={footerStyle}>{@render footer()}</footer>
  {/if}
</div>
