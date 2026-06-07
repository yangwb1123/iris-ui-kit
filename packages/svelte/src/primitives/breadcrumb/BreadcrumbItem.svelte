<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'
  import type { IrisBreadcrumbItemProps } from './types'

  let { href, current = false, style, children, ...rest }: IrisBreadcrumbItemProps = $props()

  const crumbStyle = $derived(
    styleToString({
      color: current ? 'var(--iris-muted)' : 'var(--iris-primary)',
      'text-decoration': 'none',
      cursor: current ? 'default' : href ? 'pointer' : 'default',
    }),
  )
</script>

<li data-iris-breadcrumb-item>
  {#if href && !current}
    <a {...rest} data-iris-breadcrumb-crumb {href} style={mergeStyle(crumbStyle, style)}>
      {@render children?.()}
    </a>
  {:else}
    <span
      {...rest}
      data-iris-breadcrumb-crumb
      aria-current={current ? 'page' : undefined}
      style={mergeStyle(crumbStyle, style)}
    >
      {@render children?.()}
    </span>
  {/if}
</li>
